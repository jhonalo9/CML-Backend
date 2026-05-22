import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import driveStorage from '../config/googleDriveConfig';
import { sendSuccess, sendError, sendCreated } from '../utils/response.utils';
import { crearContenidoSchema } from '../validators/curso.validator';

const prisma = new PrismaClient();

/**
 * Subir contenido a un curso
 * Puede ser usado por Admin o Profesor del curso
 */
export const subirContenido = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const tipoUsuario = req.user!.tipoUsuario;

    // Validar que hay archivo
    if (!req.file) {
      return sendError(res, 'No se proporcionó ningún archivo', 400);
    }

    // Validar datos del formulario
    const datosValidados = crearContenidoSchema.parse({
      ...req.body,
      unidadId: parseInt(req.body.unidadId),
      orden: parseInt(req.body.orden)
    });

    // Verificar que la unidad existe
    const unidad = await prisma.unidad.findUnique({
      where: { id: datosValidados.unidadId },
      include: {
        curso: {
          include: {
            profesores: {
              where: { profesorId: usuarioId }
            }
          }
        }
      }
    });

    if (!unidad) {
      return sendError(res, 'Unidad no encontrada', 404);
    }

    // Verificar permisos
    const esAdmin = tipoUsuario === 'administrador';
    const esProfesorDelCurso = unidad.curso.profesores.length > 0;

    if (!esAdmin && !esProfesorDelCurso) {
      return sendError(res, 'No tienes permisos para subir contenido a este curso', 403);
    }

    // Subir archivo a Google Drive
    const resultadoUpload = await driveStorage.uploadContenido(
      req.file.path,
      datosValidados.tipoContenido
    );

    // Determinar el enlace apropiado según el tipo de contenido
    let urlArchivo = resultadoUpload.webViewLink;
    let urlEmbed = null;
    
    if (datosValidados.tipoContenido === 'video_zoom') {
      // Para videos, usar el enlace de embed
      urlEmbed = driveStorage.getEmbedVideoLink(resultadoUpload.id);
    }

    // Crear registro en BD
    const contenido = await prisma.contenido.create({
      data: {
        unidadId: datosValidados.unidadId,
        titulo: datosValidados.titulo,
        descripcion: datosValidados.descripcion,
        tipoContenido: datosValidados.tipoContenido,
        urlArchivo: urlArchivo,
        urlEmbed: urlEmbed, // Nuevo campo para embed
        driveFileId: resultadoUpload.id, // Guardar el ID de Google Drive
        tamanoMb: driveStorage.bytesToMB(resultadoUpload.size),
        duracionMinutos: datosValidados.duracionMinutos,
        orden: datosValidados.orden,
        subidoPorId: usuarioId,
        esContenidoAdicional: !esAdmin // Si es profesor, es contenido adicional
      },
      include: {
        unidad: {
          include: {
            curso: {
              select: {
                nombre: true,
                codigoCurso: true
              }
            }
          }
        },
        subidoPor: {
          select: {
            nombres: true,
            apellidos: true
          }
        }
      }
    });

    return sendCreated(res, {
      ...contenido,
      enlaces: {
        ver: resultadoUpload.webViewLink,
        embed: urlEmbed,
        descarga: driveStorage.getDirectDownloadLink(resultadoUpload.id)
      }
    }, 'Contenido subido exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener contenidos de una unidad
 */
export const obtenerContenidosUnidad = async (req: Request, res: Response) => {
  try {
    const { unidadId } = req.params;

    const contenidos = await prisma.contenido.findMany({
      where: {
        unidadId: parseInt(unidadId),
        activo: true
      },
      include: {
        subidoPor: {
          select: {
            nombres: true,
            apellidos: true,
            tipoUsuario: true
          }
        }
      },
      orderBy: { orden: 'asc' }
    });

    // Agregar enlaces adicionales de Google Drive
    const contenidosConEnlaces = contenidos.map(contenido => ({
      ...contenido,
      enlaces: contenido.driveFileId ? {
        ver: contenido.urlArchivo,
        embed: contenido.urlEmbed || null,
        descarga: driveStorage.getDirectDownloadLink(contenido.driveFileId)
      } : null
    }));

    return sendSuccess(res, contenidosConEnlaces);
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener un contenido específico
 */
export const obtenerContenido = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user!.id;

    const contenido = await prisma.contenido.findUnique({
      where: { id: parseInt(id) },
      include: {
        unidad: {
          include: {
            curso: true
          }
        },
        subidoPor: {
          select: {
            nombres: true,
            apellidos: true
          }
        }
      }
    });

    if (!contenido) {
      return sendError(res, 'Contenido no encontrado', 404);
    }

    // Verificar que el usuario está inscrito en el curso
    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        usuarioId,
        cursoId: contenido.unidad.curso.id,
        estadoPago: 'pagado'
      }
    });

    if (!inscripcion && req.user!.tipoUsuario === 'estudiante') {
      return sendError(res, 'No tienes acceso a este contenido', 403);
    }

    // Registrar progreso si es estudiante
    if (inscripcion) {
      await prisma.progresoContenido.upsert({
        where: {
          inscripcionCursoId_contenidoId: {
            inscripcionCursoId: inscripcion.id,
            contenidoId: contenido.id
          }
        },
        update: {
          fechaInicio: new Date()
        },
        create: {
          inscripcionCursoId: inscripcion.id,
          contenidoId: contenido.id,
          fechaInicio: new Date()
        }
      });
    }

    // Agregar información adicional de Google Drive si está disponible
    let infoAdicional = null;
    if (contenido.driveFileId) {
      try {
        const driveInfo = await driveStorage.getFileInfo(contenido.driveFileId);
        infoAdicional = {
          enlaces: {
            ver: contenido.urlArchivo,
            embed: contenido.urlEmbed || null,
            descarga: driveStorage.getDirectDownloadLink(contenido.driveFileId)
          },
          miniatura: driveInfo.thumbnailLink,
          fechaSubida: driveInfo.createdTime,
          ultimaModificacion: driveInfo.modifiedTime
        };
      } catch (error) {
        console.error('Error al obtener info de Drive:', error);
      }
    }

    return sendSuccess(res, {
      ...contenido,
      ...infoAdicional
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Actualizar contenido
 */
export const actualizarContenido = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user!.id;
    const tipoUsuario = req.user!.tipoUsuario;

    const contenido = await prisma.contenido.findUnique({
      where: { id: parseInt(id) },
      include: {
        unidad: {
          include: {
            curso: {
              include: {
                profesores: {
                  where: { profesorId: usuarioId }
                }
              }
            }
          }
        }
      }
    });

    if (!contenido) {
      return sendError(res, 'Contenido no encontrado', 404);
    }

    // Verificar permisos
    const esAdmin = tipoUsuario === 'administrador';
    const esProfesorDelCurso = contenido.unidad.curso.profesores.length > 0;
    const esCreador = contenido.subidoPorId === usuarioId;

    if (!esAdmin && !esProfesorDelCurso && !esCreador) {
      return sendError(res, 'No tienes permisos para actualizar este contenido', 403);
    }

    // Si hay nuevo archivo, reemplazar en Drive
    let datosActualizacion: any = {
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      orden: req.body.orden,
      duracionMinutos: req.body.duracionMinutos
    };

    if (req.file && contenido.driveFileId) {
      try {
        // Actualizar archivo en Google Drive
        const resultadoUpload = await driveStorage.updateFile(
          contenido.driveFileId,
          req.file.path
        );

        datosActualizacion.urlArchivo = resultadoUpload.webViewLink;
        datosActualizacion.tamanoMb = driveStorage.bytesToMB(resultadoUpload.size);
        
        if (contenido.tipoContenido === 'video_zoom') {
          datosActualizacion.urlEmbed = driveStorage.getEmbedVideoLink(resultadoUpload.id);
        }
      } catch (error) {
        console.error('Error al actualizar archivo en Drive:', error);
      }
    }

    // Actualizar en BD
    const contenidoActualizado = await prisma.contenido.update({
      where: { id: parseInt(id) },
      data: datosActualizacion
    });

    return sendSuccess(res, contenidoActualizado, 'Contenido actualizado exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Eliminar contenido
 */
export const eliminarContenido = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user!.id;
    const tipoUsuario = req.user!.tipoUsuario;

    const contenido = await prisma.contenido.findUnique({
      where: { id: parseInt(id) },
      include: {
        unidad: {
          include: {
            curso: {
              include: {
                profesores: {
                  where: { profesorId: usuarioId }
                }
              }
            }
          }
        }
      }
    });

    if (!contenido) {
      return sendError(res, 'Contenido no encontrado', 404);
    }

    // Solo admin o creador puede eliminar
    const esAdmin = tipoUsuario === 'administrador';
    const esCreador = contenido.subidoPorId === usuarioId;

    if (!esAdmin && !esCreador) {
      return sendError(res, 'No tienes permisos para eliminar este contenido', 403);
    }

    // Eliminar de Google Drive
    if (contenido.driveFileId) {
      try {
        await driveStorage.deleteFile(contenido.driveFileId);
      } catch (error) {
        console.error('Error al eliminar archivo de Google Drive:', error);
        // Continuar con el soft delete aunque falle la eliminación en Drive
      }
    }

    // Soft delete en BD
    await prisma.contenido.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    });

    return sendSuccess(res, null, 'Contenido eliminado exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Marcar contenido como completado
 */
export const marcarContenidoCompletado = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user!.id;
    const { tiempoDedicadoMinutos } = req.body;

    // Buscar inscripción al curso
    const contenido = await prisma.contenido.findUnique({
      where: { id: parseInt(id) },
      include: {
        unidad: true
      }
    });

    if (!contenido) {
      return sendError(res, 'Contenido no encontrado', 404);
    }

    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        usuarioId,
        cursoId: contenido.unidad.cursoId,
        estadoPago: 'pagado'
      }
    });

    if (!inscripcion) {
      return sendError(res, 'No estás inscrito en este curso', 403);
    }

    // Actualizar progreso
    const progreso = await prisma.progresoContenido.upsert({
      where: {
        inscripcionCursoId_contenidoId: {
          inscripcionCursoId: inscripcion.id,
          contenidoId: contenido.id
        }
      },
      update: {
        completado: true,
        porcentajeVisto: 100,
        tiempoDedicadoMinutos: tiempoDedicadoMinutos || 0,
        fechaCompletado: new Date()
      },
      create: {
        inscripcionCursoId: inscripcion.id,
        contenidoId: contenido.id,
        completado: true,
        porcentajeVisto: 100,
        tiempoDedicadoMinutos: tiempoDedicadoMinutos || 0,
        fechaInicio: new Date(),
        fechaCompletado: new Date()
      }
    });

    // Calcular progreso general del curso
    const totalContenidos = await prisma.contenido.count({
      where: {
        unidad: {
          cursoId: contenido.unidad.cursoId
        },
        activo: true
      }
    });

    const contenidosCompletados = await prisma.progresoContenido.count({
      where: {
        inscripcionCursoId: inscripcion.id,
        completado: true
      }
    });

    const progresoPorcentaje = Math.round((contenidosCompletados / totalContenidos) * 100);

    // Actualizar progreso de inscripción
    await prisma.inscripcionCurso.update({
      where: { id: inscripcion.id },
      data: {
        progresoPorcentaje,
        estadoCurso: progresoPorcentaje === 100 ? 'completado' : 'en_progreso'
      }
    });

    return sendSuccess(res, {
      progreso,
      progresoCurso: progresoPorcentaje
    }, 'Contenido marcado como completado');
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener progreso del estudiante en contenidos
 */
export const obtenerProgresoContenidos = async (req: Request, res: Response) => {
  try {
    const { cursoId } = req.params;
    const usuarioId = req.user!.id;

    const inscripcion = await prisma.inscripcionCurso.findFirst({
      where: {
        usuarioId,
        cursoId: parseInt(cursoId)
      }
    });

    if (!inscripcion) {
      return sendError(res, 'No estás inscrito en este curso', 404);
    }

    const progresos = await prisma.progresoContenido.findMany({
      where: {
        inscripcionCursoId: inscripcion.id
      },
      include: {
        contenido: {
          include: {
            unidad: {
              select: {
                titulo: true,
                numeroUnidad: true
              }
            }
          }
        }
      },
      orderBy: {
        contenido: {
          orden: 'asc'
        }
      }
    });

    return sendSuccess(res, {
      progresoPorcentaje: inscripcion.progresoPorcentaje,
      contenidos: progresos
    });
  } catch (error) {
    throw error;
  }
};