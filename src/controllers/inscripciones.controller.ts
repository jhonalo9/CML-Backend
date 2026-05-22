// src/controllers/inscripciones.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendSuccess, sendError, sendCreated } from '../utils/response.utils';

const prisma = new PrismaClient();

/**
 * Inscribirse a un curso
 */
export const inscribirseACurso = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const { cursoId } = req.body;

    const curso = await prisma.curso.findUnique({
      where: { id: cursoId }
    });

    if (!curso) {
      return sendError(res, 'Curso no encontrado', 404);
    }

    const matricula = await prisma.matricula.findFirst({
      where: {
        usuarioId,
        estadoPago: 'pagado',
        activa: true
      }
    });

    if (!matricula) {
      return sendError(res, 'Debes pagar la matrícula primero', 400);
    }

    const inscripcionExistente = await prisma.inscripcionCurso.findFirst({
      where: { usuarioId, cursoId }
    });

    if (inscripcionExistente) {
      return sendError(res, 'Ya estás inscrito en este curso', 400);
    }

    const inscripcion = await prisma.inscripcionCurso.create({
      data: {
        usuarioId,
        matriculaId: matricula.id,
        cursoId,
        montoCurso: curso.precio,
        estadoPago: 'pendiente'
      },
      include: {
        curso: {
          select: {
            nombre: true,
            codigoCurso: true,
            precio: true
          }
        }
      }
    });

    const metodosPago = await prisma.configuracionPago.findMany({
      where: { activo: true },
      select: {
        metodoPago: true,
        comisionPorcentaje: true,
        comisionFija: true
      }
    });

    return sendCreated(
      res,
      {
        inscripcion,
        metodosPago,
        mensaje: 'Inscripción creada. Selecciona un método de pago para continuar.'
      },
      'Inscripción creada exitosamente'
    );
  } catch (error) {
    throw error;
  }
};

export const obtenerMisInscripciones = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;

    const inscripciones = await prisma.inscripcionCurso.findMany({
      where: { usuarioId },
      include: {
        curso: {
          select: {
            id: true,
            nombre: true,
            codigoCurso: true,
            numeroOrden: true,
            imagenPortada: true,
            totalUnidades: true
          }
        },
        matricula: {
          select: {
            codigoMatricula: true
          }
        }
      },
      orderBy: { fechaInscripcion: 'desc' }
    });

    return sendSuccess(res, inscripciones);
  } catch (error) {
    throw error;
  }
};

export const obtenerCursosDisponibles = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;

    const inscripciones = await prisma.inscripcionCurso.findMany({
      where: { usuarioId },
      select: { cursoId: true }
    });

    const cursosInscritos = inscripciones.map((i: any) => i.cursoId);

    const cursosDisponibles = await prisma.curso.findMany({
      where: {
        esCurricular: true,
        activo: true,
        id: { notIn: cursosInscritos }
      },
      include: {
        profesores: {
          where: { esPrincipal: true },
          include: {
            profesor: {
              select: {
                nombres: true,
                apellidos: true
              }
            }
          }
        },
        _count: {
          select: {
            unidades: true,
            evaluaciones: true,
            inscripciones: true
          }
        }
      },
      orderBy: { numeroOrden: 'asc' }
    });

    return sendSuccess(res, cursosDisponibles);
  } catch (error) {
    throw error;
  }
};

export const obtenerProgresoGeneral = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;

    const inscripciones = await prisma.inscripcionCurso.findMany({
      where: {
        usuarioId,
        estadoPago: 'pagado'
      },
      include: {
        curso: {
          select: {
            nombre: true,
            numeroOrden: true
          }
        }
      }
    });

    const cursosCompletados = inscripciones.filter((i: any) => i.aprobado).length;
    const totalCursos = 12;
    const progresoGeneral = Math.round((cursosCompletados / totalCursos) * 100);

    const estadisticas = {
      cursosInscritos: inscripciones.length,
      cursosEnProgreso: inscripciones.filter((i: any) => i.estadoCurso === 'en_progreso').length,
      cursosCompletados,
      cursosReprobados: inscripciones.filter((i: any) => i.estadoCurso === 'reprobado').length,
      progresoGeneral,
      puedeObtenerCertificado: cursosCompletados === 12,
      cursos: inscripciones.map((i: any) => ({
        nombre: i.curso.nombre,
        numeroOrden: i.curso.numeroOrden,
        progreso: i.progresoPorcentaje,
        calificacion: i.calificacionFinal,
        estado: i.estadoCurso,
        aprobado: i.aprobado
      }))
    };

    return sendSuccess(res, estadisticas);
  } catch (error) {
    throw error;
  }
};

/**
 * CORREGIDO: Obtener detalle de inscripción
 */
export const obtenerDetalleInscripcion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user!.id;

    // ✅ CORRECCIÓN: Convertir id a número antes de usar
    const inscripcionId = parseInt(id, 10);
    
    if (isNaN(inscripcionId)) {
      return sendError(res, 'ID de inscripción inválido', 400);
    }

    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        id: inscripcionId, // ✅ Ahora es un número
        usuarioId
      },
      include: {
        curso: {
          include: {
            unidades: {
              include: {
                contenidos: {
                  where: { activo: true }
                }
              }
            },
            evaluaciones: true
          }
        },
        progresosContenido: true,
        resultadosEvaluacion: {
          include: {
            evaluacion: {
              select: {
                titulo: true,
                tipo: true
              }
            }
          }
        }
      }
    });

    if (!inscripcion) {
      return sendError(res, 'Inscripción no encontrada', 404);
    }

    return sendSuccess(res, inscripcion);
  } catch (error) {
    throw error;
  }
};

export const confirmarPagoCurso = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { metodoPago, referenciaPago } = req.body;
    const usuarioId = req.user!.id;

    const inscripcionId = parseInt(id, 10);
    if (isNaN(inscripcionId)) {
      return sendError(res, 'ID de inscripción inválido', 400);
    }

    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        id: inscripcionId,
        usuarioId
      },
      include: {
        curso: true
      }
    });

    if (!inscripcion) {
      return sendError(res, 'Inscripción no encontrada', 404);
    }

    if (inscripcion.estadoPago === 'pagado') {
      return sendError(res, 'El curso ya fue pagado', 400);
    }

    const metodosValidos = ['yape', 'transferencia_bancaria', 'stripe', 'paypal', 'mercado_pago'];
    if (!metodosValidos.includes(metodoPago)) {
      return sendError(res, 'Método de pago no válido', 400);
    }

    const inscripcionActualizada = await prisma.inscripcionCurso.update({
      where: { id: inscripcionId },
      data: {
        estadoPago: 'pagado',
        metodoPago: metodoPago as any,
        referenciaPago,
        fechaPago: new Date(),
        estadoCurso: 'en_progreso',
        fechaInicio: new Date()
      }
    });

    const codigoTransaccion = `CURSO-${metodoPago.toUpperCase()}-${Date.now()}-${usuarioId}`;

    await prisma.pago.create({
      data: {
        usuarioId,
        tipoPago: 'curso',
        idReferencia: inscripcion.id,
        codigoTransaccion,
        monto: inscripcion.montoCurso,
        comision: 0,
        montoTotal: inscripcion.montoCurso,
        metodoPago: metodoPago as any,
        estado: 'completado',
        referenciaExterna: referenciaPago
      }
    });

    await prisma.notificacion.create({
      data: {
        usuarioId,
        tipo: 'pago',
        titulo: 'Pago de curso confirmado',
        mensaje: `Tu inscripción al curso "${inscripcion.curso.nombre}" ha sido confirmada. ¡Ya puedes comenzar!`,
        urlAccion: `/cursos/${inscripcion.cursoId}`
      }
    });

    return sendSuccess(
      res,
      inscripcionActualizada,
      'Pago confirmado. Ya puedes acceder al curso.'
    );
  } catch (error) {
    throw error;
  }
};

export const confirmarPagoMultiplesCursos = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const { inscripcionIds, metodoPago, referenciaPago } = req.body;

    const metodosValidos = ['yape', 'transferencia_bancaria', 'stripe', 'paypal', 'mercado_pago'];
    if (!metodosValidos.includes(metodoPago)) {
      return sendError(res, 'Método de pago no válido', 400);
    }

    if (!inscripcionIds || !Array.isArray(inscripcionIds) || inscripcionIds.length === 0) {
      return sendError(res, 'Debe especificar las inscripciones a pagar', 400);
    }

    if (!referenciaPago) {
      return sendError(res, 'Referencia de pago es requerida', 400);
    }

    const inscripciones = await prisma.inscripcionCurso.findMany({
      where: {
        id: { in: inscripcionIds },
        usuarioId,
        estadoPago: 'pendiente'
      },
      include: {
        curso: {
          select: {
            nombre: true,
            precio: true
          }
        }
      }
    });

    if (inscripciones.length !== inscripcionIds.length) {
      return sendError(res, 'Una o más inscripciones no existen o ya fueron pagadas', 404);
    }

    const montoTotal = inscripciones.reduce((total, insc) => {
      return total + Number(insc.montoCurso);
    }, 0);

    const codigoTransaccion = `MULTI-${metodoPago.toUpperCase()}-${Date.now()}-${usuarioId}`;

    const resultado = await prisma.$transaction(async (tx) => {
      const inscripcionesActualizadas = await Promise.all(
        inscripciones.map((inscripcion) =>
          tx.inscripcionCurso.update({
            where: { id: inscripcion.id },
            data: {
              estadoPago: 'pagado',
              metodoPago: metodoPago as any,
              referenciaPago: referenciaPago,
              fechaPago: new Date(),
              estadoCurso: 'en_progreso',
              fechaInicio: new Date()
            }
          })
        )
      );

      const pago = await tx.pago.create({
        data: {
          usuarioId,
          tipoPago: 'curso',
          idReferencia: inscripciones[0].id,
          codigoTransaccion,
          monto: montoTotal,
          comision: 0,
          montoTotal: montoTotal,
          metodoPago: metodoPago as any,
          estado: 'completado',
          referenciaExterna: referenciaPago,
          detallesPago: {
            inscripcionesIds: inscripcionIds,
            cantidadCursos: inscripciones.length,
            descripcion: `Pago consolidado para ${inscripciones.length} cursos`
          }
        }
      });

      const notificaciones = await Promise.all(
        inscripciones.map((inscripcion) =>
          tx.notificacion.create({
            data: {
              usuarioId,
              tipo: 'pago',
              titulo: 'Pago de curso confirmado',
              mensaje: `Tu inscripción al curso "${inscripcion.curso.nombre}" ha sido confirmada. ¡Ya puedes comenzar!`,
              urlAccion: `/cursos/${inscripcion.cursoId}`,
              leida: false
            }
          })
        )
      );

      return { inscripcionesActualizadas, pago, notificaciones };
    });

    return sendSuccess(
      res,
      {
        mensaje: `Pago confirmado para ${inscripciones.length} cursos`,
        montoTotal,
        codigoTransaccion,
        cursos: inscripciones.map(i => ({
          nombre: i.curso.nombre,
          precio: i.curso.precio
        }))
      },
      '¡Pago confirmado! Ya puedes acceder a todos tus cursos.'
    );
  } catch (error) {
    console.error('Error confirmando pago múltiple:', error);
    throw error;
  }
};

export const cancelarInscripcion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user!.id;

    const inscripcionId = parseInt(id, 10);
    if (isNaN(inscripcionId)) {
      return sendError(res, 'ID de inscripción inválido', 400);
    }

    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        id: inscripcionId,
        usuarioId
      }
    });

    if (!inscripcion) {
      return sendError(res, 'Inscripción no encontrada', 404);
    }

    if (inscripcion.estadoPago === 'pagado') {
      return sendError(res, 'No puedes cancelar una inscripción ya pagada', 400);
    }

    await prisma.inscripcionCurso.update({
      where: { id: inscripcionId },
      data: { estadoPago: 'cancelado' }
    });

    return sendSuccess(res, null, 'Inscripción cancelada exitosamente');
  } catch (error) {
    throw error;
  }
};

export const listarInscripcionesCurso = async (req: Request, res: Response) => {
  try {
    const { cursoId } = req.params;

    const cursoIdNum = parseInt(cursoId, 10);
    if (isNaN(cursoIdNum)) {
      return sendError(res, 'ID de curso inválido', 400);
    }

    const inscripciones = await prisma.inscripcionCurso.findMany({
      where: {
        cursoId: cursoIdNum,
        estadoPago: 'pagado'
      },
      include: {
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
            email: true,
            dni: true,
            fotoPerfil: true
          }
        }
      },
      orderBy: { fechaInscripcion: 'desc' }
    });

    return sendSuccess(res, inscripciones);
  } catch (error) {
    throw error;
  }
};

export const calcularDescuentoMultiples = async (req: Request, res: Response) => {
  try {
    const { cursoIds } = req.body;

    if (!cursoIds || !Array.isArray(cursoIds) || cursoIds.length === 0) {
      return sendError(res, 'Debe seleccionar al menos un curso', 400);
    }

    const cursos = await prisma.curso.findMany({
      where: {
        id: { in: cursoIds },
        esCurricular: true,
        activo: true
      }
    });

    if (cursos.length !== cursoIds.length) {
      return sendError(res, 'Uno o más cursos no existen', 404);
    }

    const montoTotal = cursos.reduce((total, curso) => total + Number(curso.precio), 0);

    let descuento = 0;
    let porcentajeDescuento = 0;
    
    if (cursoIds.length >= 12) {
      descuento = montoTotal * 0.10;
      porcentajeDescuento = 10;
    } else if (cursoIds.length >= 6) {
      descuento = montoTotal * 0.05;
      porcentajeDescuento = 5;
    }

    const montoConDescuento = montoTotal - descuento;

    return sendSuccess(res, {
      cantidadCursos: cursos.length,
      subtotal: montoTotal,
      descuento,
      porcentajeDescuento,
      montoConDescuento,
      cursos: cursos.map(curso => ({
        id: curso.id,
        nombre: curso.nombre,
        precio: curso.precio
      }))
    });
  } catch (error) {
    console.error('Error calculando descuento:', error);
    throw error;
  }
};

export const inscribirseACursosMultiples = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const { cursoIds } = req.body;

    if (!cursoIds || !Array.isArray(cursoIds) || cursoIds.length === 0) {
      return sendError(res, 'Debe seleccionar al menos un curso', 400);
    }

    const MAX_CURSOS_POR_INSCRIPCION = 12;
    if (cursoIds.length > MAX_CURSOS_POR_INSCRIPCION) {
      return sendError(res, `No puedes inscribirte a más de ${MAX_CURSOS_POR_INSCRIPCION} cursos a la vez`, 400);
    }

    const matricula = await prisma.matricula.findFirst({
      where: {
        usuarioId,
        estadoPago: 'pagado',
        activa: true
      }
    });

    if (!matricula) {
      return sendError(res, 'Debes pagar la matrícula primero', 400);
    }

    const cursos = await prisma.curso.findMany({
      where: {
        id: { in: cursoIds },
        esCurricular: true,
        activo: true
      }
    });

    if (cursos.length !== cursoIds.length) {
      const cursosEncontrados = cursos.map(c => c.id);
      const cursosNoEncontrados = cursoIds.filter(id => !cursosEncontrados.includes(id));
      return sendError(res, `Los siguientes cursos no existen o no están disponibles: ${cursosNoEncontrados.join(', ')}`, 404);
    }

    const inscripcionesExistentes = await prisma.inscripcionCurso.findMany({
      where: {
        usuarioId,
        cursoId: { in: cursoIds }
      },
      select: { cursoId: true }
    });

    if (inscripcionesExistentes.length > 0) {
      const cursosYaInscritos = inscripcionesExistentes.map(i => i.cursoId);
      return sendError(res, `Ya estás inscrito en los siguientes cursos: ${cursosYaInscritos.join(', ')}`, 400);
    }

    const inscripcionesActivas = await prisma.inscripcionCurso.count({
      where: {
        usuarioId,
        estadoPago: 'pagado',
        estadoCurso: { in: ['en_progreso', 'no_iniciado'] }
      }
    });

    const MAX_CURSOS_ACTIVOS = 12;
    if (inscripcionesActivas + cursoIds.length > MAX_CURSOS_ACTIVOS) {
      return sendError(res, `No puedes tener más de ${MAX_CURSOS_ACTIVOS} cursos activos simultáneamente`, 400);
    }

    const inscripcionesCreadas = await prisma.$transaction(
      cursos.map((curso) => {
        return prisma.inscripcionCurso.create({
          data: {
            usuarioId,
            matriculaId: matricula.id,
            cursoId: curso.id,
            montoCurso: curso.precio,
            estadoPago: 'pendiente',
            estadoCurso: 'no_iniciado'
          },
          include: {
            curso: {
              select: {
                nombre: true,
                codigoCurso: true,
                precio: true
              }
            }
          }
        });
      })
    );

    const montoTotal = cursos.reduce((total, curso) => {
      return total + Number(curso.precio);
    }, 0);

    let descuento = 0;
    let porcentajeDescuento = 0;
    
    if (cursoIds.length >= 12) {
      descuento = montoTotal * 0.10;
      porcentajeDescuento = 10;
    } else if (cursoIds.length >= 6) {
      descuento = montoTotal * 0.05;
      porcentajeDescuento = 5;
    }

    const montoConDescuento = montoTotal - descuento;

    const metodosPago = await prisma.configuracionPago.findMany({
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

    const metodosProcesados = metodosPago.map(metodo => {
      let comision = 0;
      if (metodo.comisionPorcentaje) {
        comision = montoConDescuento * (Number(metodo.comisionPorcentaje) / 100);
      }
      if (metodo.comisionFija) {
        comision += Number(metodo.comisionFija);
      }

      return {
        ...metodo,
        esManual: ['yape', 'transferencia_bancaria'].includes(metodo.metodoPago),
        comision: comision.toFixed(2),
        montoFinal: (montoConDescuento + comision).toFixed(2)
      };
    });

    return sendCreated(
      res,
      {
        inscripciones: inscripcionesCreadas,
        resumen: {
          cantidadCursos: cursos.length,
          subtotal: montoTotal,
          descuento,
          porcentajeDescuento,
          montoConDescuento,
          metodosPago: metodosProcesados
        },
        mensaje: `Inscripción exitosa a ${cursos.length} cursos. Selecciona tu método de pago preferido.`
      },
      'Inscripciones creadas exitosamente'
    );
  } catch (error) {
    console.error('Error en inscripción múltiple:', error);
    throw error;
  }
};

/**
 * ✅ CORREGIDO: Obtener inscripciones pendientes de pago
 */
export const obtenerInscripcionesPendientesPago = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;

    const inscripcionesPendientes = await prisma.inscripcionCurso.findMany({
      where: {
        usuarioId,
        estadoPago: 'pendiente'
      },
      include: {
        curso: {
          select: {
            nombre: true,
            codigoCurso: true,
            precio: true,
            imagenPortada: true,
            totalUnidades: true
          }
        }
      },
      orderBy: { fechaInscripcion: 'desc' }
    });

    const subtotal = inscripcionesPendientes.reduce((total, insc) => {
      return total + Number(insc.montoCurso);
    }, 0);

    let descuento = 0;
    let porcentajeDescuento = 0;
    
    if (inscripcionesPendientes.length >= 12) {
      descuento = subtotal * 0.10;
      porcentajeDescuento = 10;
    } else if (inscripcionesPendientes.length >= 6) {
      descuento = subtotal * 0.05;
      porcentajeDescuento = 5;
    }

    const montoConDescuento = subtotal - descuento;

    const metodosPago = await prisma.configuracionPago.findMany({
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

    const metodosProcesados = metodosPago.map(metodo => {
      let comision = 0;
      if (metodo.comisionPorcentaje) {
        comision = montoConDescuento * (Number(metodo.comisionPorcentaje) / 100);
      }
      if (metodo.comisionFija) {
        comision += Number(metodo.comisionFija);
      }

      return {
        ...metodo,
        esManual: ['yape', 'transferencia_bancaria'].includes(metodo.metodoPago),
        comision: comision.toFixed(2),
        montoFinal: (montoConDescuento + comision).toFixed(2)
      };
    });

    return sendSuccess(res, {
      inscripciones: inscripcionesPendientes,
      resumen: {
        cantidad: inscripcionesPendientes.length,
        subtotal,
        descuento,
        porcentajeDescuento,
        montoConDescuento,
        metodosPago: metodosProcesados,
        puedePagarMultiples: inscripcionesPendientes.length > 0
      }
    });
  } catch (error) {
    console.error('Error obteniendo inscripciones pendientes:', error);
    throw error;
  }
};