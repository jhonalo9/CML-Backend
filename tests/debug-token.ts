import axios from 'axios';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import path from 'path';

// Cargar .env desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = 'http://localhost:5000/api';

async function debugToken() {
  try {
    console.log('🔍 Depurando problema de token...\n');

    // Verificar JWT_SECRET
    console.log('1️⃣  Variables de entorno:');
    console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Definido' : '❌ NO DEFINIDO');
    console.log('   Valor:', process.env.JWT_SECRET?.substring(0, 20) + '...');
    console.log('');

    // Login
    console.log('2️⃣  Haciendo login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'jesus@example.com',
      password: '1234567'
    });

    const token = loginResponse.data.data.accessToken;
    console.log('   ✅ Token recibido');
    console.log('   Token completo:', token);
    console.log('');

    // Decodificar token localmente
    console.log('3️⃣  Decodificando token localmente (sin verificar):');
    const decoded = jwt.decode(token);
    console.log('   Payload:', JSON.stringify(decoded, null, 2));
    console.log('');

    // Verificar token localmente con el mismo secret
    console.log('4️⃣  Verificando token localmente con JWT_SECRET del .env:');
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET!);
      console.log('   ✅ Token válido localmente');
      console.log('   Datos verificados:', JSON.stringify(verified, null, 2));
    } catch (err: any) {
      console.log('   ❌ Token inválido localmente');
      console.log('   Error:', err.message);
    }
    console.log('');

    // Intentar crear curso
    console.log('5️⃣  Probando endpoint protegido...');
    console.log('   Headers que se enviarán:');
    console.log('   Authorization: Bearer ' + token.substring(0, 50) + '...');
    console.log('');

    try {
      const cursoResponse = await axios.post(
        `${BASE_URL}/cursos`,
        {
          nombre: 'Curso Debug',
          descripcion: 'Curso de prueba',
          codigoCurso: 'DEBUG-001',
          numeroOrden: 1,
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

      console.log('   ✅ Curso creado exitosamente');
      console.log('   Respuesta:', cursoResponse.data);

    } catch (error: any) {
      console.log('   ❌ Error al crear curso');
      console.log('   Status:', error.response?.status);
      console.log('   Mensaje:', error.response?.data?.message);
      console.log('   Respuesta completa:', JSON.stringify(error.response?.data, null, 2));
    }

  } catch (error: any) {
    console.error('\n❌ Error general:', error.message);
    if (error.response) {
      console.error('Respuesta del servidor:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugToken();