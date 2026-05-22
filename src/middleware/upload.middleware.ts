import multer from 'multer';
import path from 'path';
import { Request } from 'express';

// ================= CONFIGURACIÓN GENERAL PARA CONTENIDO DE CURSOS =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro para contenido de cursos
const cursoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'pdf', 'ppt', 'pptx', 'doc', 'docx', 'mp4', 'avi'
  ];

  const ext = path.extname(file.originalname).toLowerCase().slice(1);

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido. Solo: ${allowedTypes.join(', ')}`));
  }
};

// Configuración para contenido de cursos
export const upload = multer({
  storage,
  fileFilter: cursoFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '2147483648') // 2GB por defecto
  }
});

// ================= CONFIGURACIÓN ESPECÍFICA PARA COMPROBANTES =================
// Usa memoryStorage para Cloudinary - más eficiente para subidas a la nube
const memoryStorage = multer.memoryStorage();

// Filtro para comprobantes (solo imágenes y PDF)
const comprobanteFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
  ];

  const allowedExtensions = ['.jpeg', '.jpg', '.png', '.webp', '.pdf'];

  const ext = path.extname(file.originalname).toLowerCase();
  const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
  const isValidExtension = allowedExtensions.includes(ext);

  if (isValidMimeType && isValidExtension) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido para comprobantes. Solo: ${allowedExtensions.join(', ')}`));
  }
};

// Configuración para comprobantes (usa memory storage)
export const uploadComprobante = multer({
  storage: memoryStorage, // CAMBIADO: de diskStorage a memoryStorage
  fileFilter: comprobanteFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo para comprobantes
    files: 1 // Solo un archivo
  }
});

// ================= MIDDLEWARES DE USO =================
// Para contenido de cursos
export const uploadSingle = (fieldName: string) => upload.single(fieldName);
export const uploadMultiple = (fieldName: string, maxCount: number = 10) => 
  upload.array(fieldName, maxCount);

export const uploadFields = upload.fields([
  { name: 'pdf', maxCount: 6 },
  { name: 'video', maxCount: 3 },
  { name: 'diapositiva', maxCount: 10 }
]);

// Para comprobantes
export const uploadSingleComprobante = uploadComprobante.single('comprobante');

// Función para limpiar archivos temporales (mantén para compatibilidad)
export const cleanupTempFile = (filePath: string) => {
  const fs = require('fs');
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Archivo temporal eliminado: ${filePath}`);
  }
};