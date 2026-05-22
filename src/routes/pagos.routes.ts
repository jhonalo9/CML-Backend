import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import * as pagosController from '../controllers/pagos.controller';
import { uploadComprobante } from '../middleware/upload.middleware';

const router = Router();

// ================= RUTAS ESPECÍFICAS PRIMERO =================

/**
 * Rutas públicas de información
 */
router.get(
  '/metodos',
  authenticateToken,
  pagosController.obtenerMetodosPago
);

/**
 * Rutas para iniciar pagos (Estudiante)
 */
router.post(
  '/manual',
  authenticateToken,
  uploadComprobante.single('comprobante'),
  pagosController.iniciarPagoManual
);

router.post(
  '/manual-multiple',
  authenticateToken,
  uploadComprobante.single('comprobante'),
  pagosController.iniciarPagoManualMultiple
);

router.post(
  '/gateway',
  authenticateToken,
  pagosController.iniciarPagoGateway
);

/**
 * Verificación de pagos de gateway (callback)
 */
router.get(
  '/verificar/:metodoPago/:sessionId',
  pagosController.verificarPagoGateway
);

/**
 * Historial y detalles de pagos (Estudiante)
 */
router.get(
  '/mi-historial',
  authenticateToken,
  pagosController.obtenerMiHistorialPagos
);

router.get(
  '/admin/todos',  
  authenticateToken,
  authorizeRoles('administrador'),
  pagosController.listarTodosPagos
);

/**
 * Rutas de administración (Admin) - DEBEN ESTAR ANTES DE /:id
 */
router.get(
  '/admin/pendientes',
  authenticateToken,
  authorizeRoles('administrador'),
  pagosController.listarPagosPendientesValidacion
);

router.post(
  '/admin/:id/validar',
  authenticateToken,
  authorizeRoles('administrador'),
  pagosController.validarPagoManual
);

// ================= RUTAS CON PARÁMETROS AL FINAL =================

/**
 * Obtener detalle de un pago
 * ESTA DEBE SER LA ÚLTIMA RUTA
 */
router.get(
  '/:id',
  authenticateToken,
  pagosController.obtenerDetallePago
);

export default router;