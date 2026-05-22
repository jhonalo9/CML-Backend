import { Request, Response } from 'express';
import { prisma} from '../lib/prisma';
import { sendSuccess, sendError, sendCreated, sendPaginated } from '../utils/response.utils';
import { crearCursoSchema, actualizarCursoSchema, crearUnidadSchema, crearClaseZoomSchema } from '../validators/curso.validator';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
//import { cleanupTempFile } from '../config/multer';

//const prisma = new PrismaClient();

/**
 * Crear curso (Solo Admin)
 */
export const crearCurso = async (req: Request, res: Response) => {
  try {
    console.log('📦 Body recibido:', req.body);
    console.log('📁 Archivo recibido:', req.file);

    // Parsear datos del form-data
    const datosFormulario = {
      codigoCurso: req.body.codigoCurso,
      nombre: req.body.nombre,
      descripcion: req.body.descripcion || '',
      objetivos: req.body.objetivos || '',
      numeroOrden: parseInt(req.body.numeroOrden),
      precio: parseFloat(req.body.precio) || 80,
      esCurricular: req.body.esCurricular === 'true',
      totalUnidades: parseInt(req.body.totalUnidades) || 4,
      totalEvaluaciones: parseInt(req.body.totalEvaluaciones) || 4,
      tieneExamenFinal: req.body.tieneExamenFinal === 'true',
      silaboUrl: req.body.silaboUrl || undefined
    };

    console.log('📝 Datos parseados:', datosFormulario);

    // Validar con Zod
    const datosValidados = crearCursoSchema.parse(datosFormulario);

    // Verificar que no exista un curso con ese número de orden
    const cursoExistente = await prisma.curso.findFirst({
      where: {
        numeroOrden: datosValidados.numeroOrden,
        esCurricular: true
      }
    });

    if (cursoExistente) {
      // Limpiar archivo temporal si existe
      /*if (req.file) {
        cleanupTempFile(req.file.path);
      }*/
      return sendError(res, `Ya existe un curso en la posición ${datosValidados.numeroOrden}`, 400);
    }

    // Subir imagen a Cloudinary si existe
    let imagenPortadaUrl: string | undefined;
    let imagenPublicId: string | undefined;
    
    if (req.file) {
      try {
        const resultado = await uploadToCloudinary(req.file, 'ministerio-laico/portadas');
        imagenPortadaUrl = resultado.url;
        imagenPublicId = resultado.publicId;
        
        // Limpiar archivo temporal después de subir
        //cleanupTempFile(req.file.path);
        
        console.log('✅ Imagen subida a Cloudinary:', imagenPortadaUrl);
      } catch (uploadError) {
        console.error('❌ Error subiendo imagen:', uploadError);
        //cleanupTempFile(req.file.path);
        return sendError(res, 'Error al subir la imagen', 500);
      }
    }

    // Crear curso
    const curso = await prisma.curso.create({
      data: {
        ...datosValidados,
        imagenPortada: imagenPortadaUrl,
        // Opcional: guardar publicId para poder eliminar después
        // imagenPublicId: imagenPublicId
      }
    });

    // Crear las 4 unidades por defecto
    const unidades = [];
    for (let i = 1; i <= 4; i++) {
      unidades.push({
        cursoId: curso.id,
        numeroUnidad: i,
        titulo: `Unidad ${i}`,
        descripcion: `Unidad ${i} del curso`,
        orden: i
      });
    }

    await prisma.unidad.createMany({
      data: unidades
    });

    // Crear las 4 evaluaciones de unidad + 1 examen final
    const evaluaciones = [];
    for (let i = 1; i <= 4; i++) {
      const unidad = await prisma.unidad.findFirst({
        where: { cursoId: curso.id, numeroUnidad: i }
      });

      evaluaciones.push({
        cursoId: curso.id,
        unidadId: unidad?.id,
        numeroEvaluacion: i,
        titulo: `Evaluación Unidad ${i}`,
        tipo: 'evaluacion_unidad' as const
      });
    }

    // Examen final
    evaluaciones.push({
      cursoId: curso.id,
      numeroEvaluacion: 5,
      titulo: 'Examen Final',
      tipo: 'examen_final' as const
    });

    await prisma.evaluacion.createMany({
      data: evaluaciones
    });

    console.log('✅ Curso creado exitosamente con ID:', curso.id);
    return sendCreated(res, curso, 'Curso creado exitosamente');
    
  } catch (error) {
    console.error('❌ Error al crear curso:', error);
    
    // Limpiar archivo temporal en caso de error
    if (req.file) {
      //cleanupTempFile(req.file.path);
    }
    
    throw error;
  }
};

/**
 * Listar todos los cursos
 */
export const listarCursos = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 12, esCurricular } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { activo: true };
    if (esCurricular !== undefined) {
      where.esCurricular = esCurricular === 'true';
    }

    const [cursos, total] = await Promise.all([
      prisma.curso.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          profesores: {
            where: { esPrincipal: true },
            include: {
              profesor: {
                select: {
                  nombres: true,
                  apellidos: true,
                  fotoPerfil: true
                }
              }
            }
          },
          _count: {
            select: {
              inscripciones: true,
              unidades: true
            }
          }
        },
        orderBy: { numeroOrden: 'asc' }
      }),
      prisma.curso.count({ where })
    ]);

    return sendPaginated(res, cursos, total, Number(page), Number(limit));
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener curso por ID
 */
export const obtenerCurso = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const curso = await prisma.curso.findUnique({
      where: { id: parseInt(id) },
      include: {
        profesores: {
          include: {
            profesor: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                fotoPerfil: true
              }
            }
          }
        },
        unidades: {
          orderBy: { orden: 'asc' },
          include: {
            _count: {
              select: {
                contenidos: true
              }
            }
          }
        },
        evaluaciones: {
          orderBy: { numeroEvaluacion: 'asc' }
        },
        _count: {
          select: {
            inscripciones: true
          }
        }
      }
    });

    if (!curso) {
      return sendError(res, 'Curso no encontrado', 404);
    }

    return sendSuccess(res, curso);
  } catch (error) {
    throw error;
  }
};

/**
 * Actualizar curso
 */
export const actualizarCurso = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Parsear datos si vienen de form-data
    const datosFormulario: any = {};
    
    // Solo agregar campos que existan en el body
    if (req.body.codigoCurso) datosFormulario.codigoCurso = req.body.codigoCurso;
    if (req.body.nombre) datosFormulario.nombre = req.body.nombre;
    if (req.body.descripcion) datosFormulario.descripcion = req.body.descripcion;
    if (req.body.objetivos) datosFormulario.objetivos = req.body.objetivos;
    if (req.body.numeroOrden) datosFormulario.numeroOrden = parseInt(req.body.numeroOrden);
    if (req.body.precio) datosFormulario.precio = parseFloat(req.body.precio);
    if (req.body.esCurricular !== undefined) datosFormulario.esCurricular = req.body.esCurricular === 'true';
    if (req.body.activo !== undefined) datosFormulario.activo = req.body.activo === 'true';
    if (req.body.silaboUrl) datosFormulario.silaboUrl = req.body.silaboUrl;

    // Validar datos
    const datosValidados = actualizarCursoSchema.parse(datosFormulario);

    // Si hay nueva imagen, subirla
    if (req.file) {
      try {
        // Obtener curso actual para eliminar imagen antigua
        const cursoActual = await prisma.curso.findUnique({
          where: { id: parseInt(id) },
          select: { imagenPortada: true }
        });

        // Subir nueva imagen
        const resultado = await uploadToCloudinary(req.file, 'ministerio-laico/portadas');
        datosValidados.imagenPortada = resultado.url;

        // TODO: Eliminar imagen antigua de Cloudinary si existe
        // Si guardaste el publicId, puedes eliminarlo:
        // if (cursoActual?.imagenPublicId) {
        //   await deleteFromCloudinary(cursoActual.imagenPublicId);
        // }

        // Limpiar archivo temporal
        //cleanupTempFile(req.file.path);
        
        console.log('✅ Nueva imagen subida:', resultado.url);
      } catch (uploadError) {
        console.error('Error subiendo nueva imagen:', uploadError);
        //cleanupTempFile(req.file.path);
        return sendError(res, 'Error al subir la nueva imagen', 500);
      }
    }

    // Actualizar curso
    const curso = await prisma.curso.update({
      where: { id: parseInt(id) },
      data: datosValidados
    });

    return sendSuccess(res, curso, 'Curso actualizado exitosamente');
  } catch (error) {
    console.error('Error actualizando curso:', error);
    /*if (req.file) {
      cleanupTempFile(req.file.path);
    }*/
    throw error;
  }
};

/**
 * Eliminar curso (Soft delete)
 */
export const eliminarCurso = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.curso.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    });

    return sendSuccess(res, null, 'Curso eliminado exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Asignar profesor a curso
 */
export const asignarProfesor = async (req: Request, res: Response) => {
  try {
    const { cursoId, profesorId, esPrincipal } = req.body;

    // Verificar que el usuario sea profesor
    const profesor = await prisma.usuario.findUnique({
      where: { id: profesorId }
    });

    if (!profesor || profesor.tipoUsuario !== 'profesor') {
      return sendError(res, 'El usuario no es un profesor', 400);
    }

    const asignacion = await prisma.profesorCurso.create({
      data: {
        cursoId,
        profesorId,
        esPrincipal: esPrincipal || false
      },
      include: {
        profesor: {
          select: {
            nombres: true,
            apellidos: true,
            email: true
          }
        },
        curso: {
          select: {
            nombre: true,
            codigoCurso: true
          }
        }
      }
    });

    return sendCreated(res, asignacion, 'Profesor asignado exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Crear unidad (adicional a las 4 por defecto)
 */
export const crearUnidad = async (req: Request, res: Response) => {
  try {
    const datosValidados = crearUnidadSchema.parse(req.body);

    const unidad = await prisma.unidad.create({
      data: datosValidados
    });

    return sendCreated(res, unidad, 'Unidad creada exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Actualizar unidad
 */
export const actualizarUnidad = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, objetivos } = req.body;

    const unidad = await prisma.unidad.update({
      where: { id: parseInt(id) },
      data: { titulo, descripcion, objetivos }
    });

    return sendSuccess(res, unidad, 'Unidad actualizada exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener unidades de un curso
 */
export const obtenerUnidadesCurso = async (req: Request, res: Response) => {
  try {
    const { cursoId } = req.params;

    const unidades = await prisma.unidad.findMany({
      where: {
        cursoId: parseInt(cursoId),
        activa: true
      },
      include: {
        contenidos: {
          where: { activo: true },
          orderBy: { orden: 'asc' }
        },
        evaluaciones: {
          where: { activa: true }
        }
      },
      orderBy: { orden: 'asc' }
    });

    return sendSuccess(res, unidades);
  } catch (error) {
    throw error;
  }
};

/**
 * Programar clase Zoom
 */
export const programarClaseZoom = async (req: Request, res: Response) => {
  try {
    const datosValidados = crearClaseZoomSchema.parse(req.body);

    const clase = await prisma.claseZoom.create({
      data: {
        ...datosValidados,
        fechaHoraInicio: new Date(datosValidados.fechaHoraInicio),
        fechaHoraFin: new Date(datosValidados.fechaHoraFin)
      },
      include: {
        curso: {
          select: {
            nombre: true
          }
        },
        unidad: {
          select: {
            titulo: true
          }
        }
      }
    });

    // TODO: Enviar notificaciones a estudiantes inscritos

    return sendCreated(res, clase, 'Clase programada exitosamente');
  } catch (error) {
    throw error;
  }
};

/**
 * Listar clases Zoom de un curso
 */
export const listarClasesZoom = async (req: Request, res: Response) => {
  try {
    const { cursoId } = req.params;
    const { estado } = req.query;

    const where: any = { cursoId: parseInt(cursoId) };
    if (estado) {
      where.estado = estado;
    }

    const clases = await prisma.claseZoom.findMany({
      where,
      include: {
        unidad: {
          select: {
            titulo: true,
            numeroUnidad: true
          }
        }
      },
      orderBy: { fechaHoraInicio: 'asc' }
    });

    return sendSuccess(res, clases);
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener próximas clases (todas los cursos)
 */
export const obtenerProximasClases = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;

    // Obtener cursos en los que está inscrito
    const inscripciones = await prisma.inscripcionCurso.findMany({
      where: {
        usuarioId,
        estadoPago: 'pagado'
      },
      select: { cursoId: true }
    });

    const cursosIds = inscripciones.map((i:any) => i.cursoId);

    const clases = await prisma.claseZoom.findMany({
      where: {
        cursoId: { in: cursosIds },
        fechaHoraInicio: { gte: new Date() },
        estado: 'programada'
      },
      include: {
        curso: {
          select: {
            nombre: true,
            codigoCurso: true
          }
        },
        unidad: {
          select: {
            titulo: true
          }
        }
      },
      orderBy: { fechaHoraInicio: 'asc' },
      take: 10
    });

    return sendSuccess(res, clases);
  } catch (error) {
    throw error;
  }
};

/**
 * Actualizar estado de clase Zoom
 */
export const actualizarClaseZoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado, urlGrabacion } = req.body;

    const clase = await prisma.claseZoom.update({
      where: { id: parseInt(id) },
      data: {
        ...(estado && { estado }),
        ...(urlGrabacion && { urlGrabacion })
      }
    });

    return sendSuccess(res, clase, 'Clase actualizada exitosamente');
  } catch (error) {
    throw error;
  }
};


export const obtenerMisCursosProfesor = async (req: Request, res: Response) => {
  try {
    const profesorId = req.user!.id;

    // Buscar cursos donde el profesor está asignado
    const cursosAsignados = await prisma.profesorCurso.findMany({
      where: {
        profesorId
      },
      include: {
        curso: {
          include: {
            profesores: {
              include: {
                profesor: {
                  select: {
                    id: true,
                    nombres: true,
                    apellidos: true,
                    fotoPerfil: true
                  }
                }
              }
            },
            unidades: {
              where: { activa: true },
              orderBy: { orden: 'asc' }
            },
            _count: {
              select: {
                inscripciones: true,
                evaluaciones: true,
                unidades: true
              }
            }
          }
        }
      },
      orderBy: {
        curso: {
          numeroOrden: 'asc'
        }
      }
    });

    // Transformar la respuesta para enviar solo los cursos
    const cursos = cursosAsignados.map(asignacion => ({
      ...asignacion.curso,
      esPrincipal: asignacion.esPrincipal,
      fechaAsignacion: asignacion.fechaAsignacion
    }));

    return sendSuccess(res, cursos);
  } catch (error) {
    throw error;
  }
};

/**
 * Obtener estadísticas del profesor
 */
export const obtenerEstadisticasProfesor = async (req: Request, res: Response) => {
  try {
    const profesorId = req.user!.id;

    // Obtener cursos asignados
    const cursosAsignados = await prisma.profesorCurso.findMany({
      where: { profesorId },
      include: {
        curso: {
          include: {
            _count: {
              select: {
                inscripciones: true
              }
            }
          }
        }
      }
    });

    const cursosIds = cursosAsignados.map(c => c.cursoId);

    // Total de estudiantes (suma de inscripciones en todos los cursos)
    const totalEstudiantes = cursosAsignados.reduce((sum, asignacion) => {
      return sum + (asignacion.curso._count?.inscripciones || 0);
    }, 0);

    // Evaluaciones pendientes de calificar
    const evaluacionesPendientes = await prisma.resultadoEvaluacion.count({
      where: {
        calificado: false,
        evaluacion: {
          cursoId: { in: cursosIds },
          preguntas: {
            some: {
              tipoPregunta: 'desarrollo'
            }
          }
        }
      }
    });

    // Próximas clases
    const proximasClases = await prisma.claseZoom.count({
      where: {
        cursoId: { in: cursosIds },
        fechaHoraInicio: { gte: new Date() },
        estado: 'programada'
      }
    });

    return sendSuccess(res, {
      totalCursos: cursosAsignados.length,
      estudiantesActivos: totalEstudiantes,
      evaluacionesPendientes,
      proximasClases
    });
  } catch (error) {
    throw error;
  }
};