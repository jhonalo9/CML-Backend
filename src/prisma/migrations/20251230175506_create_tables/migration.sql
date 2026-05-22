/*
  Warnings:

  - The values [tarjeta] on the enum `ConfiguracionPago_metodoPago` will be removed. If these variants are still used in the database, this will fail.
  - The values [tarjeta] on the enum `ConfiguracionPago_metodoPago` will be removed. If these variants are still used in the database, this will fail.
  - The values [tarjeta] on the enum `ConfiguracionPago_metodoPago` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `montoTotal` to the `Pago` table without a default value. This is not possible if the table is not empty.
  - Made the column `codigoTransaccion` on table `pago` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `contenido` ADD COLUMN `driveFileId` VARCHAR(191) NULL,
    ADD COLUMN `urlEmbed` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `inscripcioncurso` MODIFY `metodoPago` ENUM('yape', 'transferencia_bancaria', 'mercado_pago', 'stripe', 'paypal') NULL;

-- AlterTable
ALTER TABLE `matricula` MODIFY `metodoPago` ENUM('yape', 'transferencia_bancaria', 'mercado_pago', 'stripe', 'paypal') NULL;

-- AlterTable
ALTER TABLE `pago` ADD COLUMN `checkoutSessionId` VARCHAR(191) NULL,
    ADD COLUMN `comision` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `fechaExpiracion` DATETIME(3) NULL,
    ADD COLUMN `fechaOperacion` DATETIME(3) NULL,
    ADD COLUMN `fechaValidacion` DATETIME(3) NULL,
    ADD COLUMN `ipAddress` VARCHAR(191) NULL,
    ADD COLUMN `montoTotal` DECIMAL(10, 2) NOT NULL,
    ADD COLUMN `numeroOperacion` VARCHAR(191) NULL,
    ADD COLUMN `paymentIntentId` VARCHAR(191) NULL,
    ADD COLUMN `razonRechazo` TEXT NULL,
    ADD COLUMN `userAgent` VARCHAR(191) NULL,
    ADD COLUMN `validadoPorId` INTEGER NULL,
    ADD COLUMN `webhookData` JSON NULL,
    MODIFY `codigoTransaccion` VARCHAR(191) NOT NULL,
    MODIFY `metodoPago` ENUM('yape', 'transferencia_bancaria', 'mercado_pago', 'stripe', 'paypal') NOT NULL,
    MODIFY `estado` ENUM('pendiente', 'pendiente_validacion', 'procesando', 'completado', 'fallido', 'reembolsado') NOT NULL DEFAULT 'pendiente';

-- CreateTable
CREATE TABLE `ConfiguracionPago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `metodoPago` ENUM('yape', 'transferencia_bancaria', 'mercado_pago', 'stripe', 'paypal') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `nombreTitular` VARCHAR(191) NULL,
    `numeroCuenta` VARCHAR(191) NULL,
    `nombreBanco` VARCHAR(191) NULL,
    `tipoCuenta` VARCHAR(191) NULL,
    `numeroCelular` VARCHAR(191) NULL,
    `publicKey` VARCHAR(191) NULL,
    `secretKey` VARCHAR(191) NULL,
    `webhookSecret` VARCHAR(191) NULL,
    `comisionPorcentaje` DECIMAL(5, 2) NULL,
    `comisionFija` DECIMAL(10, 2) NULL,
    `config` JSON NULL,
    `instrucciones` TEXT NULL,
    `fechaActualizacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ConfiguracionPago_metodoPago_key`(`metodoPago`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Contenido_driveFileId_idx` ON `Contenido`(`driveFileId`);

-- CreateIndex
CREATE INDEX `Pago_metodoPago_idx` ON `Pago`(`metodoPago`);

-- CreateIndex
CREATE INDEX `Pago_fechaPago_idx` ON `Pago`(`fechaPago`);

-- AddForeignKey
ALTER TABLE `Pago` ADD CONSTRAINT `Pago_validadoPorId_fkey` FOREIGN KEY (`validadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `Contenido_unidadId_idx` ON `Contenido`(`unidadId`);
DROP INDEX `Contenido_unidadId_fkey` ON `contenido`;
