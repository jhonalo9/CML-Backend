import { Request, Response } from 'express';
import { PrismaClient, TipoUsuario, EstadoUsuario, EstadoPagoTransaccion, TipoPago } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Tipos para filtros
interface WhereUsuario {
  OR?: Array<{
    nombres?: { contains: string; mode?: 'insensitive' };
    apellidos?: { contains: string; mode?: 'insensitive' };
    email?: { contains: string; mode?: 'insensitive' };
    dni?: { contains: string; mode?: 'insensitive' };
  }>;
  tipoUsuario?: TipoUsuario;
  estado?: EstadoUsuario;
}

// Helper para hash de password
const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Obtener todos los usuarios con paginación y filtros
export const getUsuarios = async (req: Request, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '10', 
      search = '', 
      tipoUsuario,
      estado 
    } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    const whereClause: WhereUsuario = {};
    
    if (search) {
      const searchStr = search as string;
      whereClause.OR = [
        { nombres: { contains: searchStr, mode: 'insensitive' } },
        { apellidos: { contains: searchStr, mode: 'insensitive' } },
        { email: { contains: searchStr, mode: 'insensitive' } },
        { dni: { contains: searchStr, mode: 'insensitive' } }
      ];
    }
    
    if (tipoUsuario && Object.values(TipoUsuario).includes(tipoUsuario as TipoUsuario)) {
      whereClause.tipoUsuario = tipoUsuario as TipoUsuario;
    }
    
    if (estado && Object.values(EstadoUsuario).includes(estado as EstadoUsuario)) {
      whereClause.estado = estado as EstadoUsuario;
    }
    
    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
        where: whereClause,
        take: limitNum,
        skip: offset,
        orderBy: { fechaRegistro: 'desc' },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          email: true,
          dni: true,
          telefono: true,
          direccion: true,
          ciudad: true,
          pais: true,
          tipoUsuario: true,
          estado: true,
          verificado: true,
          fechaRegistro: true,
          ultimoAcceso: true,
          sexo: true,
          edad: true,
          ocupacion: true,
          profesion: true,
          nivelEstudios: true,
          esMiembroPlenaComunion: true,
          nombreIglesia: true,
          nombrePastor: true
        }
      }),
      prisma.usuario.count({ where: whereClause })
    ]);
    
    res.json({
      success: true,
      data: {
        usuarios,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    });
  }
};

// Buscar usuarios (para autocomplete)
export const buscarUsuarios = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    
    if (!query || query.toString().length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const searchStr = query.toString();
    
    const usuarios = await prisma.usuario.findMany({
      where: {
        OR: [
          { nombres: { contains: searchStr } },
          { apellidos: { contains: searchStr } },
          { email: { contains: searchStr } },
          { dni: { contains: searchStr } }
        ]
      },
      take: 10,
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        dni: true,
        telefono: true,
        tipoUsuario: true,
        estado: true
      },
      orderBy: { nombres: 'asc' }
    });
    
    res.json({
      success: true,
      data: usuarios
    });
  } catch (error) {
    console.error('Error al buscar usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar usuarios'
    });
  }
};

// Obtener usuario por ID
export const getUsuarioById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        dni: true,
        telefono: true,
        direccion: true,
        ciudad: true,
        pais: true,
        distritoPertenece: true,
        sexo: true,
        edad: true,
        fechaNacimiento: true,
        ocupacion: true,
        profesion: true,
        nivelEstudios: true,
        esMiembroPlenaComunion: true,
        nombreIglesia: true,
        nombrePastor: true,
        tipoUsuario: true,
        estado: true,
        verificado: true,
        fechaRegistro: true,
        ultimoAcceso: true,
        fotoPerfil: true,
        matriculas: {
          include: {
            inscripcionesCurso: {
              include: {
                curso: {
                  select: {
                    id: true,
                    codigoCurso: true,
                    nombre: true,
                    precio: true
                  }
                }
              }
            }
          }
        },
        inscripcionesCurso: {
          include: {
            curso: {
              select: {
                id: true,
                codigoCurso: true,
                nombre: true
              }
            },
            matricula: {
              select: {
                codigoMatricula: true
              }
            }
          }
        },
        pagos: {
          orderBy: { fechaPago: 'desc' },
          take: 10,
          select: {
            id: true,
            tipoPago: true,
            monto: true,
            estado: true,
            fechaPago: true
          }
        }
      }
    });
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: usuario
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario'
    });
  }
};

// Crear nuevo usuario (admin)
export const createUsuario = async (req: Request, res: Response) => {
  try {
    const { 
      nombres, 
      apellidos, 
      email, 
      dni, 
      password,
      sexo,
      edad,
      fechaNacimiento,
      direccion,
      ciudad,
      pais,
      distritoPertenece,
      ocupacion,
      profesion,
      nivelEstudios,
      esMiembroPlenaComunion,
      nombreIglesia,
      nombrePastor,
      telefono,
      tipoUsuario = 'estudiante' 
    } = req.body;
    
    // Validaciones
    if (!nombres || !apellidos || !email || !dni || !password || !sexo || !edad || !fechaNacimiento) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios'
      });
    }
    
    // Verificar si el email ya existe
    const usuarioExistenteEmail = await prisma.usuario.findUnique({
      where: { email }
    });
    
    if (usuarioExistenteEmail) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }
    
    // Verificar si el DNI ya existe
    const usuarioExistenteDNI = await prisma.usuario.findUnique({
      where: { dni }
    });
    
    if (usuarioExistenteDNI) {
      return res.status(400).json({
        success: false,
        message: 'El DNI ya está registrado'
      });
    }
    
    // Hashear password
    const hashedPassword = await hashPassword(password);
    
    const usuario = await prisma.usuario.create({
      data: {
        nombres,
        apellidos,
        email,
        dni,
        password: hashedPassword,
        sexo,
        edad: parseInt(edad),
        fechaNacimiento: new Date(fechaNacimiento),
        direccion,
        ciudad,
        pais,
        distritoPertenece,
        ocupacion,
        profesion,
        nivelEstudios,
        esMiembroPlenaComunion: esMiembroPlenaComunion || false,
        nombreIglesia: nombreIglesia || '',
        nombrePastor: nombrePastor || '',
        telefono,
        tipoUsuario,
        estado: 'activo',
        verificado: true, // Los usuarios creados por admin se verifican automáticamente
        fechaRegistro: new Date()
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        dni: true,
        telefono: true,
        direccion: true,
        ciudad: true,
        pais: true,
        sexo: true,
        edad: true,
        tipoUsuario: true,
        estado: true,
        verificado: true,
        fechaRegistro: true
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: usuario
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario'
    });
  }
};

// Actualizar usuario
export const updateUsuario = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      nombres, 
      apellidos, 
      email, 
      dni, 
      telefono, 
      direccion,
      ciudad,
      pais,
      distritoPertenece,
      ocupacion,
      profesion,
      nivelEstudios,
      esMiembroPlenaComunion,
      nombreIglesia,
      nombrePastor,
      tipoUsuario 
    } = req.body;
    
    // Verificar si el usuario existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!usuarioExistente) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar email único si se cambió
    if (email && email !== usuarioExistente.email) {
      const emailExistente = await prisma.usuario.findUnique({
        where: { email }
      });
      
      if (emailExistente) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado'
        });
      }
    }
    
    // Verificar DNI único si se cambió
    if (dni && dni !== usuarioExistente.dni) {
      const dniExistente = await prisma.usuario.findUnique({
        where: { dni }
      });
      
      if (dniExistente) {
        return res.status(400).json({
          success: false,
          message: 'El DNI ya está registrado'
        });
      }
    }
    
    const usuario = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: {
        nombres: nombres || usuarioExistente.nombres,
        apellidos: apellidos || usuarioExistente.apellidos,
        email: email || usuarioExistente.email,
        dni: dni || usuarioExistente.dni,
        telefono: telefono || usuarioExistente.telefono,
        direccion: direccion || usuarioExistente.direccion,
        ciudad: ciudad || usuarioExistente.ciudad,
        pais: pais || usuarioExistente.pais,
        distritoPertenece: distritoPertenece || usuarioExistente.distritoPertenece,
        ocupacion: ocupacion || usuarioExistente.ocupacion,
        profesion: profesion || usuarioExistente.profesion,
        nivelEstudios: nivelEstudios || usuarioExistente.nivelEstudios,
        esMiembroPlenaComunion: esMiembroPlenaComunion !== undefined ? esMiembroPlenaComunion : usuarioExistente.esMiembroPlenaComunion,
        nombreIglesia: nombreIglesia || usuarioExistente.nombreIglesia,
        nombrePastor: nombrePastor || usuarioExistente.nombrePastor,
        tipoUsuario: tipoUsuario || usuarioExistente.tipoUsuario
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        dni: true,
        telefono: true,
        direccion: true,
        ciudad: true,
        pais: true,
        tipoUsuario: true,
        estado: true,
        verificado: true,
        fechaRegistro: true,
        ultimoAcceso: true
      }
    });
    
    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: usuario
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario'
    });
  }
};

// Eliminar usuario (soft delete - cambiar estado)
export const deleteUsuario = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verificar si el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Cambiar estado a inactivo (soft delete)
    await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { estado: 'inactivo' }
    });
    
    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  }
};

// Cambiar estado de usuario
export const toggleUsuarioEstado = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    // Verificar si el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Validar estado
    if (estado && !Object.values(EstadoUsuario).includes(estado as EstadoUsuario)) {
      return res.status(400).json({
        success: false,
        message: 'Estado no válido'
      });
    }
    
    const nuevoEstado = estado || (usuario.estado === 'activo' ? 'inactivo' : 'activo');
    
    const usuarioActualizado = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { estado: nuevoEstado as EstadoUsuario },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        estado: true,
        tipoUsuario: true
      }
    });
    
    res.json({
      success: true,
      message: `Usuario ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} exitosamente`,
      data: usuarioActualizado
    });
  } catch (error) {
    console.error('Error al cambiar estado del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del usuario'
    });
  }
};

// Obtener tipos de usuario disponibles
export const getRoles = async (req: Request, res: Response) => {
  try {
    const tiposUsuario = [
      { value: 'estudiante', label: 'Estudiante' },
      { value: 'profesor', label: 'Profesor' },
      { value: 'administrador', label: 'Administrador' }
    ];
    
    res.json({
      success: true,
      data: tiposUsuario
    });
  } catch (error) {
    console.error('Error al obtener tipos de usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipos de usuario'
    });
  }
};

// Asignar tipo de usuario
export const asignarRol = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tipoUsuario } = req.body;
    
    // Verificar si el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Validar tipo de usuario
    if (!Object.values(TipoUsuario).includes(tipoUsuario)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de usuario no válido'
      });
    }
    
    const usuarioActualizado = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { tipoUsuario: tipoUsuario as TipoUsuario },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        tipoUsuario: true,
        estado: true
      }
    });
    
    res.json({
      success: true,
      message: `Tipo de usuario actualizado a ${tipoUsuario}`,
      data: usuarioActualizado
    });
  } catch (error) {
    console.error('Error al asignar tipo de usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar tipo de usuario'
    });
  }
};

// Obtener cursos para admin
export const getCursosAdmin = async (req: Request, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '10',
      activo = '',
      search = ''
    } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    const whereClause: any = {};
    
    if (activo === 'true' || activo === 'false') {
      whereClause.activo = activo === 'true';
    }
    
    if (search) {
      whereClause.OR = [
        { nombre: { contains: search as string, mode: 'insensitive' } },
        { codigoCurso: { contains: search as string, mode: 'insensitive' } },
        { descripcion: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    const [cursos, total] = await Promise.all([
      prisma.curso.findMany({
        where: whereClause,
        take: limitNum,
        skip: offset,
        orderBy: { fechaCreacion: 'desc' },
        include: {
          profesores: {
            include: {
              profesor: {
                select: {
                  id: true,
                  nombres: true,
                  apellidos: true,
                  email: true
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
        }
      }),
      prisma.curso.count({ where: whereClause })
    ]);
    
    // Transformar la respuesta para incluir el profesor principal
    const cursosTransformados = cursos.map(curso => ({
      ...curso,
      profesorPrincipal: curso.profesores.find(p => p.esPrincipal)?.profesor || 
                        curso.profesores[0]?.profesor || null
    }));
    
    res.json({
      success: true,
      data: {
        cursos: cursosTransformados,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error al obtener cursos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cursos'
    });
  }
};

// Obtener matrículas para admin
export const getMatriculasAdmin = async (req: Request, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '10',
      estadoPago = '',
      activa = ''
    } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    const whereClause: any = {};
    
    if (estadoPago) {
      whereClause.estadoPago = estadoPago;
    }
    
    if (activa === 'true' || activa === 'false') {
      whereClause.activa = activa === 'true';
    }
    
    const [matriculas, total] = await Promise.all([
      prisma.matricula.findMany({
        where: whereClause,
        take: limitNum,
        skip: offset,
        orderBy: { fechaMatricula: 'desc' },
        include: {
          usuario: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              email: true,
              dni: true
            }
          },
          inscripcionesCurso: {
            include: {
              curso: {
                select: {
                  id: true,
                  nombre: true,
                  codigoCurso: true
                }
              }
            }
          },
          _count: {
            select: {
              inscripcionesCurso: true,
              certificados: true
            }
          }
        }
      }),
      prisma.matricula.count({ where: whereClause })
    ]);
    
    res.json({
      success: true,
      data: {
        matriculas,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error al obtener matrículas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener matrículas'
    });
  }
};

// Obtener estadísticas del sistema
export const getEstadisticas = async (req: Request, res: Response) => {
  try {
    // Usar Promise.all para mejor rendimiento
    const [
      totalUsuarios,
      totalEstudiantes,
      totalProfesores,
      totalAdministradores,
      totalCursos,
      totalMatriculas,
      totalInscripciones,
      totalPagos,
      cursosActivos,
      matriculasActivas
    ] = await Promise.all([
      prisma.usuario.count(),
      prisma.usuario.count({ where: { tipoUsuario: 'estudiante' } }),
      prisma.usuario.count({ where: { tipoUsuario: 'profesor' } }),
      prisma.usuario.count({ where: { tipoUsuario: 'administrador' } }),
      prisma.curso.count(),
      prisma.matricula.count(),
      prisma.inscripcionCurso.count(),
      prisma.pago.count(),
      prisma.curso.count({ where: { activo: true } }),
      prisma.matricula.count({ where: { activa: true } })
    ]);
    
    // Estadísticas por estado
    const [
      usuariosActivos,
      usuariosInactivos,
      pagosCompletados,
      pagosPendientes,
      pagosFallidos,
      inscripcionesCompletadas
    ] = await Promise.all([
      prisma.usuario.count({ where: { estado: 'activo' } }),
      prisma.usuario.count({ where: { estado: 'inactivo' } }),
      prisma.pago.count({ where: { estado: 'completado' } }),
      prisma.pago.count({ where: { estado: 'pendiente' } }),
      prisma.pago.count({ where: { estado: 'fallido' } }),
      prisma.inscripcionCurso.count({ where: { estadoCurso: 'completado' } })
    ]);
    
    // Últimos registros
    const [
      ultimosUsuarios,
      ultimosCursos,
      ultimasMatriculas,
      ultimosPagos
    ] = await Promise.all([
      prisma.usuario.findMany({
        take: 5,
        orderBy: { fechaRegistro: 'desc' },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          email: true,
          tipoUsuario: true,
          fechaRegistro: true
        }
      }),
      prisma.curso.findMany({
        take: 5,
        orderBy: { fechaCreacion: 'desc' },
        select: {
          id: true,
          nombre: true,
          codigoCurso: true,
          activo: true,
          fechaCreacion: true,
          profesores: {
            include: {
              profesor: {
                select: {
                  nombres: true,
                  apellidos: true
                }
              }
            },
            where: { esPrincipal: true },
            take: 1
          }
        }
      }),
      prisma.matricula.findMany({
        take: 5,
        orderBy: { fechaMatricula: 'desc' },
        select: {
          id: true,
          codigoMatricula: true,
          activa: true,
          fechaMatricula: true,
          estadoPago: true,
          usuario: {
            select: {
              nombres: true,
              apellidos: true,
              email: true
            }
          }
        }
      }),
      prisma.pago.findMany({
        take: 5,
        orderBy: { fechaPago: 'desc' },
        select: {
          id: true,
          tipoPago: true,
          monto: true,
          estado: true,
          fechaPago: true,
          usuario: {
            select: {
              nombres: true,
              apellidos: true
            }
          }
        }
      })
    ]);
    
    // Transformar cursos para incluir profesor principal
    const cursosTransformados = ultimosCursos.map(curso => ({
      ...curso,
      profesor: curso.profesores[0]?.profesor || null
    }));
    
    // Estadísticas de crecimiento (últimos 30 días)
    const treintaDiasAtras = new Date();
    treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
    
    const [
      nuevosUsuarios,
      nuevosCursos,
      nuevasMatriculas,
      nuevosPagos
    ] = await Promise.all([
      prisma.usuario.count({
        where: {
          fechaRegistro: {
            gte: treintaDiasAtras
          }
        }
      }),
      prisma.curso.count({
        where: {
          fechaCreacion: {
            gte: treintaDiasAtras
          }
        }
      }),
      prisma.matricula.count({
        where: {
          fechaMatricula: {
            gte: treintaDiasAtras
          }
        }
      }),
      prisma.pago.count({
        where: {
          fechaPago: {
            gte: treintaDiasAtras
          }
        }
      })
    ]);
    
    // Total recaudado
    const pagosCompletadosData = await prisma.pago.findMany({
      where: { estado: 'completado' },
      select: { monto: true }
    });
    
    const totalRecaudado = pagosCompletadosData.reduce((sum, pago) => {
      return sum + Number(pago.monto);
    }, 0);
    
    // Distribución de tipos de pago
    const distribucionPagos = await Promise.all([
      prisma.pago.count({ where: { tipoPago: 'matricula' } }),
      prisma.pago.count({ where: { tipoPago: 'curso' } }),
      prisma.pago.count({ where: { tipoPago: 'curso_adicional' } })
    ]);
    
    res.json({
      success: true,
      data: {
        conteos: {
          usuarios: totalUsuarios,
          estudiantes: totalEstudiantes,
          profesores: totalProfesores,
          administradores: totalAdministradores,
          cursos: totalCursos,
          matriculas: totalMatriculas,
          inscripciones: totalInscripciones,
          pagos: totalPagos
        },
        estados: {
          usuarios: {
            activos: usuariosActivos,
            inactivos: usuariosInactivos
          },
          cursos: {
            activos: cursosActivos,
            inactivos: totalCursos - cursosActivos
          },
          matriculas: {
            activas: matriculasActivas,
            inactivas: totalMatriculas - matriculasActivas
          },
          pagos: {
            completados: pagosCompletados,
            pendientes: pagosPendientes,
            fallidos: pagosFallidos
          }
        },
        monetario: {
          totalRecaudado,
          promedioPago: pagosCompletados > 0 ? totalRecaudado / pagosCompletados : 0,
          distribucionPagos: {
            matricula: distribucionPagos[0],
            curso: distribucionPagos[1],
            curso_adicional: distribucionPagos[2]
          }
        },
        progreso: {
          inscripcionesCompletadas,
          tasaCompletacion: totalInscripciones > 0 ? (inscripcionesCompletadas / totalInscripciones) * 100 : 0
        },
        crecimiento: {
          usuarios: nuevosUsuarios,
          cursos: nuevosCursos,
          matriculas: nuevasMatriculas,
          pagos: nuevosPagos,
          periodo: '30 días'
        },
        recientes: {
          usuarios: ultimosUsuarios,
          cursos: cursosTransformados,
          matriculas: ultimasMatriculas,
          pagos: ultimosPagos
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
};

// Obtener pagos para admin
export const getPagosAdmin = async (req: Request, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '10',
      estado = '',
      tipoPago = '',
      fechaDesde = '',
      fechaHasta = ''
    } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    const whereClause: any = {};
    
    if (estado && Object.values(EstadoPagoTransaccion).includes(estado as EstadoPagoTransaccion)) {
      whereClause.estado = estado as EstadoPagoTransaccion;
    }
    
    if (tipoPago && Object.values(TipoPago).includes(tipoPago as TipoPago)) {
      whereClause.tipoPago = tipoPago as TipoPago;
    }
    
    if (fechaDesde || fechaHasta) {
      whereClause.fechaPago = {};
      if (fechaDesde) {
        whereClause.fechaPago.gte = new Date(fechaDesde as string);
      }
      if (fechaHasta) {
        whereClause.fechaPago.lte = new Date(fechaHasta as string);
      }
    }
    
    const [pagos, total] = await Promise.all([
      prisma.pago.findMany({
        where: whereClause,
        take: limitNum,
        skip: offset,
        orderBy: { fechaPago: 'desc' },
        include: {
          usuario: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              email: true
            }
          }
        }
      }),
      prisma.pago.count({ where: whereClause })
    ]);
    
    res.json({
      success: true,
      data: {
        pagos,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pagos'
    });
  }
};