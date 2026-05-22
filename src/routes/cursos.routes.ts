import { Router } from 'express';
import * as cursosController from '../controllers/cursos.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireAdmin, requireProfesor, requireEstudiante } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { upload } from '../config/multer';

const router = Router();

// Rutas públicas
router.get('/', asyncHandler(cursosController.listarCursos));
router.get('/:id', asyncHandler(cursosController.obtenerCurso));

// Rutas protegidas - Admin
router.post(
  '/', 
  authMiddleware, 
  requireAdmin, 
  upload.single('imagenPortada'), // ⬅️ Multer + Cloudinary
  asyncHandler(cursosController.crearCurso)
);
router.put(
  '/:id', 
  authMiddleware, 
  requireAdmin,
  upload.single('imagenPortada'), // ⬅️ Para actualizar también
  asyncHandler(cursosController.actualizarCurso)
);
router.delete('/:id', authMiddleware, requireAdmin, asyncHandler(cursosController.eliminarCurso));
router.post('/asignar-profesor', authMiddleware, requireAdmin, asyncHandler(cursosController.asignarProfesor));

router.get('/profesor/mis-cursos', authMiddleware, requireProfesor, asyncHandler(cursosController.obtenerMisCursosProfesor));
router.get('/profesor/estadisticas', authMiddleware, requireProfesor, asyncHandler(cursosController.obtenerEstadisticasProfesor));

// Unidades
router.get('/:cursoId/unidades', authMiddleware, asyncHandler(cursosController.obtenerUnidadesCurso));
router.post('/unidades', authMiddleware, requireProfesor, asyncHandler(cursosController.crearUnidad));
router.put('/unidades/:id', authMiddleware, requireProfesor, asyncHandler(cursosController.actualizarUnidad));

// Clases Zoom
router.post('/clases-zoom', authMiddleware, requireProfesor, asyncHandler(cursosController.programarClaseZoom));
router.get('/:cursoId/clases-zoom', authMiddleware, asyncHandler(cursosController.listarClasesZoom));
router.get('/clases-zoom/proximas', authMiddleware, requireEstudiante, asyncHandler(cursosController.obtenerProximasClases));
router.put('/clases-zoom/:id', authMiddleware, requireProfesor, asyncHandler(cursosController.actualizarClaseZoom));

export default router;