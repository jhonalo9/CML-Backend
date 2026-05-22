import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// Rutas públicas
router.post('/registro', asyncHandler(authController.registro));
router.post('/login', asyncHandler(authController.login));
router.get('/verificar/:token', asyncHandler(authController.verificarEmail));
router.post('/solicitar-recuperacion', asyncHandler(authController.solicitarRecuperacion));
router.post('/restablecer-password/:token', asyncHandler(authController.restablecerPassword));

// Rutas protegidas
router.get('/perfil', authMiddleware, asyncHandler(authController.perfil));
router.put('/perfil', authMiddleware, asyncHandler(authController.actualizarPerfil));

export default router;