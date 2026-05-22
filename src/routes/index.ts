import { Router } from 'express';
import authRoutes from './auth.routes';
import cursosRoutes from './cursos.routes';
import matriculasRoutes from './matriculas.routes';
import inscripcionesRoutes from './inscripciones.routes';
import evaluacionesRoutes from './evaluaciones.routes';
import contenidosRoutes from './contenidos.routes';
import pagosRoutes from './pagos.routes';
/*import certificadosRoutes from './certificados.routes';*/
import adminRoutes from './admin.routes';


const router = Router();
// Rutas públicas
router.use('/auth', authRoutes);

// Rutas protegidas
router.use('/cursos', cursosRoutes);
router.use('/matriculas', matriculasRoutes);
router.use('/inscripciones', inscripcionesRoutes);
router.use('/evaluaciones', evaluacionesRoutes);
router.use('/contenidos', contenidosRoutes);
router.use('/pagos', pagosRoutes);
/*router.use('/certificados', certificadosRoutes);*/

// Rutas admin
router.use('/admin', adminRoutes);


export default router;