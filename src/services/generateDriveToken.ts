// Guarda este archivo como: scripts/generate-drive-token.ts
// Ejecuta: npx ts-node scripts/generate-drive-token.ts

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import readline from 'readline';

// ⚠️ IMPORTANTE: Cargar .env PRIMERO
// Detectar la ubicación correcta del .env
const findEnvPath = (): string => {
  const possiblePaths = [
    path.resolve(__dirname, '../.env'),           // Si está en scripts/
    path.resolve(__dirname, '../../.env'),        // Si está en src/services/
    path.resolve(process.cwd(), '.env'),          // Raíz actual
    path.resolve(__dirname, '.env')               // Mismo directorio
  ];

  for (const envPath of possiblePaths) {
    if (require('fs').existsSync(envPath)) {
      console.log('✅ Archivo .env encontrado en:', envPath, '\n');
      return envPath;
    }
  }

  console.error('❌ No se encontró el archivo .env');
  console.error('Ubicaciones buscadas:');
  possiblePaths.forEach(p => console.error('  -', p));
  process.exit(1);
};

dotenv.config({ path: findEnvPath() });

// Scopes necesarios para Google Drive
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

async function generateToken() {
  console.log('\n🔐 Generador de Refresh Token para Google Drive\n');
  console.log('═══════════════════════════════════════════════\n');

  // Verificar que las credenciales estén configuradas
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

  console.log('📋 Verificando credenciales del .env:');
  console.log('   CLIENT_ID:', clientId ? '✅ Definido' : '❌ NO DEFINIDO');
  console.log('   CLIENT_SECRET:', clientSecret ? '✅ Definido' : '❌ NO DEFINIDO');
  console.log('   REDIRECT_URI:', redirectUri);
  console.log('');

  if (!clientId || !clientSecret) {
    console.error('❌ ERROR: GOOGLE_DRIVE_CLIENT_ID y GOOGLE_DRIVE_CLIENT_SECRET deben estar en .env\n');
    console.error('Pasos para obtener las credenciales:\n');
    console.error('1. Ve a: https://console.cloud.google.com/');
    console.error('2. Crea un proyecto nuevo o selecciona uno existente');
    console.error('3. Habilita la Google Drive API');
    console.error('4. Ve a "Credenciales" > "Crear credenciales" > "ID de cliente OAuth 2.0"');
    console.error('5. Tipo: "Aplicación de escritorio" o "Aplicación web"');
    console.error('6. Para "Aplicación web", agrega en URIs de redirección:');
    console.error('   - http://localhost:3000/oauth2callback');
    console.error('7. Copia el Client ID y Client Secret al .env\n');
    process.exit(1);
  }

  // Crear cliente OAuth2
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  // Generar URL de autorización
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Necesario para obtener refresh token
    scope: SCOPES,
    prompt: 'consent' // Fuerza a mostrar la pantalla de consentimiento
  });

  console.log('═══════════════════════════════════════════════');
  console.log('📝 PASO 1: Autorización');
  console.log('═══════════════════════════════════════════════\n');
  console.log('Abre esta URL en tu navegador:\n');
  console.log(authUrl);
  console.log('\n');
  console.log('Instrucciones:');
  console.log('1. Inicia sesión con tu cuenta de Google');
  console.log('2. Autoriza todos los permisos solicitados');
  console.log('3. Serás redirigido a una página (puede dar error, está bien)');
  console.log('4. Copia el código de la URL (después de "code=")');
  console.log('');

  // Leer el código de autorización
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('📝 PASO 2: Pega el código de autorización aquí: ', async (code) => {
    try {
      console.log('\n⏳ Intercambiando código por tokens...\n');

      // Intercambiar código por tokens
      const { tokens } = await oauth2Client.getToken(code.trim());
      
      if (!tokens.refresh_token) {
        console.error('❌ ERROR: No se recibió refresh_token\n');
        console.error('Esto puede pasar si ya autorizaste la app anteriormente.');
        console.error('Solución:');
        console.error('1. Ve a: https://myaccount.google.com/permissions');
        console.error('2. Busca tu aplicación');
        console.error('3. Haz clic en "Quitar acceso"');
        console.error('4. Ejecuta este script nuevamente\n');
        rl.close();
        process.exit(1);
      }

      console.log('✅ ¡Tokens obtenidos exitosamente!\n');
      console.log('═══════════════════════════════════════════════');
      console.log('📋 ACTUALIZA TU ARCHIVO .env CON ESTOS VALORES:');
      console.log('═══════════════════════════════════════════════\n');
      console.log('GOOGLE_DRIVE_CLIENT_ID="' + clientId + '"');
      console.log('GOOGLE_DRIVE_CLIENT_SECRET="' + clientSecret + '"');
      console.log('GOOGLE_DRIVE_REDIRECT_URI="' + redirectUri + '"');
      console.log('GOOGLE_DRIVE_REFRESH_TOKEN="' + tokens.refresh_token + '"');
      console.log('\n═══════════════════════════════════════════════\n');

      // Información adicional
      console.log('ℹ️  Información del token:');
      console.log('   Access Token (expira pronto):', tokens.access_token?.substring(0, 30) + '...');
      console.log('   Token Type:', tokens.token_type);
      if (tokens.expiry_date) {
        console.log('   Expira:', new Date(tokens.expiry_date).toLocaleString());
      }
      console.log('   Scopes:', tokens.scope);
      console.log('\n✅ El refresh_token NO expira (a menos que revoques el acceso)\n');
      console.log('⚠️  IMPORTANTE: Guarda el refresh_token de forma segura');
      console.log('   Nunca lo compartas ni lo subas a repositorios públicos\n');

      rl.close();
    } catch (error: any) {
      console.error('\n❌ Error al obtener tokens:', error.message);
      console.error('\nPosibles causas:');
      console.error('- El código de autorización es inválido o ya fue usado');
      console.error('- El código expiró (son válidos por pocos minutos)');
      console.error('- Las credenciales OAuth no coinciden');
      console.error('\nIntenta:');
      console.error('1. Ejecutar el script de nuevo');
      console.error('2. Generar un nuevo código de autorización\n');
      rl.close();
      process.exit(1);
    }
  });
}

generateToken();