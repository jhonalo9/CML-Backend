import { Router } from 'express';
import { 
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getEstadisticas,
  getCursosAdmin,
  getMatriculasAdmin,
  toggleUsuarioEstado,
  getRoles,
  asignarRol,
  buscarUsuarios 
} from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación y rol de administrador
router.use(authMiddleware);

// Middleware para verificar rol de administrador
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || !['administrador', 'profesor'].includes(req.user.tipoUsuario)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren privilegios de administrador'
    });
  }
  next();
};

router.use(requireAdmin);

// Rutas de usuarios
router.get('/usuarios', getUsuarios);
router.get('/usuarios/buscar', buscarUsuarios);
router.get('/usuarios/:id', getUsuarioById);
router.post('/usuarios', createUsuario);
router.put('/usuarios/:id', updateUsuario);
router.delete('/usuarios/:id', deleteUsuario);
router.patch('/usuarios/:id/estado', toggleUsuarioEstado);
router.get('/roles', getRoles);
router.post('/usuarios/:id/rol', asignarRol);

// Rutas de cursos
router.get('/cursos', getCursosAdmin);

// Rutas de matrículas
router.get('/matriculas', getMatriculasAdmin);

// Estadísticas
router.get('/estadisticas', getEstadisticas);

export default router;