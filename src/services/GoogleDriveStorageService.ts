import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

interface UploadResult {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink: string;
  mimeType: string;
  size: number;
  thumbnailLink?: string |null;
}

interface DriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}

class GoogleDriveStorageService {
  private drive;
  private foldersCache: Map<string, string> = new Map();

  constructor(config: DriveConfig) {
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: config.refreshToken
    });

    this.drive = google.drive({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Crear o obtener carpeta en Drive
   */
  private async getOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
    // Verificar si ya está en caché
    const cacheKey = `${folderName}-${parentId || 'root'}`;
    if (this.foldersCache.has(cacheKey)) {
      return this.foldersCache.get(cacheKey)!;
    }

    try {
      // Buscar carpeta existente
      const query = parentId
        ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (response.data.files && response.data.files.length > 0) {
        const folderId = response.data.files[0].id!;
        this.foldersCache.set(cacheKey, folderId);
        return folderId;
      }

      // Crear nueva carpeta
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : []
      };

      const folder = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
      });

      const folderId = folder.data.id!;
      this.foldersCache.set(cacheKey, folderId);
      return folderId;
    } catch (error) {
      throw new Error(`Error al crear/obtener carpeta: ${error}`);
    }
  }

  /**
   * Crear estructura de carpetas anidadas
   */
  private async createFolderStructure(folderPath: string): Promise<string> {
    const folders = folderPath.split('/').filter(f => f);
    let currentParentId: string | undefined = undefined;

    for (const folder of folders) {
      currentParentId = await this.getOrCreateFolder(folder, currentParentId);
    }

    return currentParentId!;
  }

  /**
   * Subir archivo a Google Drive
   */
  async uploadFile(
    filePath: string,
    folderPath: string = 'ministerio-laico',
    makePublic: boolean = false
  ): Promise<UploadResult> {
    try {
      const folderId = await this.createFolderStructure(folderPath);
      const fileName = path.basename(filePath);
      const mimeType = this.getMimeType(fileName);

      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink, mimeType, size, thumbnailLink'
      });

      // Hacer público si se solicita
      if (makePublic) {
        await this.makeFilePublic(response.data.id!);
      }

      // Eliminar archivo local
      this.deleteLocalFile(filePath);

      return {
        id: response.data.id!,
        name: response.data.name!,
        webViewLink: response.data.webViewLink!,
        webContentLink: response.data.webContentLink || '',
        mimeType: response.data.mimeType!,
        size: parseInt(response.data.size || '0'),
        thumbnailLink: response.data.thumbnailLink
      };
    } catch (error) {
      this.deleteLocalFile(filePath);
      throw new Error(`Error al subir archivo: ${error}`);
    }
  }

  /**
   * Subir video a Google Drive
   */
  async uploadVideo(
    filePath: string,
    folderPath: string = 'ministerio-laico/videos',
    makePublic: boolean = true
  ): Promise<UploadResult> {
    const ext = path.extname(filePath).toLowerCase();
    const validFormats = ['.mp4', '.avi', '.mov', '.wmv', '.mkv', '.flv', '.webm'];

    if (!validFormats.includes(ext)) {
      throw new Error(`Formato de video no soportado: ${ext}`);
    }

    return this.uploadFile(filePath, folderPath, makePublic);
  }

  /**
   * Subir PDF a Google Drive
   */
  async uploadPDF(
    filePath: string,
    folderPath: string = 'ministerio-laico/pdfs',
    makePublic: boolean = true
  ): Promise<UploadResult> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext !== '.pdf') {
      throw new Error('El archivo debe ser un PDF');
    }

    return this.uploadFile(filePath, folderPath, makePublic);
  }

  /**
   * Subir presentación a Google Drive
   */
  async uploadPresentation(
    filePath: string,
    folderPath: string = 'ministerio-laico/presentaciones',
    makePublic: boolean = true
  ): Promise<UploadResult> {
    const ext = path.extname(filePath).toLowerCase();
    const validFormats = ['.ppt', '.pptx', '.pdf', '.odp'];

    if (!validFormats.includes(ext)) {
      throw new Error(`Formato de presentación no soportado: ${ext}`);
    }

    return this.uploadFile(filePath, folderPath, makePublic);
  }

  /**
   * Subir contenido según tipo
   */
  async uploadContenido(
    filePath: string,
    tipoContenido: 'pdf' | 'video_zoom' | 'diapositiva' | 'otro'
  ): Promise<UploadResult> {
    const ext = path.extname(filePath).toLowerCase();

    switch (tipoContenido) {
      case 'pdf':
        return this.uploadPDF(filePath, 'ministerio-laico/contenidos/pdfs');

      case 'video_zoom':
        return this.uploadVideo(filePath, 'ministerio-laico/contenidos/videos');

      case 'diapositiva':
        return this.uploadPresentation(filePath, 'ministerio-laico/contenidos/presentaciones');

      default:
        return this.uploadFile(filePath, 'ministerio-laico/contenidos/otros');
    }
  }

  /**
   * Hacer archivo público
   */
  async makeFilePublic(fileId: string): Promise<void> {
    try {
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
    } catch (error) {
      throw new Error(`Error al hacer archivo público: ${error}`);
    }
  }

  /**
   * Obtener enlace de descarga directa
   */
  getDirectDownloadLink(fileId: string): string {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  /**
   * Obtener enlace para ver video embebido
   */
  getEmbedVideoLink(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  /**
   * Eliminar archivo de Drive
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      await this.drive.files.delete({ fileId });
      return true;
    } catch (error) {
      throw new Error(`Error al eliminar archivo: ${error}`);
    }
  }

  /**
   * Obtener información de un archivo
   */
  async getFileInfo(fileId: string): Promise<any> {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime, modifiedTime'
      });

      return response.data;
    } catch (error) {
      throw new Error(`Error al obtener información del archivo: ${error}`);
    }
  }

  /**
   * Listar archivos en una carpeta
   */
  async listFiles(
    folderPath: string,
    maxResults: number = 100
  ): Promise<any[]> {
    try {
      const folderId = await this.createFolderStructure(folderPath);

      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, webViewLink, thumbnailLink, createdTime)',
        pageSize: maxResults,
        orderBy: 'createdTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      throw new Error(`Error al listar archivos: ${error}`);
    }
  }

  /**
   * Obtener uso de almacenamiento
   */
  async getStorageUsage(): Promise<{ used: number; limit: number; percentage: number }> {
    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota'
      });

      const quota = response.data.storageQuota!;
      const used = parseInt(quota.usage || '0');
      const limit = parseInt(quota.limit || '0');

      return {
        used: used,
        limit: limit,
        percentage: limit > 0 ? (used / limit) * 100 : 0
      };
    } catch (error) {
      throw new Error(`Error al obtener uso de almacenamiento: ${error}`);
    }
  }

  /**
   * Buscar archivos por nombre
   */
  async searchFiles(
    query: string,
    maxResults: number = 50
  ): Promise<any[]> {
    try {
      const response = await this.drive.files.list({
        q: `name contains '${query}' and trashed=false`,
        fields: 'files(id, name, mimeType, size, webViewLink, thumbnailLink)',
        pageSize: maxResults
      });

      return response.data.files || [];
    } catch (error) {
      throw new Error(`Error al buscar archivos: ${error}`);
    }
  }

  /**
   * Descargar archivo
   */
  async downloadFile(fileId: string, destPath: string): Promise<void> {
    try {
      const response = await this.drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      const dest = fs.createWriteStream(destPath);
      
      return new Promise((resolve, reject) => {
        response.data
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .pipe(dest);
      });
    } catch (error) {
      throw new Error(`Error al descargar archivo: ${error}`);
    }
  }

  /**
   * Actualizar archivo existente
   */
  async updateFile(
    fileId: string,
    filePath: string
  ): Promise<UploadResult> {
    try {
      const fileName = path.basename(filePath);
      const mimeType = this.getMimeType(fileName);

      const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.update({
        fileId: fileId,
        media: media,
        fields: 'id, name, webViewLink, webContentLink, mimeType, size, thumbnailLink'
      });

      this.deleteLocalFile(filePath);

      return {
        id: response.data.id!,
        name: response.data.name!,
        webViewLink: response.data.webViewLink!,
        webContentLink: response.data.webContentLink || '',
        mimeType: response.data.mimeType!,
        size: parseInt(response.data.size || '0'),
        thumbnailLink: response.data.thumbnailLink
      };
    } catch (error) {
      this.deleteLocalFile(filePath);
      throw new Error(`Error al actualizar archivo: ${error}`);
    }
  }

  /**
   * Eliminar archivo local temporal
   */
  private deleteLocalFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error al eliminar archivo local: ${error}`);
    }
  }

  /**
   * Validar formato de archivo
   */
  validateFileFormat(filename: string, allowedFormats: string[]): boolean {
    const ext = path.extname(filename).toLowerCase().slice(1);
    return allowedFormats.includes(ext);
  }

  /**
   * Obtener tipo MIME del archivo
   */
  getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.mkv': 'video/x-matroska',
      '.flv': 'video/x-flv',
      '.webm': 'video/webm',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Calcular tamaño en MB
   */
  bytesToMB(bytes: number): number {
    return Number((bytes / (1024 * 1024)).toFixed(2));
  }
}

export default GoogleDriveStorageService;