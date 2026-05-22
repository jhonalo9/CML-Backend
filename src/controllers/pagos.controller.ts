import { Request, Response } from 'express';
import { prisma} from '../lib/prisma';

import { sendSuccess, sendError, sendCreated } from '../utils/response.utils';
import pagosService from '../services/pagos.service';
import { 
  validateMetodoPagoManual, 
  validateMetodoPagoGateway,
  validateTipoPago
} from '../utils/payment-types.utils';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
//import { cleanupTempFile } from '../config/multer';

//const prisma = new PrismaClient();

/**
 * Obtener métodos de pago disponibles
 */
export const obtenerMetodosPago = async (req: Request, res: Response) => {
  try {
    const { monto } = req.query;
    
    const metodosDisponibles = await prisma.configuracionPago.findMany({
      where: { activo: true },
      select: {
        metodoPago: true,
        nombreTitular: true,
        numeroCuenta: true,
        nombreBanco: true,
        tipoCuenta: true,
        numeroCelular: true,
        comisionPorcentaje: true,
        comisionFija: true,
        instrucciones: true
      }
    });

    // Calcular comisiones si se proporciona monto
    const metodosProcesados = metodosDisponibles.map(metodo => {
      const montoBase = parseFloat(monto as string) || 0;
      let comision = 0;
      
      if (metodo.comisionPorcentaje) {
        comision = montoBase * (Number(metodo.comisionPorcentaje) / 100);
      }
      if (metodo.comisionFija) {
        comision += Number(metodo.comisionFija);
      }
      
      return {
        ...metodo,
        esManual: ['yape', 'transferencia_bancaria'].includes(metodo.metodoPago),
        tieneComision: comision > 0,
        comision: comision.toFixed(2),
        montoTotal: (montoBase + comision).toFixed(2)
      };
    });

    return sendSuccess(res, {
      metodosDisponibles: metodosProcesados,
      manuales: metodosProcesados.filter(m => m.esManual),
      gateways: metodosProcesados.filter(m => !m.esManual)
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Iniciar pago manual (Yape o Transferencia)
 */
export const iniciarPagoManual = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const {
      tipoPago: tipoPagoInput,
      idReferencia: idReferenciaRaw,
      monto,
      metodoPago: metodoPagoInput,
      numeroOperacion,
      fechaOperacion
    } = req.body;

    console.log('📦 Body recibido:', req.body);
    console.log('📁 Archivo recibido:', req.file);

    // ✅ Convertir idReferencia de string a número (OBLIGATORIO)
    let idReferencia: number;
    
    if (!idReferenciaRaw || idReferenciaRaw === 'undefined' || idReferenciaRaw === 'null') {
      // Si no viene, obtenerlo del backend según el tipo de pago
      if (tipoPagoInput === 'matricula') {
        const matricula = await prisma.matricula.findFirst({
          where: { usuarioId, activa: true }
        });
        
        if (!matricula) {
          ////if (req.file) cleanupTempFile(req.file.path);
          return sendError(res, 'No se encontró una matrícula activa', 404);
        }
        
        idReferencia = matricula.id;
        console.log('✅ ID de matrícula obtenido del backend:', idReferencia);
      } else {
        // Para otros tipos de pago, idReferencia es obligatorio
        //if (req.file) cleanupTempFile(req.file.path);
        return sendError(res, 'El ID de referencia es obligatorio', 400);
      }
    } else {
      // Convertir de string a número
      const parsed = parseInt(idReferenciaRaw, 10);
      
      if (isNaN(parsed) || parsed <= 0) {
       // if (req.file) cleanupTempFile(req.file.path);
        return sendError(res, 'ID de referencia inválido', 400);
      }
      
      idReferencia = parsed;
    }

    console.log('🔍 idReferencia validado:', idReferencia, '(tipo:', typeof idReferencia, ')');

    // Validar y convertir método de pago
    const metodoPago = validateMetodoPagoManual(metodoPagoInput);
    if (!metodoPago) {
      //if (req.file) cleanupTempFile(req.file.path);
      return sendError(res, 'Método de pago manual inválido. Use "yape" o "transferencia_bancaria"', 400);
    }

    // Validar tipo de pago
    const tipoPago = validateTipoPago(tipoPagoInput);
    if (!tipoPago) {
      //if (req.file) cleanupTempFile(req.file.path);
      return sendError(res, 'Tipo de pago inválido', 400);
    }

    // Validar que se haya subido el comprobante
    if (!req.file) {
      return sendError(res, 'Debe subir el comprobante de pago', 400);
    }

    if (!numeroOperacion) {
      //cleanupTempFile(req.file.path);
      return sendError(res, 'Debe proporcionar el número de operación', 400);
    }

    // Verificar que el pago no esté duplicado
    const pagoExistente = await prisma.pago.findFirst({
      where: {
        tipoPago,
        idReferencia, // ✅ Ahora es number (no null)
        usuarioId,
        estado: { in: ['pendiente_validacion', 'completado'] }
      }
    });

    if (pagoExistente) {
      //cleanupTempFile(req.file.path);
      return sendError(res, 'Ya existe un pago registrado para esta referencia', 400);
    }

    // Subir comprobante a Cloudinary
    let comprobanteUrl: string;
    let comprobantePublicId: string;
    
    try {
      const resultado = await uploadToCloudinary(
        req.file, 
        'ministerio-laico/comprobantes-pago'
      );
      comprobanteUrl = resultado.url;
      comprobantePublicId = resultado.publicId;
      
      //cleanupTempFile(req.file.path);
      
      console.log('✅ Comprobante subido a Cloudinary:', comprobanteUrl);
    } catch (uploadError) {
      console.error('❌ Error subiendo comprobante:', uploadError);
      //cleanupTempFile(req.file.path);
      return sendError(res, 'Error al subir el comprobante de pago', 500);
    }

    // Generar código de transacción
    const codigoTransaccion = `${metodoPago.toUpperCase()}-${Date.now()}-${usuarioId}`;

    // Crear registro de pago
    const pago = await prisma.pago.create({
      data: {
        usuarioId,
        tipoPago,
        idReferencia, // ✅ number (no null)
        codigoTransaccion,
        monto: parseFloat(monto),
        comision: 0,
        montoTotal: parseFloat(monto),
        metodoPago,
        estado: 'pendiente_validacion',
        comprobanteUrl,
        numeroOperacion,
        fechaOperacion: fechaOperacion ? new Date(fechaOperacion) : new Date(),
        detallesPago: {
          navegador: req.get('User-Agent'),
          ip: req.ip,
          comprobantePublicId
        }
      }
    });



    console.log('✅ Pago creado exitosamente:', pago.id);

    if (tipoPago === 'matricula') {
  await prisma.matricula.update({
    where: { id: idReferencia },
    data: {
      metodoPago, // ⬅️ Guardar el método de pago
      referenciaPago: codigoTransaccion,
      fechaPago: new Date()
      // ⚠️ NO cambiar estadoPago aquí, sigue en 'pendiente'
    }
  });
  console.log('✅ Matrícula actualizada con método de pago');
} else if (tipoPago === 'curso') {
  await prisma.inscripcionCurso.update({
    where: { id: idReferencia },
    data: {
      metodoPago, // ⬅️ Guardar el método de pago
      referenciaPago: codigoTransaccion,
      fechaPago: new Date()
      // ⚠️ NO cambiar estadoPago aquí, sigue en 'pendiente'
    }
  });
  console.log('✅ Inscripción actualizada con método de pago');
}

    // Notificar a administradores
    const admins = await prisma.usuario.findMany({
      where: { tipoUsuario: 'administrador', estado: 'activo' },
      select: { id: true }
    });

    await Promise.all(
      admins.map(admin =>
        prisma.notificacion.create({
          data: {
            usuarioId: admin.id,
            tipo: 'pago',
            titulo: 'Nuevo pago pendiente de validación',
            mensaje: `Hay un nuevo pago ${metodoPago} por S/. ${monto} esperando validación`,
            urlAccion: `/admin/pagos/${pago.id}`
          }
        })
      )
    );

    // Notificar al usuario
    await prisma.notificacion.create({
      data: {
        usuarioId,
        tipo: 'pago',
        titulo: 'Pago registrado',
        mensaje: `Tu pago de S/. ${monto} está siendo validado. Te notificaremos cuando sea confirmado.`,
        urlAccion: `/pagos/${pago.id}`
      }
    });

    return sendCreated(
      res,
      {
        pagoId: pago.id,
        codigoTransaccion: pago.codigoTransaccion,
        estado: pago.estado,
        comprobanteUrl: pago.comprobanteUrl
      },
      'Pago registrado. Será validado en las próximas 24 horas.'
    );
  } catch (error) {
    console.error('❌ Error en iniciarPagoManual:', error);
    if (req.file) {
      //cleanupTempFile(req.file.path);
    }
    throw error;
  }
};




/**
 * Iniciar pago con gateway (Stripe, PayPal, Mercado Pago)
 */
export const iniciarPagoGateway = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const {
      tipoPago: tipoPagoInput,
      idReferencia,       
      monto,
      metodoPago: metodoPagoInput,
      descripcion,
      returnUrl,
      cancelUrl
    } = req.body;

    // Validar y convertir método de pago
    const metodoPago = validateMetodoPagoGateway(metodoPagoInput);
    if (!metodoPago) {
      return sendError(res, 'Método de pago de gateway inválido. Use "stripe", "paypal" o "mercado_pago"', 400);
    }

    // Validar tipo de pago
    const tipoPago = validateTipoPago(tipoPagoInput);
    if (!tipoPago) {
      return sendError(res, 'Tipo de pago inválido', 400);
    }

    // Obtener configuración del método de pago
    const config = await prisma.configuracionPago.findUnique({
      where: { metodoPago }
    });

    if (!config || !config.activo) {
      return sendError(res, 'Este método de pago no está disponible', 400);
    }

    // Calcular comisión
    let comision = 0;
    if (config.comisionPorcentaje) {
      comision = Number(monto) * (Number(config.comisionPorcentaje) / 100);
    }
    if (config.comisionFija) {
      comision += Number(config.comisionFija);
    }

    const montoTotal = Number(monto) + comision;

    // Generar código de transacción
    const codigoTransaccion = `${metodoPago.toUpperCase()}-${Date.now()}-${usuarioId}`;

    // Crear registro de pago
    const pago = await prisma.pago.create({
      data: {
        usuarioId,
        tipoPago,
        idReferencia,
        codigoTransaccion,
        monto,
        comision,
        montoTotal,
        metodoPago,
        estado: 'pendiente',
        detallesPago: {
          descripcion,
          returnUrl,
          cancelUrl
        }
      }
    });

    // Iniciar pago según el gateway
    let resultado;
    
    switch (metodoPago) {
      case 'stripe':
        resultado = await pagosService.createStripePayment(
          montoTotal,
          descripcion || `Pago ${tipoPago}`,
          {
            pagoId: pago.id,
            codigoTransaccion,
            returnUrl,
            cancelUrl
          }
        );
        break;
        
      case 'paypal':
        resultado = await pagosService.createPayPalPayment(
          montoTotal,
          descripcion || `Pago ${tipoPago}`,
          {
            pagoId: pago.id,
            codigoTransaccion,
            returnUrl,
            cancelUrl
          }
        );
        break;
        
      case 'mercado_pago':
        resultado = await pagosService.createMercadoPagoPayment(
          montoTotal,
          descripcion || `Pago ${tipoPago}`,
          {
            pagoId: pago.id,
            codigoTransaccion,
            returnUrl,
            cancelUrl
          }
        );
        break;
        
      default:
        return sendError(res, 'Gateway no implementado', 500);
    }

    if (!resultado.success) {
      // Marcar el pago como fallido
      await prisma.pago.update({
        where: { id: pago.id },
        data: { estado: 'fallido' }
      });
      
      return sendError(res, resultado.error || 'Error al procesar el pago', 400);
    }

    // Actualizar pago con datos del gateway
    await prisma.pago.update({
      where: { id: pago.id },
      data: {
        paymentIntentId: resultado.paymentIntentId,
        checkoutSessionId: resultado.sessionId,
        estado: 'procesando'
      }
    });

    return sendSuccess(res, {
      pagoId: pago.id,
      codigoTransaccion,
      checkoutUrl: resultado.checkoutUrl,
      detalles: {
        monto: Number(monto).toFixed(2),
        comision: comision.toFixed(2),
        montoTotal: montoTotal.toFixed(2)
      }
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Verificar pago de gateway (callback después del pago)
 */
export const verificarPagoGateway = async (req: Request, res: Response) => {
  try {
    const { sessionId, metodoPago: metodoPagoParam } = req.params;

    // Validar y convertir método de pago
    const metodoPago = validateMetodoPagoGateway(metodoPagoParam);
    if (!metodoPago) {
      return sendError(res, 'Método de pago no válido', 400);
    }

    const pago = await prisma.pago.findFirst({
      where: {
        checkoutSessionId: sessionId,
        metodoPago
      }
    });

    if (!pago) {
      return sendError(res, 'Pago no encontrado', 404);
    }

    let resultado;
    
    switch (metodoPago) {
      case 'stripe':
        resultado = await pagosService.verifyStripePayment(sessionId);
        break;
      case 'paypal':
        resultado = await pagosService.verifyPayPalPayment(sessionId);
        break;
      case 'mercado_pago':
        resultado = await pagosService.verifyMercadoPagoPayment(sessionId);
        break;
    }

    if (!resultado.verified) {
      await prisma.pago.update({
        where: { id: pago.id },
        data: { estado: 'fallido' }
      });
      
      return sendError(res, 'Pago no verificado', 400);
    }

    // Marcar como completado y procesar
    await pagosService.procesarPagoCompletado(pago.id, resultado.data);

    return sendSuccess(res, {
      pagoId: pago.id,
      estado: 'completado',
      mensaje: 'Pago verificado y procesado exitosamente'
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Validar pago manual (Admin)
 */
export const validarPagoManual = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { accion, razonRechazo } = req.body; // accion: 'aprobar' | 'rechazar'

    const pago = await prisma.pago.findUnique({
      where: { id: parseInt(id) },
      include: {
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
            email: true
          }
        }
      }
    });

    if (!pago) {
      return sendError(res, 'Pago no encontrado', 404);
    }

    if (pago.estado !== 'pendiente_validacion') {
      return sendError(res, 'Este pago no está pendiente de validación', 400);
    }

    if (accion === 'aprobar') {
      // Aprobar pago
      const pagoActualizado = await prisma.pago.update({
        where: { id: parseInt(id) },
        data: {
          estado: 'completado',
          validadoPorId: adminId,
          fechaValidacion: new Date()
        }
      });

      // Procesar el pago según el tipo
      await pagosService.procesarPagoCompletado(pagoActualizado.id);

      // Notificar al usuario
      await prisma.notificacion.create({
        data: {
          usuarioId: pago.usuarioId,
          tipo: 'pago',
          titulo: 'Pago confirmado',
          mensaje: `Tu pago de S/. ${pago.monto} ha sido confirmado. Ya puedes acceder a tu contenido.`,
          urlAccion: pago.tipoPago === 'matricula' ? '/cursos' : `/cursos/${pago.idReferencia}`
        }
      });

      return sendSuccess(res, pagoActualizado, 'Pago aprobado exitosamente');
    } else if (accion === 'rechazar') {
      // Rechazar pago
      if (!razonRechazo) {
        return sendError(res, 'Debe proporcionar una razón de rechazo', 400);
      }

      const pagoActualizado = await prisma.pago.update({
        where: { id: parseInt(id) },
        data: {
          estado: 'fallido',
          validadoPorId: adminId,
          fechaValidacion: new Date(),
          razonRechazo
        }
      });

      // Notificar al usuario
      await prisma.notificacion.create({
        data: {
          usuarioId: pago.usuarioId,
          tipo: 'pago',
          titulo: 'Pago rechazado',
          mensaje: `Tu pago fue rechazado. Razón: ${razonRechazo}. Por favor, verifica tus datos e intenta nuevamente.`,
          urlAccion: `/pagos/${pago.id}`
        }
      });

      return sendSuccess(res, pagoActualizado, 'Pago rechazado');
    } else {
      return sendError(res, 'Acción no válida', 400);
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Listar pagos pendientes de validación (Admin)
 */
export const listarPagosPendientesValidacion = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [pagos, total] = await Promise.all([
      prisma.pago.findMany({
        where: { estado: 'pendiente_validacion' },
        skip,
        take: Number(limit),
        include: {
          usuario: {
            select: {
              nombres: true,
              apellidos: true,
              email: true,
              dni: true
            }
          }
        },
        orderBy: { fechaPago: 'desc' }
      }),
      prisma.pago.count({ where: { estado: 'pendiente_validacion' } })
    ]);

    return sendSuccess(res, {
      pagos,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener historial de pagos del usuario
 */
export const obtenerMiHistorialPagos = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const { tipoPago, estado } = req.query;

    const where: any = { usuarioId };
    
    if (tipoPago) where.tipoPago = tipoPago;
    if (estado) where.estado = estado;

    const pagos = await prisma.pago.findMany({
      where,
      orderBy: { fechaPago: 'desc' },
      select: {
        id: true,
        codigoTransaccion: true,
        tipoPago: true,
        monto: true,
        comision: true,
        montoTotal: true,
        metodoPago: true,
        estado: true,
        numeroOperacion: true,
        comprobanteUrl: true,
        fechaPago: true,
        fechaValidacion: true,
        razonRechazo: true
      }
    });

    // Estadísticas
    const estadisticas = {
      totalPagado: pagos
        .filter(p => p.estado === 'completado')
        .reduce((sum, p) => sum + Number(p.montoTotal), 0),
      pagosCompletados: pagos.filter(p => p.estado === 'completado').length,
      pagosPendientes: pagos.filter(p => p.estado === 'pendiente_validacion').length,
      pagosRechazados: pagos.filter(p => p.estado === 'fallido').length
    };

    return sendSuccess(res, { pagos, estadisticas });
  } catch (error) {
    throw error;
  }
};


export const iniciarPagoManualMultiple = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const {
      monto,
      metodoPago: metodoPagoInput,
      numeroOperacion,
      fechaOperacion,
      inscripcionesIds // Array de IDs de inscripciones
    } = req.body;

    console.log('📦 Body recibido (múltiple):', req.body);
    console.log('📁 Archivo recibido:', req.file);

    // Validar y convertir método de pago
    const metodoPago = validateMetodoPagoManual(metodoPagoInput);
    if (!metodoPago) {
      return sendError(res, 'Método de pago manual inválido. Use "yape" o "transferencia_bancaria"', 400);
    }

    // Validar que se haya subido el comprobante
    if (!req.file) {
      return sendError(res, 'Debe subir el comprobante de pago', 400);
    }

    if (!numeroOperacion) {
      return sendError(res, 'Debe proporcionar el número de operación', 400);
    }

    if (!inscripcionesIds) {
      return sendError(res, 'Debe proporcionar los IDs de inscripciones', 400);
    }

    // Parsear IDs de inscripciones
    let idsArray: number[];
    try {
      idsArray = JSON.parse(inscripcionesIds);
      if (!Array.isArray(idsArray) || idsArray.length === 0) {
        return sendError(res, 'IDs de inscripciones inválidos', 400);
      }
    } catch (error) {
      return sendError(res, 'Formato de IDs de inscripciones inválido', 400);
    }

    // Verificar que todas las inscripciones existan y sean del usuario
    const inscripciones = await prisma.inscripcionCurso.findMany({
      where: {
        id: { in: idsArray },
        usuarioId,
        estadoPago: 'pendiente'
      },
      select: { id: true, montoCurso: true }
    });

    if (inscripciones.length !== idsArray.length) {
      const encontradosIds = inscripciones.map(i => i.id);
      const noEncontrados = idsArray.filter(id => !encontradosIds.includes(id));
      console.log('❌ Inscripciones no encontradas:', noEncontrados);
      return sendError(res, `Algunas inscripciones no fueron encontradas o ya están pagadas: ${noEncontrados.join(', ')}`, 400);
    }

    // Verificar que el monto coincida
    const montoTotalInscripciones = inscripciones.reduce((sum, insc) => 
      sum + Number(insc.montoCurso || 0), 0
    );
    
    if (Math.abs(montoTotalInscripciones - parseFloat(monto)) > 0.01) {
      console.log('⚠️ Monto no coincide:', montoTotalInscripciones, 'vs', monto);
      return sendError(res, `El monto enviado (${monto}) no coincide con el total de las inscripciones (${montoTotalInscripciones})`, 400);
    }

    // Verificar que no existan pagos ya registrados para estas inscripciones
    const pagosExistentes = await prisma.pago.findMany({
      where: {
        tipoPago: 'curso',
        idReferencia: { in: idsArray },
        usuarioId,
        estado: { in: ['pendiente_validacion', 'completado'] }
      },
      select: { idReferencia: true }
    });

    if (pagosExistentes.length > 0) {
      const idsConPago = pagosExistentes.map(p => p.idReferencia);
      return sendError(res, `Ya existen pagos registrados para algunas inscripciones: ${idsConPago.join(', ')}`, 400);
    }

    // Subir comprobante a Cloudinary
    let comprobanteUrl: string;
    let comprobantePublicId: string;
    
    try {
      const resultado = await uploadToCloudinary(
        req.file, 
        'ministerio-laico/comprobantes-pago-multiple'
      );
      comprobanteUrl = resultado.url;
      comprobantePublicId = resultado.publicId;
      
      console.log('✅ Comprobante subido a Cloudinary:', comprobanteUrl);
    } catch (uploadError) {
      console.error('❌ Error subiendo comprobante:', uploadError);
      return sendError(res, 'Error al subir el comprobante de pago', 500);
    }

    // Usar el primer ID como referencia principal
    const idReferenciaPrincipal = idsArray[0];

    // Generar código de transacción
    const codigoTransaccion = `MULTI-${metodoPago.toUpperCase()}-${Date.now()}-${usuarioId}`;

    // Crear registro de pago
    const pago = await prisma.pago.create({
      data: {
        usuarioId,
        tipoPago: 'curso',
        idReferencia: idReferenciaPrincipal, // Primer ID como referencia
        codigoTransaccion,
        monto: parseFloat(monto),
        comision: 0,
        montoTotal: parseFloat(monto),
        metodoPago,
        estado: 'pendiente_validacion',
        comprobanteUrl,
        numeroOperacion,
        fechaOperacion: fechaOperacion ? new Date(fechaOperacion) : new Date(),
        detallesPago: {
          navegador: req.get('User-Agent'),
          ip: req.ip,
          comprobantePublicId,
          inscripcionesIds: idsArray, // Guardar todos los IDs
          cantidadCursos: idsArray.length,
          esPagoMultiple: true
        }
      }
    });

    console.log('✅ Pago múltiple creado exitosamente:', pago.id, 'para', idsArray.length, 'cursos');

    // Actualizar todas las inscripciones
    await prisma.inscripcionCurso.updateMany({
      where: {
        id: { in: idsArray },
        usuarioId
      },
      data: {
        estadoPago: 'pagado',
        metodoPago,
        referenciaPago: codigoTransaccion,
        fechaPago: new Date(),
        estadoCurso: 'en_progreso',
        fechaInicio: new Date()
      }
    });

    console.log(`✅ ${idsArray.length} inscripciones actualizadas a pagadas`);

    // Notificar a administradores
    const admins = await prisma.usuario.findMany({
      where: { tipoUsuario: 'administrador', estado: 'activo' },
      select: { id: true }
    });

    await Promise.all(
      admins.map(admin =>
        prisma.notificacion.create({
          data: {
            usuarioId: admin.id,
            tipo: 'pago',
            titulo: 'Nuevo pago múltiple pendiente',
            mensaje: `Hay un nuevo pago ${metodoPago} por ${idsArray.length} cursos (S/. ${monto}) esperando validación`,
            urlAccion: `/admin/pagos/${pago.id}`
          }
        })
      )
    );

    // Notificar al usuario
    await prisma.notificacion.create({
      data: {
        usuarioId,
        tipo: 'pago',
        titulo: 'Pago múltiple registrado',
        mensaje: `Tu pago por ${idsArray.length} cursos (S/. ${monto}) está siendo validado. Los cursos estarán disponibles pronto.`,
        urlAccion: `/pagos/${pago.id}`
      }
    });

    return sendCreated(
      res,
      {
        pagoId: pago.id,
        codigoTransaccion: pago.codigoTransaccion,
        estado: pago.estado,
        comprobanteUrl: pago.comprobanteUrl,
        cursosActualizados: idsArray.length,
        cursosIds: idsArray
      },
      `Pago por ${idsArray.length} cursos registrado. Será validado en las próximas 24 horas.`
    );
  } catch (error) {
    console.error('❌ Error en iniciarPagoManualMultiple:', error);
    if (req.file) {
      // cleanupTempFile(req.file.path);
    }
    throw error;
  }
};

/**
 * Listar todos los pagos con filtros (Admin)
 */
export const listarTodosPagos = async (req: Request, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      estado, 
      tipoPago, 
      metodoPago,
      usuarioId,
      fechaDesde,
      fechaHasta 
    } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);

    // Construir filtros dinámicos
    const where: any = {};
    
    if (estado) where.estado = estado;
    if (tipoPago) where.tipoPago = tipoPago;
    if (metodoPago) where.metodoPago = metodoPago;
    if (usuarioId) where.usuarioId = parseInt(usuarioId as string);
    
    if (fechaDesde || fechaHasta) {
      where.fechaPago = {};
      if (fechaDesde) where.fechaPago.gte = new Date(fechaDesde as string);
      if (fechaHasta) where.fechaPago.lte = new Date(fechaHasta as string);
    }

    const [pagos, total] = await Promise.all([
      prisma.pago.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          usuario: {
            select: {
              nombres: true,
              apellidos: true,
              email: true,
              dni: true
            }
          },
          validadoPor: {
            select: {
              nombres: true,
              apellidos: true
            }
          }
        },
        orderBy: { fechaPago: 'desc' }
      }),
      prisma.pago.count({ where })
    ]);

    // Estadísticas generales
    const estadisticas = await prisma.pago.groupBy({
      by: ['estado'],
      _sum: {
        montoTotal: true
      },
      _count: true
    });

    return sendSuccess(res, {
      pagos,
      estadisticas,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener detalle de un pago
 */
export const obtenerDetallePago = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const usuarioId = req.user!.id;
    const esAdmin = req.user!.tipoUsuario === 'administrador';

    const pago = await prisma.pago.findUnique({
      where: { id: parseInt(id) },
      include: {
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
            email: true,
            dni: true
          }
        },
        validadoPor: {
          select: {
            nombres: true,
            apellidos: true
          }
        }
      }
    });

    if (!pago) {
      return sendError(res, 'Pago no encontrado', 404);
    }

    // Verificar permisos
    if (!esAdmin && pago.usuarioId !== usuarioId) {
      return sendError(res, 'No tienes permiso para ver este pago', 403);
    }

    return sendSuccess(res, pago);
  } catch (error) {
    throw error;
  }
};