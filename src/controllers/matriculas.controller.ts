import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendSuccess, sendError, sendCreated } from '../utils/response.utils';import { any } from 'zod';

const prisma = new PrismaClient();

export const crearMatricula = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;
    const { respuestasAdicionales } = req.body;

    // Verificar si ya tiene una matrícula activa
    const matriculaExistente = await prisma.matricula.findFirst({
      where: {
        usuarioId,
        activa: true
      }
    });

    if (matriculaExistente) {
      return sendError(res, 'Ya tienes una matrícula activa', 400);
    }

    // Generar código único
    const anio = new Date().getFullYear();
    const ultimaMatricula = await prisma.matricula.findFirst({
      orderBy: { id: 'desc' }
    });
    
    const numeroSecuencial = ultimaMatricula ? ultimaMatricula.id + 1 : 1;
    const codigoMatricula = `MAT-${anio}-${numeroSecuencial.toString().padStart(6, '0')}`;

    // Crear matrícula
    const matricula = await prisma.matricula.create({
      data: {
        codigoMatricula,
        usuarioId,
        montoMatricula: 50.00,
        estadoPago: 'pendiente',
        respuestasAdicionales
      },
      include: {
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
            email: true,
            dni: true
          }
        }
      }
    });

    // Obtener métodos de pago disponibles con comisiones
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
    
    // Convertir montoMatricula de Decimal a Number
    const montoBase = Number(matricula.montoMatricula);
    
    if (metodo.comisionPorcentaje) {
      comision = montoBase * (Number(metodo.comisionPorcentaje) / 100);
    }
    if (metodo.comisionFija) {
      comision += Number(metodo.comisionFija);
    }

    return {
      ...metodo,
      esManual: ['yape', 'transferencia_bancaria'].includes(metodo.metodoPago),
      comision: comision.toFixed(2),
        montoFinal: (montoBase + comision).toFixed(2)
      };
    });

    return sendCreated(
      res,
      {
        matricula,
        metodosPago: metodosProcesados,
        mensaje: 'Matrícula creada. Procede al pago para activarla.'
      },
      'Matrícula creada exitosamente'
    );
  } catch (error) {
    throw error;
  }
};

export const obtenerMiMatricula = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.user!.id;

    const matricula = await prisma.matricula.findFirst({
      where: {
        usuarioId,
        activa: true
      },
      include: {
        inscripcionesCurso: {
          include: {
            curso: {
              select: {
                id: true,
                nombre: true,
                codigoCurso: true,
                numeroOrden: true
              }
            }
          }
        }
      }
    });

    if (!matricula) {
      return sendError(res, 'No tienes matrícula activa', 404);
    }

    return sendSuccess(res, matricula);
  } catch (error) {
    throw error;
  }
};

/**
 * DEPRECADO: Usar el flujo de pagos.controller.ts
 * Este endpoint se mantiene solo para compatibilidad
 */
export const confirmarPagoMatricula = async (req: Request, res: Response) => {
  try {
    return sendError(
      res, 
      'Este endpoint está deprecado. Usa POST /api/pagos/manual o POST /api/pagos/gateway', 
      410
    );
  } catch (error) {
    throw error;
  }
};

export const listarMatriculas = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, estado } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (estado) {
      where.estadoPago = estado;
    }

    const [matriculas, total] = await Promise.all([
      prisma.matricula.findMany({
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
          inscripcionesCurso: {
            select: {
              id: true,
              curso: {
                select: {
                  nombre: true
                }
              }
            }
          }
        },
        orderBy: { fechaMatricula: 'desc' }
      }),
      prisma.matricula.count({ where })
    ]);

    return sendSuccess(res, {
      matriculas,
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