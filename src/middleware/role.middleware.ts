import { Request, Response, NextFunction } from 'express';

type RolPermitido = 'estudiante' | 'profesor' | 'administrador';

export const requireRole = (...rolesPermitidos: RolPermitido[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    if (!rolesPermitidos.includes(req.user.tipoUsuario as RolPermitido)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción'
      });
    }

    next();
  };
};

export const requireAdmin = requireRole('administrador');
export const requireProfesor = requireRole('profesor', 'administrador');
export const requireEstudiante = requireRole('estudiante', 'profesor', 'administrador');