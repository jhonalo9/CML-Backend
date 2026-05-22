import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, TipoUsuario } from '@prisma/client';

const prisma = new PrismaClient();

interface JwtPayload {
  userId: number;
  email: string;
  tipoUsuario: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        tipoUsuario: TipoUsuario;
      };
    }
  }
}

/**
 * Middleware principal de autenticación
 * Alias: authenticateToken (para compatibilidad)
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación no proporcionado'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verificar token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as JwtPayload;

    // Verificar que el usuario existe y está activo
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        tipoUsuario: true,
        estado: true,
        verificado: true
      }
    });

    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (usuario.estado !== 'activo') {
      return res.status(403).json({
        success: false,
        message: 'Usuario inactivo o suspendido'
      });
    }

    if (!usuario.verificado) {
      return res.status(403).json({
        success: false,
        message: 'Email no verificado'
      });
    }

    // Agregar usuario al request
    req.user = {
      id: usuario.id,
      email: usuario.email,
      tipoUsuario: usuario.tipoUsuario
    };

    // Actualizar último acceso
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() }
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error en autenticación'
    });
  }
};

// Alias para compatibilidad con diferentes nomenclaturas
export const authenticateToken = authMiddleware;

/**
 * Middleware de autenticación opcional
 * No bloquea si no hay token, solo lo valida si existe
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as JwtPayload;

    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        tipoUsuario: true,
        estado: true
      }
    });

    if (usuario && usuario.estado === 'activo') {
      req.user = {
        id: usuario.id,
        email: usuario.email,
        tipoUsuario: usuario.tipoUsuario
      };
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Middleware para autorizar roles específicos
 * Debe usarse DESPUÉS de authMiddleware/authenticateToken
 */
export const authorizeRoles = (...roles: TipoUsuario[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    if (!roles.includes(req.user.tipoUsuario)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. Se requiere uno de los siguientes roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Middleware para verificar que el usuario es administrador
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado'
    });
  }

  if (req.user.tipoUsuario !== 'administrador') {
    return res.status(403).json({
      success: false,
      message: 'Se requieren permisos de administrador'
    });
  }

  next();
};

/**
 * Middleware para verificar que el usuario es profesor
 */
export const requireProfesor = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado'
    });
  }

  if (req.user.tipoUsuario !== 'profesor' && req.user.tipoUsuario !== 'administrador') {
    return res.status(403).json({
      success: false,
      message: 'Se requieren permisos de profesor'
    });
  }

  next();
};

/**
 * Middleware para verificar que el usuario es estudiante
 */
export const requireEstudiante = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado'
    });
  }

  if (req.user.tipoUsuario !== 'estudiante') {
    return res.status(403).json({
      success: false,
      message: 'Solo estudiantes pueden acceder a este recurso'
    });
  }

  next();
};

/**
 * Middleware para verificar propiedad del recurso
 * Verifica que el usuario autenticado sea el dueño del recurso o admin
 */
export const verifyOwnership = (userIdParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    // Los admins pueden acceder a cualquier recurso
    if (req.user.tipoUsuario === 'administrador') {
      return next();
    }

    const resourceUserId = parseInt(req.params[userIdParam]);

    if (isNaN(resourceUserId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    if (req.user.id !== resourceUserId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a este recurso'
      });
    }

    next();
  };
};