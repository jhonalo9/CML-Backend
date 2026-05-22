import GoogleDriveStorageService from '../services/GoogleDriveStorageService';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Versión corregida con tipos TypeScript
const findAndLoadEnv = (): string | null => {
  const searchPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '.env')
  ];
  
  for (const envPath of searchPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`✅ .env cargado desde: ${envPath}`);
      return envPath;
    }
  }
  
  console.warn('⚠️  No se encontró archivo .env, usando variables del sistema');
  dotenv.config();
  return null;
};

findAndLoadEnv();

// Configuración de Google Drive
const driveConfig = {
  clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:3000/oauth2callback',
  refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || ''
};

// Verificar si tenemos configuración válida
const hasValidConfig = Boolean(
  driveConfig.clientId && 
  driveConfig.clientSecret && 
  driveConfig.refreshToken
);

// Interfaces para TypeScript
interface DriveServiceFallback {
  uploadContenido: (filePath: string, tipoContenido: string) => Promise<never>;
  getEmbedVideoLink: (fileId: string) => string | null;
  getDirectDownloadLink: (fileId: string) => string | null;
  getFileInfo: (fileId: string) => Promise<never>;
  updateFile: (fileId: string, newFilePath: string) => Promise<never>;
  deleteFile: (fileId: string) => Promise<never>;
  bytesToMB: (bytes: number) => number;
  isAvailable: boolean;
  isDriveAvailable?: boolean; // Opcional para compatibilidad
}

// Servicio de fallback
const createFallbackDriveService = (): DriveServiceFallback => {
  const errorMessage = 'Google Drive no está configurado. ' +
    'Para subir archivos, configura las credenciales ejecutando: ' +
    'npx ts-node scripts/generate-drive-token.ts';
    
  return {
    uploadContenido: async (): Promise<never> => {
      throw new Error(errorMessage);
    },
    getEmbedVideoLink: (): null => null,
    getDirectDownloadLink: (): null => null,
    getFileInfo: async (): Promise<never> => {
      throw new Error(errorMessage);
    },
    updateFile: async (): Promise<never> => {
      throw new Error(errorMessage);
    },
    deleteFile: async (): Promise<never> => {
      throw new Error(errorMessage);
    },
    bytesToMB: (bytes: number): number => bytes ? bytes / (1024 * 1024) : 0,
    isAvailable: false,
    isDriveAvailable: false
  };
};

// Crear instancia principal
let driveStorage: GoogleDriveStorageService | DriveServiceFallback;

if (hasValidConfig) {
  try {
    driveStorage = new GoogleDriveStorageService(driveConfig);
    console.log('✅ Servicio de Google Drive inicializado');
    
    // Añadir propiedad isDriveAvailable a la instancia real
    (driveStorage as any).isDriveAvailable = true;
    (driveStorage as any).isAvailable = true;
  } catch (error: unknown) {
    console.error('❌ Error al inicializar Google Drive:', 
      error instanceof Error ? error.message : 'Error desconocido');
    driveStorage = createFallbackDriveService();
  }
} else {
  console.warn('⚠️  Google Drive no configurado - usando modo fallback');
  driveStorage = createFallbackDriveService();
}

// Asegurarse de que la propiedad isDriveAvailable exista
if (!('isDriveAvailable' in driveStorage)) {
  (driveStorage as any).isDriveAvailable = hasValidConfig;
}

export default driveStorage;