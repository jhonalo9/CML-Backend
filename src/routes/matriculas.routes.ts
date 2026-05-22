import { Router } from 'express';
import * as matriculasController from '../controllers/matriculas.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireAdmin, requireEstudiante } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Estudiantes
router.post('/crear', requireEstudiante, asyncHandler(matriculasController.crearMatricula));
router.get('/mi-matricula', requireEstudiante, asyncHandler(matriculasController.obtenerMiMatricula));
router.post('/:id/confirmar-pago', requireEstudiante, asyncHandler(matriculasController.confirmarPagoMatricula));

// Admin
router.get('/', requireAdmin, asyncHandler(matriculasController.listarMatriculas));

export default router;