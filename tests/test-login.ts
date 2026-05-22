import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// IMPORTANTE: Cargar .env desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = 'http://localhost:5000/api';

async function testearAutenticacion() {
  try {
    console.log('🧪 Iniciando pruebas de autenticación...\n');

    // 1. Login
    console.log('1️⃣  Probando login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'jesus@example.com',
      password: '1234567'
    });

    if (loginResponse.data.success) {
      console.log('   ✅ Login exitoso');
      console.log('   Usuario:', loginResponse.data.data.usuario.email);
      console.log('   Tipo:', loginResponse.data.data.usuario.tipoUsuario);
      
      const token = loginResponse.data.data.accessToken;
      console.log('   Token (primeros 30 chars):', token.substring(0, 30) + '...');

      // 2. Verificar token con endpoint protegido
      console.log('\n2️⃣  Probando acceso a endpoint protegido (crear curso)...');
      
      const cursoResponse = await axios.post(
        `${BASE_URL}/cursos`,
        {
          nombre: 'Curso de Prueba',
          descripcion: 'Este es un curso de prueba',
          codigoCurso: 'TEST-001',
          numeroOrden: 7,
          esCurricular: true,
          precio: 80.00,
          totalUnidades: 4
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (cursoResponse.data.success) {
        console.log('   ✅ Curso creado exitosamente');
        console.log('   ID del curso:', cursoResponse.data.data.id);
        console.log('   Nombre:', cursoResponse.data.data.nombre);
      }

      console.log('\n✅ ¡Todas las pruebas pasaron exitosamente!\n');
      console.log('📝 Configuración correcta para Postman:');
      console.log('   URL: POST http://localhost:5000/api/cursos');
      console.log('   Header: Authorization: Bearer ' + token.substring(0, 30) + '...');
      console.log('\n   Copia este token completo para Postman:');
      console.log('   ' + token);

    } else {
      console.log('   ❌ Login falló');
      console.log('   Respuesta:', loginResponse.data);
    }

  } catch (error: any) {
    console.error('\n❌ Error en las pruebas:');
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Mensaje:', error.response.data.message);
      console.error('   Respuesta completa:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No se recibió respuesta del servidor');
      console.error('   ¿Está el servidor corriendo en http://localhost:5000?');
    } else {
      console.error('   Error:', error.message);
    }
  }
}

// Ejecutar
console.log('🚀 Servidor debe estar corriendo en http://localhost:5000\n');
testearAutenticacion();