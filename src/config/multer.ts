import multer from 'multer';
import { Request } from 'express';

// Configuración de almacenamiento en memoria
const storage = multer.memoryStorage();

// Filtro de archivos permitidos
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    // Imágenes
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    // Documentos
    'application/pdf',
    // Presentaciones
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Videos
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
  }
};

// Configuración principal
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// Para múltiples archivos
export const uploadMultiple = upload.fields([
  { name: 'imagenPortada', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]);