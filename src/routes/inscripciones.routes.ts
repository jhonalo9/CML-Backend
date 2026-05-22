// routes/inscripciones.route.ts
import { Router } from 'express';
import * as inscripcionesController from '../controllers/inscripciones.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireEstudiante, requireProfesor } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Estudiantes
router.post('/inscribir', requireEstudiante, asyncHandler(inscripcionesController.inscribirseACurso));
router.post('/inscribir-multiples', requireEstudiante, asyncHandler(inscripcionesController.inscribirseACursosMultiples));
router.get('/mis-inscripciones', requireEstudiante, asyncHandler(inscripcionesController.obtenerMisInscripciones));
router.get('/disponibles', requireEstudiante, asyncHandler(inscripcionesController.obtenerCursosDisponibles));
router.get('/progreso-general', requireEstudiante, asyncHandler(inscripcionesController.obtenerProgresoGeneral));
router.get('/pendientes-pago', requireEstudiante, asyncHandler(inscripcionesController.obtenerInscripcionesPendientesPago));
router.get('/:id', requireEstudiante, asyncHandler(inscripcionesController.obtenerDetalleInscripcion));
router.post('/:id/confirmar-pago', requireEstudiante, asyncHandler(inscripcionesController.confirmarPagoCurso));
router.post('/confirmar-pago-multiples', requireEstudiante, asyncHandler(inscripcionesController.confirmarPagoMultiplesCursos));
router.delete('/:id/cancelar', requireEstudiante, asyncHandler(inscripcionesController.cancelarInscripcion));


router.post('/calcular-descuento', requireEstudiante, asyncHandler(inscripcionesController.calcularDescuentoMultiples));

// Profesor/Admin
router.get('/curso/:cursoId', requireProfesor, asyncHandler(inscripcionesController.listarInscripcionesCurso));

export default router;