// Guarda este archivo como: src/scripts/create-admin.ts
// Y ejecuta desde la raíz del proyecto: npx ts-node src/scripts/create-admin.ts

import dotenv from 'dotenv';
dotenv.config(); // Cargar .env desde la raíz

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🚀 Iniciando creación de administrador...\n');

    // Verificar DATABASE_URL
    if (!process.env.DATABASE_URL) {
      console.error('❌ ERROR: No se encontró DATABASE_URL en .env');
      console.error('Asegúrate de tener un archivo .env en la raíz del proyecto');
      process.exit(1);
    }

    console.log('✅ Conectado a la base de datos');

    // Buscar admin existente
    const existente = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: 'admin@ibpch.com' },
          { tipoUsuario: 'administrador' }
        ]
      }
    });

    if (existente) {
      console.log('\n⚠️  Se encontró un usuario administrador existente:');
      console.log('   Email:', existente.email);
      console.log('   Estado:', existente.estado);
      console.log('   Verificado:', existente.verificado);

      // Actualizar para asegurar que esté bien configurado
      const updated = await prisma.usuario.update({
        where: { id: existente.id },
        data: {
          verificado: true,
          estado: 'activo',
          tipoUsuario: 'administrador'
        }
      });

      console.log('\n✅ Administrador actualizado correctamente');
      console.log('\n📋 Usa estas credenciales para login:');
      console.log('   Email:', updated.email);
      console.log('   Password: (tu contraseña actual)');
      
    } else {
      console.log('\n📝 No se encontró administrador, creando uno nuevo...');

      const password = 'Admin123!';
      const hashedPassword = await bcrypt.hash(password, 10);

      const admin = await prisma.usuario.create({
        data: {
          nombres: 'Admin',
          apellidos: 'Sistema',
          email: 'admin@ibpch.com',
          password: hashedPassword,
          sexo: 'Masculino',
          dni: '12345678',
          edad: 30,
          fechaNacimiento: new Date('1994-01-01'),
          direccion: 'Dirección Administrativa',
          ciudad: 'Lima',
          pais: 'Perú',
          distritoPertenece: 'Lima',
          nivelEstudios: 'Superior',
          esMiembroPlenaComunion: true,
          nombreIglesia: 'IBPCH',
          nombrePastor: 'Pastor Principal',
          telefono: '999999999',
          tipoUsuario: 'administrador',
          verificado: true,
          estado: 'activo'
        }
      });

      console.log('\n✅ ¡Administrador creado exitosamente!');
      console.log('\n📋 Credenciales para Postman:');
      console.log('   Email:   ', admin.email);
      console.log('   Password:', password);
      console.log('\n⚠️  IMPORTANTE: Cambia esta contraseña después del primer login');
    }

    console.log('\n🎯 Siguiente paso:');
    console.log('   1. Haz login en: POST http://localhost:5000/api/auth/login');
    console.log('   2. Copia el accessToken de la respuesta');
    console.log('   3. Úsalo en el header: Authorization: Bearer [token]');

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Mensaje:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();