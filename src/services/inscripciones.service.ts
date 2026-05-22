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

    // Verificar que el curso existe
    const curso = await prisma.curso.findUnique({
      where: { id: cursoId }
    });

    if (!curso) {
      return sendError(res, 'Curso no encontrado', 404);
    }

    // Verificar que tiene matrícula pagada
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

    // Verificar que no esté ya inscrito
    const inscripcionExistente = await prisma.inscripcionCurso.findFirst({
      where: {
        usuarioId,
        cursoId
      }
    });

    if (inscripcionExistente) {
      return sendError(res, 'Ya estás inscrito en este curso', 400);
    }

    // Crear inscripción
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

    // TODO: Generar enlace de pago

    return sendCreated(
      res,
      inscripcion,
      'Inscripción creada. Procede al pago para acceder al curso.'
    );
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener mis inscripciones
 */
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

/**
 * Obtener detalles de inscripción
 */
export const obtenerDetalleInscripcion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user!.id;

    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        id: parseInt(id),
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

/**
 * Confirmar pago de curso
 */
export const confirmarPagoCurso = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { metodoPago, referenciaPago } = req.body;
    const usuarioId = req.user!.id;

    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        id: parseInt(id),
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

    // Validar método de pago
    const metodosValidos = ['yape', 'transferencia_bancaria', 'stripe', 'paypal', 'mercado_pago'];
    if (!metodosValidos.includes(metodoPago)) {
      return sendError(res, 'Método de pago no válido', 400);
    }

    // Actualizar inscripción
    const inscripcionActualizada = await prisma.inscripcionCurso.update({
      where: { id: parseInt(id) },
      data: {
        estadoPago: 'pagado',
        metodoPago: metodoPago as any,
        referenciaPago,
        fechaPago: new Date(),
        estadoCurso: 'en_progreso',
        fechaInicio: new Date()
      }
    });

    // Generar código de transacción único
    const codigoTransaccion = `CURSO-${metodoPago.toUpperCase()}-${Date.now()}-${usuarioId}`;

    // Crear registro de pago con todos los campos obligatorios
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

    // Notificación
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

/**
 * Confirmar pago múltiple de cursos (función actualizada)
 * Reemplazar en tu archivo inscripciones.controller.ts
 */
export const confirmarPagoMultiplesCursos = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const { inscripcionIds, metodoPago, referenciaPago } = req.body;

    // Validar método de pago
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

    // Verificar que todas las inscripciones pertenezcan al usuario
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

    // Calcular monto total
    const montoTotal = inscripciones.reduce((total, insc) => {
      return total + Number(insc.montoCurso);
    }, 0);

    // Generar código de transacción único
    const codigoTransaccion = `MULTI-${metodoPago.toUpperCase()}-${Date.now()}-${usuarioId}`;

    // Crear transacción para actualizar todas las inscripciones
    const resultado = await prisma.$transaction(async (tx) => {
      // Actualizar cada inscripción
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

      // Crear un solo registro de pago consolidado
      const pago = await tx.pago.create({
        data: {
          usuarioId,
          tipoPago: 'curso',
          idReferencia: inscripciones[0].id, // Primera inscripción como referencia
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

      // Crear notificaciones para cada curso
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

/**
 * Obtener cursos disponibles para inscripción
 */
export const obtenerCursosDisponibles = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;

    // Obtener cursos en los que YA está inscrito
    const inscripciones = await prisma.inscripcionCurso.findMany({
      where: { usuarioId },
      select: { cursoId: true }
    });

    const cursosInscritos = inscripciones.map((i:any) => i.cursoId);

    // Obtener cursos curriculares NO inscritos
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
        }
      },
      orderBy: { numeroOrden: 'asc' }
    });

    return sendSuccess(res, cursosDisponibles);
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener progreso general del estudiante
 */
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

    const cursosCompletados = inscripciones.filter((i:any) => i.aprobado).length;
    const totalCursos = 12;
    const progresoGeneral = Math.round((cursosCompletados / totalCursos) * 100);

    const estadisticas = {
      cursosInscritos: inscripciones.length,
      cursosEnProgreso: inscripciones.filter((i:any) => i.estadoCurso === 'en_progreso').length,
      cursosCompletados,
      cursosReprobados: inscripciones.filter((i:any) => i.estadoCurso === 'reprobado').length,
      progresoGeneral,
      puedeObtenerCertificado: cursosCompletados === 12,
      cursos: inscripciones.map((i:any) => ({
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
 * Cancelar inscripción (antes de pagar)
 */
export const cancelarInscripcion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user!.id;

    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        id: parseInt(id),
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
      where: { id: parseInt(id) },
      data: { estadoPago: 'cancelado' }
    });

    return sendSuccess(res, null, 'Inscripción cancelada exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Listar inscripciones de un curso (Admin/Profesor)
 */
export const listarInscripcionesCurso = async (req: Request, res: Response) => {
  try {
    const { cursoId } = req.params;

    const inscripciones = await prisma.inscripcionCurso.findMany({
      where: {
        cursoId: parseInt(cursoId),
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