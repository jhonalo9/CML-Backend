// src/config/cloudinary.ts
// Reemplaza o actualiza la función uploadToCloudinary

import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configuración de Cloudinary (asegúrate de tenerla)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Sube una imagen a Cloudinary desde un buffer de memoria
 * @param file - Archivo de multer con buffer
 * @param folder - Carpeta de destino en Cloudinary
 * @returns Promise con URL y publicId
 */
export const uploadToCloudinary = async (
  file: Express.Multer.File,
  folder: string = 'ministerio-laico'
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    // Verificar que el archivo tenga buffer
    if (!file || !file.buffer) {
      console.error('❌ No hay buffer en el archivo:', file);
      return reject(new Error('El archivo no tiene datos (buffer)'));
    }

    console.log('📤 Subiendo a Cloudinary:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      hasBuffer: !!file.buffer,
      bufferLength: file.buffer?.length
    });

    // Crear stream desde el buffer
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto', // Detecta automáticamente el tipo
        format: file.mimetype.startsWith('image/') ? undefined : 'jpg', // Forzar JPG solo para no-imágenes
        transformation: file.mimetype.startsWith('image/') 
          ? [
              { width: 1200, height: 1200, crop: 'limit' }, // Limitar tamaño máximo
              { quality: 'auto:good' } // Optimizar calidad
            ]
          : undefined
      },
      (error, result) => {
        if (error) {
          console.error('❌ Error de Cloudinary:', error);
          return reject(new Error('Error al subir imagen: ' + error.message));
        }

        if (!result) {
          console.error('❌ No se recibió resultado de Cloudinary');
          return reject(new Error('No se recibió respuesta de Cloudinary'));
        }

        console.log('✅ Imagen subida exitosamente:', {
          url: result.secure_url,
          publicId: result.public_id
        });

        resolve({
          url: result.secure_url,
          publicId: result.public_id
        });
      }
    );

    // Convertir buffer a stream y hacer pipe a Cloudinary
    const bufferStream = Readable.from(file.buffer);
    bufferStream.pipe(uploadStream);

    // Manejar errores del stream
    bufferStream.on('error', (error) => {
      console.error('❌ Error en el stream del buffer:', error);
      reject(new Error('Error al procesar el archivo'));
    });

    uploadStream.on('error', (error) => {
      console.error('❌ Error en el upload stream:', error);
      reject(new Error('Error al subir a Cloudinary'));
    });
  });
};

/**
 * Elimina una imagen de Cloudinary
 * @param publicId - ID público de la imagen en Cloudinary
 * @returns Promise<void>
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
    console.log('✅ Imagen eliminada de Cloudinary:', publicId);
  } catch (error) {
    console.error('❌ Error eliminando de Cloudinary:', error);
    throw error;
  }
};

/**
 * Valida que Cloudinary esté configurado correctamente
 */
export const validateCloudinaryConfig = (): boolean => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  
  if (!cloud_name || !api_key || !api_secret) {
    console.error('❌ Cloudinary no está configurado correctamente');
    console.error('Variables requeridas:', {
      CLOUDINARY_CLOUD_NAME: !!cloud_name,
      CLOUDINARY_API_KEY: !!api_key,
      CLOUDINARY_API_SECRET: !!api_secret
    });
    return false;
  }

  console.log('✅ Cloudinary configurado correctamente:', cloud_name);
  return true;
};

// ============================================
// ALTERNATIVA: Si sigues teniendo problemas
// Usa esta versión simplificada
// ============================================

export const uploadToCloudinarySimple = async (
  file: Express.Multer.File,
  folder: string = 'ministerio-laico'
): Promise<{ url: string; publicId: string }> => {
  try {
    // Validar archivo
    if (!file || !file.buffer) {
      throw new Error('Archivo inválido o sin datos');
    }

    console.log('📤 Iniciando subida a Cloudinary...');

    // Convertir buffer a base64
    const base64File = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    // Subir usando upload con base64
    const result = await cloudinary.uploader.upload(base64File, {
      folder: folder,
      resource_type: 'auto',
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' },
        { quality: 'auto:good' }
      ]
    });

    console.log('✅ Subida exitosa:', result.secure_url);

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error: any) {
    console.error('❌ Error en uploadToCloudinarySimple:', error);
    throw new Error('Error al subir imagen: ' + error.message);
  }
};
