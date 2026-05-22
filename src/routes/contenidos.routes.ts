import { Router } from 'express';
import * as contenidosController from "../controllers/contenidos.controller";
import { authMiddleware } from '../middleware/auth.middleware';
import { requireProfesor, requireEstudiante } from '../middleware/role.middleware';
import { uploadSingle } from '../middleware/upload.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Subir contenido (Admin o Profesor)
router.post(
  '/subir',
  requireProfesor,
  uploadSingle('file'),
  asyncHandler(contenidosController.subirContenido)
);

// Obtener contenidos de una unidad
router.get(
  '/unidad/:unidadId',
  requireEstudiante,
  asyncHandler(contenidosController.obtenerContenidosUnidad)
);

// Obtener un contenido específico
router.get(
  '/:id',
  requireEstudiante,
  asyncHandler(contenidosController.obtenerContenido)
);

// Actualizar contenido
router.put(
  '/:id',
  requireProfesor,
  asyncHandler(contenidosController.actualizarContenido)
);

// Eliminar contenido
router.delete(
  '/:id',
  requireProfesor,
  asyncHandler(contenidosController.eliminarContenido)
);

// Marcar contenido como completado
router.post(
  '/:id/completar',
  requireEstudiante,
  asyncHandler(contenidosController.marcarContenidoCompletado)
);

// Obtener progreso en contenidos
router.get(
  '/progreso/:cursoId',
  requireEstudiante,
  asyncHandler(contenidosController.obtenerProgresoContenidos)
);

export default router;