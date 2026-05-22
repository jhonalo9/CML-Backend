import { Router } from 'express';
import * as evaluacionesController from  "../controllers/evaluaciones.controller";
import { authMiddleware } from '../middleware/auth.middleware';
import { requireProfesor, requireEstudiante } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Profesor/Admin - Crear y gestionar
router.post('/', requireProfesor, asyncHandler(evaluacionesController.crearEvaluacion));
router.post('/preguntas', requireProfesor, asyncHandler(evaluacionesController.agregarPregunta));
router.get('/pendientes', requireProfesor, asyncHandler(evaluacionesController.listarEvaluacionesPendientes));
router.post('/calificar/:id', requireProfesor, asyncHandler(evaluacionesController.calificarEvaluacion));

// Estudiantes - Rendir evaluaciones
router.get('/curso/:cursoId', requireEstudiante, asyncHandler(evaluacionesController.obtenerEvaluacionesCurso));
router.get('/:id', requireEstudiante, asyncHandler(evaluacionesController.obtenerEvaluacion));
router.post('/:evaluacionId/enviar', requireEstudiante, asyncHandler(evaluacionesController.enviarRespuestas));
router.get('/resultado/:id', requireEstudiante, asyncHandler(evaluacionesController.obtenerResultado));
router.get('/historial/mis-evaluaciones', requireEstudiante, asyncHandler(evaluacionesController.obtenerHistorialEvaluaciones));
router.get('/notas/curso/:cursoId',requireEstudiante,asyncHandler(evaluacionesController.obtenerNotasEstudiante));

export default router;