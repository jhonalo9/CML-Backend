import app from '../app';
//import { PrismaClient } from '@prisma/client';

import { prisma} from './lib/prisma';

//const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    
    // Conectar a la base de datos
    await prisma.$connect();
    console.log('✅ Conectado a la base de datos PostgreSQL');

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📝 Ambiente: ${process.env.NODE_ENV}`);
      console.log(`🌐 API URL: ${process.env.API_URL}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT recibido, cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();