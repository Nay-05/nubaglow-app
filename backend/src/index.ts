/**
 * ============================================================================
 * NUBAGLOW APP - SERVIDOR PRINCIPAL EXPRESS Y API REST
 * ============================================================================
 * Proyecto de Ingenieria de Software — Grupo 11 (Nuba Beauty, Sucre, Bolivia)
 * Arquitectura por capas: Routes -> Controllers -> Services -> DB
 */

import express, { Application } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import apiRouter from './routes';
import { proteccionCsrf } from './middlewares/csrf';
import { AppError, manejadorErrores, rutaNoEncontrada } from './middlewares/errores';
import { cerrarPool } from './db';

// 1. Cargar variables de entorno desde la raiz del workspace o backend/
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const app: Application = express();
const PUERTO = Number(process.env.PORT) || 4000;

// Lista blanca de origenes CORS configurable por variable de entorno
const origenesConfigurados = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean) as string[];

// 2. Middlewares de proteccion HTTP y cabeceras de seguridad con Helmet (CLAUDE.md Seccion 9)
app.use(
  helmet({
    contentSecurityPolicy: false, // Permite carga de assets y estilos del SPA vanilla
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' }, // Anti clickjacking
    hidePoweredBy: true, // Ocultar X-Powered-By
    hsts: { maxAge: 31536000, includeSubDomains: true }, // Forzar HTTPS en produccion
    noSniff: true, // X-Content-Type-Options: nosniff
    xssFilter: true // X-XSS-Protection
  })
);

// 3. Configuracion segura de CORS con lista blanca y soporte de credenciales
app.use(
  cors({
    origin: (origen, callback) => {
      // Permitir peticiones sin origen (como Postman, mobile o curl) o que coincidan con la lista blanca
      if (!origen || origenesConfigurados.includes(origen)) {
        callback(null, true);
      } else {
        callback(new AppError(`Origen no permitido por politica CORS: ${origen}`, 403));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
  })
);

// 4. Procesamiento de cuerpo, cookies y proteccion CSRF
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(proteccionCsrf);

// 5. Montar rutas principales de la API (/api)
app.use('/api', apiRouter);

// 6. Manejo de rutas no encontradas (404) y manejo centralizado de errores
app.use(rutaNoEncontrada);
app.use(manejadorErrores);

// 7. Inicio del servidor
let servidor: any;

if (require.main === module && process.env.NODE_ENV !== 'test') {
  servidor = app.listen(PUERTO, () => {
    console.log('============================================================');
    console.log(`NubaGlow Backend iniciado exitosamente`);
    console.log(`Puerto: ${PUERTO}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Endpoint de salud: http://localhost:${PUERTO}/api/salud`);
    console.log(`Frontends permitidos (CORS): ${origenesConfigurados.join(', ')}`);
    console.log('============================================================');
  });

  // Manejo de apagado graceful
  const apagarServidor = async (senal: string) => {
    console.log(`\nRecibida senal ${senal}. Cerrando servidor y pool de base de datos...`);
    if (servidor) {
      servidor.close(async () => {
        await cerrarPool();
        console.log('Servidor NubaGlow cerrado limpiamente.');
        process.exit(0);
      });
    } else {
      await cerrarPool();
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => apagarServidor('SIGTERM'));
  process.on('SIGINT', () => apagarServidor('SIGINT'));
}

export default app;
