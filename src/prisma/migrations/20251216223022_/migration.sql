-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombres` VARCHAR(191) NOT NULL,
    `apellidos` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `sexo` ENUM('Masculino', 'Femenino') NOT NULL,
    `dni` VARCHAR(191) NOT NULL,
    `edad` INTEGER NOT NULL,
    `fechaNacimiento` DATETIME(3) NOT NULL,
    `direccion` VARCHAR(191) NOT NULL,
    `ciudad` VARCHAR(191) NOT NULL,
    `pais` VARCHAR(191) NOT NULL,
    `distritoPertenece` VARCHAR(191) NOT NULL,
    `ocupacion` VARCHAR(191) NULL,
    `profesion` VARCHAR(191) NULL,
    `nivelEstudios` ENUM('Primaria', 'Secundaria', 'Superior') NOT NULL,
    `esMiembroPlenaComunion` BOOLEAN NOT NULL,
    `nombreIglesia` VARCHAR(191) NOT NULL,
    `nombrePastor` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `fotoPerfil` VARCHAR(191) NULL,
    `tipoUsuario` ENUM('estudiante', 'profesor', 'administrador') NOT NULL DEFAULT 'estudiante',
    `estado` ENUM('activo', 'inactivo', 'suspendido') NOT NULL DEFAULT 'activo',
    `verificado` BOOLEAN NOT NULL DEFAULT false,
    `tokenVerificacion` VARCHAR(191) NULL,
    `tokenRecuperacion` VARCHAR(191) NULL,
    `tokenExpiracion` DATETIME(3) NULL,
    `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultimoAcceso` DATETIME(3) NULL,

    UNIQUE INDEX `Usuario_email_key`(`email`),
    UNIQUE INDEX `Usuario_dni_key`(`dni`),
    INDEX `Usuario_email_idx`(`email`),
    INDEX `Usuario_dni_idx`(`dni`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Matricula` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigoMatricula` VARCHAR(191) NOT NULL,
    `usuarioId` INTEGER NOT NULL,
    `fechaMatricula` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `montoMatricula` DECIMAL(10, 2) NOT NULL DEFAULT 50.00,
    `estadoPago` ENUM('pendiente', 'pagado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    `metodoPago` ENUM('paypal', 'yape', 'tarjeta') NULL,
    `referenciaPago` VARCHAR(191) NULL,
    `fechaPago` DATETIME(3) NULL,
    `respuestasAdicionales` JSON NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Matricula_codigoMatricula_key`(`codigoMatricula`),
    INDEX `Matricula_usuarioId_idx`(`usuarioId`),
    INDEX `Matricula_codigoMatricula_idx`(`codigoMatricula`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Curso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigoCurso` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `objetivos` TEXT NULL,
    `numeroOrden` INTEGER NOT NULL,
    `precio` DECIMAL(10, 2) NOT NULL DEFAULT 80.00,
    `esCurricular` BOOLEAN NOT NULL DEFAULT true,
    `totalUnidades` INTEGER NOT NULL DEFAULT 4,
    `totalEvaluaciones` INTEGER NOT NULL DEFAULT 4,
    `tieneExamenFinal` BOOLEAN NOT NULL DEFAULT true,
    `silaboUrl` VARCHAR(191) NULL,
    `imagenPortada` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Curso_codigoCurso_key`(`codigoCurso`),
    UNIQUE INDEX `Curso_numeroOrden_esCurricular_key`(`numeroOrden`, `esCurricular`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfesorCurso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cursoId` INTEGER NOT NULL,
    `profesorId` INTEGER NOT NULL,
    `esPrincipal` BOOLEAN NOT NULL DEFAULT true,
    `fechaAsignacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProfesorCurso_cursoId_profesorId_key`(`cursoId`, `profesorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Unidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cursoId` INTEGER NOT NULL,
    `numeroUnidad` INTEGER NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `objetivos` TEXT NULL,
    `orden` INTEGER NOT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Unidad_cursoId_numeroUnidad_key`(`cursoId`, `numeroUnidad`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contenido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unidadId` INTEGER NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `tipoContenido` ENUM('pdf', 'video_zoom', 'diapositiva', 'otro') NOT NULL,
    `urlArchivo` VARCHAR(191) NOT NULL,
    `tamanoMb` DECIMAL(10, 2) NULL,
    `duracionMinutos` INTEGER NULL,
    `orden` INTEGER NOT NULL,
    `subidoPorId` INTEGER NULL,
    `esContenidoAdicional` BOOLEAN NOT NULL DEFAULT false,
    `fechaSubida` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClaseZoom` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cursoId` INTEGER NOT NULL,
    `unidadId` INTEGER NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `fechaHoraInicio` DATETIME(3) NOT NULL,
    `fechaHoraFin` DATETIME(3) NOT NULL,
    `urlZoom` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NULL,
    `passwordZoom` VARCHAR(191) NULL,
    `urlGrabacion` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'programada',
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClaseZoom_fechaHoraInicio_idx`(`fechaHoraInicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evaluacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cursoId` INTEGER NOT NULL,
    `unidadId` INTEGER NULL,
    `numeroEvaluacion` INTEGER NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `tipo` ENUM('evaluacion_unidad', 'examen_final') NOT NULL,
    `puntuacionMaxima` DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
    `puntuacionMinimaAprobacion` DECIMAL(5, 2) NOT NULL DEFAULT 14.00,
    `duracionMinutos` INTEGER NOT NULL DEFAULT 60,
    `intentosPermitidos` INTEGER NOT NULL DEFAULT 1,
    `fechaDisponible` DATETIME(3) NULL,
    `fechaCierre` DATETIME(3) NULL,
    `instrucciones` TEXT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreguntaEvaluacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `evaluacionId` INTEGER NOT NULL,
    `pregunta` TEXT NOT NULL,
    `tipoPregunta` ENUM('multiple_choice', 'verdadero_falso', 'desarrollo', 'completar') NOT NULL,
    `opciones` JSON NULL,
    `respuestaCorrecta` TEXT NULL,
    `puntos` DECIMAL(5, 2) NOT NULL,
    `orden` INTEGER NOT NULL,
    `retroalimentacion` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InscripcionCurso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `matriculaId` INTEGER NOT NULL,
    `cursoId` INTEGER NOT NULL,
    `fechaInscripcion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `montoCurso` DECIMAL(10, 2) NOT NULL DEFAULT 80.00,
    `estadoPago` ENUM('pendiente', 'pagado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    `metodoPago` ENUM('paypal', 'yape', 'tarjeta') NULL,
    `referenciaPago` VARCHAR(191) NULL,
    `fechaPago` DATETIME(3) NULL,
    `estadoCurso` ENUM('no_iniciado', 'en_progreso', 'completado', 'reprobado') NOT NULL DEFAULT 'no_iniciado',
    `progresoPorcentaje` INTEGER NOT NULL DEFAULT 0,
    `calificacionFinal` DECIMAL(5, 2) NULL,
    `aprobado` BOOLEAN NOT NULL DEFAULT false,
    `fechaInicio` DATETIME(3) NULL,
    `fechaFinalizacion` DATETIME(3) NULL,

    INDEX `InscripcionCurso_estadoCurso_idx`(`estadoCurso`),
    UNIQUE INDEX `InscripcionCurso_usuarioId_cursoId_key`(`usuarioId`, `cursoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgresoContenido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inscripcionCursoId` INTEGER NOT NULL,
    `contenidoId` INTEGER NOT NULL,
    `completado` BOOLEAN NOT NULL DEFAULT false,
    `porcentajeVisto` INTEGER NOT NULL DEFAULT 0,
    `tiempoDedicadoMinutos` INTEGER NOT NULL DEFAULT 0,
    `fechaInicio` DATETIME(3) NULL,
    `fechaCompletado` DATETIME(3) NULL,
    `ultimaActualizacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProgresoContenido_inscripcionCursoId_contenidoId_key`(`inscripcionCursoId`, `contenidoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResultadoEvaluacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inscripcionCursoId` INTEGER NOT NULL,
    `evaluacionId` INTEGER NOT NULL,
    `intentoNumero` INTEGER NOT NULL DEFAULT 1,
    `puntuacionObtenida` DECIMAL(5, 2) NULL,
    `porcentaje` DECIMAL(5, 2) NULL,
    `aprobado` BOOLEAN NULL,
    `respuestas` JSON NULL,
    `fechaInicio` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaFinalizacion` DATETIME(3) NULL,
    `tiempoEmpleadoMinutos` INTEGER NULL,
    `calificado` BOOLEAN NOT NULL DEFAULT false,
    `calificadoPorId` INTEGER NULL,
    `fechaCalificacion` DATETIME(3) NULL,
    `retroalimentacionProfesor` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Certificado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigoCertificado` VARCHAR(191) NOT NULL,
    `usuarioId` INTEGER NOT NULL,
    `matriculaId` INTEGER NOT NULL,
    `fechaEmision` DATETIME(3) NOT NULL,
    `totalCursosCompletados` INTEGER NOT NULL DEFAULT 12,
    `promedioGeneral` DECIMAL(5, 2) NULL,
    `totalHorasCertificadas` INTEGER NULL,
    `urlCertificado` VARCHAR(191) NULL,
    `hashVerificacion` VARCHAR(191) NULL,
    `verificado` BOOLEAN NOT NULL DEFAULT true,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Certificado_codigoCertificado_key`(`codigoCertificado`),
    UNIQUE INDEX `Certificado_hashVerificacion_key`(`hashVerificacion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `tipoPago` ENUM('matricula', 'curso', 'curso_adicional') NOT NULL,
    `idReferencia` INTEGER NOT NULL,
    `codigoTransaccion` VARCHAR(191) NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `metodoPago` ENUM('paypal', 'yape', 'tarjeta') NOT NULL,
    `estado` ENUM('pendiente', 'procesando', 'completado', 'fallido', 'reembolsado') NOT NULL DEFAULT 'pendiente',
    `referenciaExterna` VARCHAR(191) NULL,
    `detallesPago` JSON NULL,
    `comprobanteUrl` VARCHAR(191) NULL,
    `fechaPago` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Pago_codigoTransaccion_key`(`codigoTransaccion`),
    INDEX `Pago_usuarioId_idx`(`usuarioId`),
    INDEX `Pago_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notificacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `tipo` ENUM('pago', 'curso', 'evaluacion', 'clase_zoom', 'sistema') NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `mensaje` TEXT NULL,
    `urlAccion` VARCHAR(191) NULL,
    `leida` BOOLEAN NOT NULL DEFAULT false,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaLectura` DATETIME(3) NULL,

    INDEX `Notificacion_usuarioId_leida_idx`(`usuarioId`, `leida`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Configuracion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clave` VARCHAR(191) NOT NULL,
    `valor` TEXT NULL,
    `descripcion` TEXT NULL,
    `fechaActualizacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Configuracion_clave_key`(`clave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Matricula` ADD CONSTRAINT `Matricula_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfesorCurso` ADD CONSTRAINT `ProfesorCurso_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `Curso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfesorCurso` ADD CONSTRAINT `ProfesorCurso_profesorId_fkey` FOREIGN KEY (`profesorId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Unidad` ADD CONSTRAINT `Unidad_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `Curso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contenido` ADD CONSTRAINT `Contenido_unidadId_fkey` FOREIGN KEY (`unidadId`) REFERENCES `Unidad`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contenido` ADD CONSTRAINT `Contenido_subidoPorId_fkey` FOREIGN KEY (`subidoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClaseZoom` ADD CONSTRAINT `ClaseZoom_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `Curso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClaseZoom` ADD CONSTRAINT `ClaseZoom_unidadId_fkey` FOREIGN KEY (`unidadId`) REFERENCES `Unidad`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evaluacion` ADD CONSTRAINT `Evaluacion_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `Curso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evaluacion` ADD CONSTRAINT `Evaluacion_unidadId_fkey` FOREIGN KEY (`unidadId`) REFERENCES `Unidad`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreguntaEvaluacion` ADD CONSTRAINT `PreguntaEvaluacion_evaluacionId_fkey` FOREIGN KEY (`evaluacionId`) REFERENCES `Evaluacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InscripcionCurso` ADD CONSTRAINT `InscripcionCurso_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InscripcionCurso` ADD CONSTRAINT `InscripcionCurso_matriculaId_fkey` FOREIGN KEY (`matriculaId`) REFERENCES `Matricula`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InscripcionCurso` ADD CONSTRAINT `InscripcionCurso_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `Curso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgresoContenido` ADD CONSTRAINT `ProgresoContenido_inscripcionCursoId_fkey` FOREIGN KEY (`inscripcionCursoId`) REFERENCES `InscripcionCurso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgresoContenido` ADD CONSTRAINT `ProgresoContenido_contenidoId_fkey` FOREIGN KEY (`contenidoId`) REFERENCES `Contenido`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultadoEvaluacion` ADD CONSTRAINT `ResultadoEvaluacion_inscripcionCursoId_fkey` FOREIGN KEY (`inscripcionCursoId`) REFERENCES `InscripcionCurso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultadoEvaluacion` ADD CONSTRAINT `ResultadoEvaluacion_evaluacionId_fkey` FOREIGN KEY (`evaluacionId`) REFERENCES `Evaluacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultadoEvaluacion` ADD CONSTRAINT `ResultadoEvaluacion_calificadoPorId_fkey` FOREIGN KEY (`calificadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Certificado` ADD CONSTRAINT `Certificado_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Certificado` ADD CONSTRAINT `Certificado_matriculaId_fkey` FOREIGN KEY (`matriculaId`) REFERENCES `Matricula`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pago` ADD CONSTRAINT `Pago_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notificacion` ADD CONSTRAINT `Notificacion_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
