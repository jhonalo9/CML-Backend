import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendSuccess, sendError, sendCreated } from '../utils/response.utils';
import { crearEvaluacionSchema, crearPreguntaSchema } from '../validators/curso.validator';

const prisma = new PrismaClient();

/**
 * Crear evaluación (Admin/Profesor)
 */
export const crearEvaluacion = async (req: Request, res: Response) => {
  try {
    const datosValidados = crearEvaluacionSchema.parse(req.body);

    const evaluacion = await prisma.evaluacion.create({
      data: {
        ...datosValidados,
        fechaDisponible: datosValidados.fechaDisponible ? new Date(datosValidados.fechaDisponible) : undefined,
        fechaCierre: datosValidados.fechaCierre ? new Date(datosValidados.fechaCierre) : undefined
      }
    });

    return sendCreated(res, evaluacion, 'Evaluación creada exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Agregar pregunta a evaluación
 */
export const agregarPregunta = async (req: Request, res: Response) => {
  try {
    const datosValidados = crearPreguntaSchema.parse(req.body);

    const pregunta = await prisma.preguntaEvaluacion.create({
      data: datosValidados
    });

    return sendCreated(res, pregunta, 'Pregunta agregada exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener evaluaciones de un curso
 */
export const obtenerEvaluacionesCurso = async (req: Request, res: Response) => {
  try {
    const { cursoId } = req.params;

    const evaluaciones = await prisma.evaluacion.findMany({
      where: {
        cursoId: parseInt(cursoId),
        activa: true
      },
      include: {
        unidad: {
          select: {
            titulo: true,
            numeroUnidad: true
          }
        },
        _count: {
          select: {
            preguntas: true
          }
        }
      },
      orderBy: { numeroEvaluacion: 'asc' }
    });

    return sendSuccess(res, evaluaciones);
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener evaluación con preguntas
 */
export const obtenerEvaluacion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user!.id;

    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id: parseInt(id) },
      include: {
        curso: true,
        unidad: true,
        preguntas: {
          orderBy: { orden: 'asc' }
        }
      }
    });

    if (!evaluacion) {
      return sendError(res, 'Evaluación no encontrada', 404);
    }

    // Verificar que el estudiante esté inscrito
    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        usuarioId,
        cursoId: evaluacion.cursoId,
        estadoPago: 'pagado'
      }
    });

    if (!inscripcion && req.user!.tipoUsuario === 'estudiante') {
      return sendError(res, 'No tienes acceso a esta evaluación', 403);
    }

    // Verificar intentos disponibles
    const intentosRealizados = await prisma.resultadoEvaluacion.count({
      where: {
        inscripcionCursoId: inscripcion?.id,
        evaluacionId: evaluacion.id
      }
    });

    if (intentosRealizados >= evaluacion.intentosPermitidos && inscripcion) {
      return sendError(res, 'Has agotado tus intentos para esta evaluación', 400);
    }

    // Ocultar respuestas correctas para estudiantes
    if (req.user!.tipoUsuario === 'estudiante') {
      evaluacion.preguntas = evaluacion.preguntas.map((p:any) => ({
        ...p,
        respuestaCorrecta: null
      }));
    }

    return sendSuccess(res, {
      ...evaluacion,
      intentosDisponibles: evaluacion.intentosPermitidos - intentosRealizados
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Enviar respuestas de evaluación
 */
export const enviarRespuestas = async (req: Request, res: Response) => {
  try {
    const { evaluacionId } = req.params;
    const { respuestas, tiempoEmpleadoMinutos } = req.body;
    const usuarioId = req.user!.id;

    // Obtener evaluación
    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id: parseInt(evaluacionId) },
      include: {
        preguntas: true
      }
    });

    if (!evaluacion) {
      return sendError(res, 'Evaluación no encontrada', 404);
    }

    // Obtener inscripción
    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        usuarioId,
        cursoId: evaluacion.cursoId,
        estadoPago: 'pagado'
      }
    });

    if (!inscripcion) {
      return sendError(res, 'No estás inscrito en este curso', 403);
    }

    // Calcular número de intento
    const intentosAnteriores = await prisma.resultadoEvaluacion.count({
      where: {
        inscripcionCursoId: inscripcion.id,
        evaluacionId: evaluacion.id
      }
    });

    if (intentosAnteriores >= evaluacion.intentosPermitidos) {
      return sendError(res, 'Has agotado tus intentos', 400);
    }

    // Calcular calificación automática (solo para preguntas cerradas)
    let puntuacionObtenida = 0;

    evaluacion.preguntas.forEach((pregunta:any) => {
      if (pregunta.tipoPregunta === 'multiple_choice' || pregunta.tipoPregunta === 'verdadero_falso') {
        const respuestaEstudiante = respuestas[pregunta.id];
        if (respuestaEstudiante === pregunta.respuestaCorrecta) {
          puntuacionObtenida += Number(pregunta.puntos);
        }
      }
    });

    const porcentaje = (puntuacionObtenida / Number(evaluacion.puntuacionMaxima)) * 100;
    const aprobado = puntuacionObtenida >= Number(evaluacion.puntuacionMinimaAprobacion);

    // Crear resultado
    const resultado = await prisma.resultadoEvaluacion.create({
      data: {
        inscripcionCursoId: inscripcion.id,
        evaluacionId: evaluacion.id,
        intentoNumero: intentosAnteriores + 1,
        respuestas: respuestas,
        puntuacionObtenida,
        porcentaje,
        aprobado,
        fechaFinalizacion: new Date(),
        tiempoEmpleadoMinutos,
        calificado: !evaluacion.preguntas.some((p:any) => p.tipoPregunta === 'desarrollo')
      }
    });

    // Notificación
    await prisma.notificacion.create({
      data: {
        usuarioId,
        tipo: 'evaluacion',
        titulo: 'Evaluación enviada',
        mensaje: `Tu evaluación "${evaluacion.titulo}" ha sido enviada. ${resultado.calificado ? `Obtuviste ${puntuacionObtenida}/${evaluacion.puntuacionMaxima}` : 'Espera la calificación del profesor.'}`,
        urlAccion: `/evaluaciones/${evaluacion.id}/resultado/${resultado.id}`
      }
    });

    return sendCreated(res, resultado, 'Evaluación enviada exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener resultado de evaluación
 */
export const obtenerResultado = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user!.id;

    const resultado = await prisma.resultadoEvaluacion.findUnique({
      where: { id: parseInt(id) },
      include: {
        evaluacion: {
          include: {
            preguntas: true
          }
        },
        inscripcionCurso: {
          include: {
            usuario: {
              select: {
                id: true,
                nombres: true,
                apellidos: true
              }
            }
          }
        },
        calificadoPor: {
          select: {
            nombres: true,
            apellidos: true
          }
        }
      }
    });

    if (!resultado) {
      return sendError(res, 'Resultado no encontrado', 404);
    }

    // Verificar permisos
    if (resultado.inscripcionCurso.usuario.id !== usuarioId && req.user!.tipoUsuario === 'estudiante') {
      return sendError(res, 'No tienes acceso a este resultado', 403);
    }

    return sendSuccess(res, resultado);
  } catch (error) {
    throw error;
  }
};

/**
 * Calificar evaluación (Profesor)
 */
export const calificarEvaluacion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { puntuacionObtenida, retroalimentacion } = req.body;
    const profesorId = req.user!.id;

    const resultado = await prisma.resultadoEvaluacion.findUnique({
      where: { id: parseInt(id) },
      include: {
        evaluacion: true,
        inscripcionCurso: {
          include: {
            usuario: true
          }
        }
      }
    });

    if (!resultado) {
      return sendError(res, 'Resultado no encontrado', 404);
    }

    const porcentaje = (puntuacionObtenida / Number(resultado.evaluacion.puntuacionMaxima)) * 100;
    const aprobado = puntuacionObtenida >= Number(resultado.evaluacion.puntuacionMinimaAprobacion);

    // Actualizar resultado
    const resultadoActualizado = await prisma.resultadoEvaluacion.update({
      where: { id: parseInt(id) },
      data: {
        puntuacionObtenida,
        porcentaje,
        aprobado,
        calificado: true,
        calificadoPorId: profesorId,
        fechaCalificacion: new Date(),
        retroalimentacionProfesor: retroalimentacion
      }
    });

    // Notificación al estudiante
    await prisma.notificacion.create({
      data: {
        usuarioId: resultado.inscripcionCurso.usuario.id,
        tipo: 'evaluacion',
        titulo: 'Evaluación calificada',
        mensaje: `Tu evaluación "${resultado.evaluacion.titulo}" ha sido calificada. Obtuviste ${puntuacionObtenida}/${resultado.evaluacion.puntuacionMaxima} (${aprobado ? 'Aprobado' : 'Reprobado'})`,
        urlAccion: `/evaluaciones/${resultado.evaluacionId}/resultado/${resultado.id}`
      }
    });

    return sendSuccess(res, resultadoActualizado, 'Evaluación calificada exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Listar evaluaciones pendientes de calificar
 */
export const listarEvaluacionesPendientes = async (req: Request, res: Response) => {
  try {
    const { cursoId } = req.query;

    const where: any = {
      calificado: false,
      evaluacion: {
        preguntas: {
          some: {
            tipoPregunta: 'desarrollo'
          }
        }
      }
    };

    if (cursoId) {
      where.evaluacion = {
        ...where.evaluacion,
        cursoId: parseInt(cursoId as string)
      };
    }

    const resultados = await prisma.resultadoEvaluacion.findMany({
      where,
      include: {
        evaluacion: {
          select: {
            titulo: true,
            tipo: true
          }
        },
        inscripcionCurso: {
          include: {
            usuario: {
              select: {
                nombres: true,
                apellidos: true,
                email: true
              }
            },
            curso: {
              select: {
                nombre: true
              }
            }
          }
        }
      },
      orderBy: { fechaFinalizacion: 'desc' }
    });

    return sendSuccess(res, resultados);
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener historial de evaluaciones del estudiante
 */
export const obtenerHistorialEvaluaciones = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const { cursoId } = req.query;

    // Obtener inscripciones
    const where: any = { usuarioId };
    if (cursoId) {
      where.cursoId = parseInt(cursoId as string);
    }

    const inscripciones = await prisma.inscripcionCurso.findMany({
      where,
      select: { id: true }
    });

    const inscripcionesIds = inscripciones.map((i:any) => i.id);

    const resultados = await prisma.resultadoEvaluacion.findMany({
      where: {
        inscripcionCursoId: { in: inscripcionesIds }
      },
      include: {
        evaluacion: {
          select: {
            titulo: true,
            tipo: true,
            puntuacionMaxima: true
          }
        },
        inscripcionCurso: {
          include: {
            curso: {
              select: {
                nombre: true
              }
            }
          }
        }
      },
      orderBy: { fechaFinalizacion: 'desc' }
    });

    return sendSuccess(res, resultados);
  } catch (error) {
    throw error;
  }
};



// En evaluaciones.controller.ts - Agrega esta función
export const obtenerNotasEstudiante = async (req: Request, res: Response) => {
  try {
    const { cursoId } = req.params;
    const usuarioId = req.user!.id;

    // Verificar que el estudiante está inscrito en el curso
    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        usuarioId,
        cursoId: parseInt(cursoId),
        estadoPago: 'pagado'
      }
    });

    if (!inscripcion) {
      return sendError(res, 'No estás inscrito en este curso', 403);
    }

    // Obtener todas las evaluaciones del curso
    const evaluaciones = await prisma.evaluacion.findMany({
      where: {
        cursoId: parseInt(cursoId),
        activa: true
      },
      select: {
        id: true,
        titulo: true,
        descripcion: true,
        tipo: true,
        puntuacionMaxima: true,
        unidad: {
          select: {
            numeroUnidad: true,
            titulo: true
          }
        }
      }
    });

    // Obtener resultados de evaluaciones para este estudiante
    const resultados = await prisma.resultadoEvaluacion.findMany({
      where: {
        inscripcionCursoId: inscripcion.id,
        evaluacion: {
          cursoId: parseInt(cursoId)
        }
      },
      include: {
        evaluacion: {
          select: {
            titulo: true,
            tipo: true,
            puntuacionMaxima: true,
            unidad: {
              select: {
                numeroUnidad: true,
                titulo: true
              }
            }
          }
        },
        calificadoPor: {
          select: {
            nombres: true,
            apellidos: true
          }
        }
      },
      orderBy: {
        fechaFinalizacion: 'desc'
      }
    });

    // Estructurar los datos por evaluación
    const notasPorEvaluacion = evaluaciones.map(evaluacion => {
      const resultado = resultados.find(r => r.evaluacionId === evaluacion.id);
      
      return {
        id: evaluacion.id,
        evaluacion: evaluacion.titulo,
        tipo: evaluacion.tipo,
        unidad: evaluacion.unidad?.titulo || 'Curso Completo',
        puntajeMaximo: Number(evaluacion.puntuacionMaxima),
        puntajeObtenido: resultado ? Number(resultado.puntuacionObtenida) : null,
        porcentaje: resultado ? Number(resultado.porcentaje) : null,
        aprobado: resultado?.aprobado,
        estado: resultado ? (resultado.calificado ? 'calificado' : 'pendiente') : 'no_realizada',
        intento: resultado?.intentoNumero || 0,
        fecha: resultado?.fechaFinalizacion,
        calificadoPor: resultado?.calificadoPor
          ? `${resultado.calificadoPor.nombres} ${resultado.calificadoPor.apellidos}`
          : null,
        retroalimentacion: resultado?.retroalimentacionProfesor
      };
    });

    // Calcular estadísticas
    const notasCalificadas = notasPorEvaluacion.filter(n => n.puntajeObtenido !== null);
    
    const estadisticas = {
      totalEvaluaciones: evaluaciones.length,
      evaluacionesRealizadas: notasCalificadas.length,
      evaluacionesPendientes: evaluaciones.length - notasCalificadas.length,
      promedio: notasCalificadas.length > 0 
        ? parseFloat((notasCalificadas.reduce((sum, n) => sum + (n.puntajeObtenido || 0), 0) / notasCalificadas.length).toFixed(2))
        : 0,
      puntajeMaximo: notasCalificadas.length > 0 
        ? Math.max(...notasCalificadas.map(n => n.puntajeObtenido || 0))
        : 0,
      puntajeMinimo: notasCalificadas.length > 0 
        ? Math.min(...notasCalificadas.map(n => n.puntajeObtenido || 0))
        : 0,
      aprobadas: notasCalificadas.filter(n => n.aprobado === true).length,
      desaprobadas: notasCalificadas.filter(n => n.aprobado === false).length,
      tasaAprobacion: notasCalificadas.length > 0
        ? Math.round((notasCalificadas.filter(n => n.aprobado === true).length / notasCalificadas.length) * 100)
        : 0
    };

    return sendSuccess(res, {
      notas: notasPorEvaluacion,
      estadisticas,
      resultadosCompletos: resultados
    });
  } catch (error) {
    console.error('Error obteniendo notas:', error);
    throw error;
  }
};

