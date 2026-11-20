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
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import apiRouter from './routes';
import { proteccionCsrf } from './middlewares/csrf';
import { AppError, manejadorErrores, rutaNoEncontrada } from './middlewares/errores';
import { cerrarPool } from './db';
import { limiteCuerpoComprobante } from './config/comprobantes';

// 1. Cargar variables de entorno desde la raiz del workspace o backend/
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const app: Application = express();
const PUERTO = Number(process.env.PORT) || 4000;
const rutaFrontend = path.resolve(__dirname, '..', '..');

// Lista blanca de origenes CORS configurable por variable de entorno
const origenesConfigurados = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  `http://localhost:${PUERTO}`,
  `http://127.0.0.1:${PUERTO}`,
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean) as string[];

// 2. Middlewares de proteccion HTTP y cabeceras de seguridad con Helmet (CLAUDE.md Seccion 9)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // Scripts solo propios (sin inline)
        styleSrc: ["'self'", 'https://fonts.googleapis.com'], // Estilos solo propios y Google Fonts (sin inline)
        fontSrc: ["'self'", 'https://fonts.gstatic.com'], // Fuentes de Google Fonts
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'], // Propias, preview y CDN
        connectSrc: ["'self'"], // Comunicacion fetch con la API
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' }, // Anti clickjacking
    hidePoweredBy: true, // Ocultar X-Powered-By
    hsts: { maxAge: 31536000, includeSubDomains: true }, // Forzar HTTPS en produccion
    noSniff: true, // X-Content-Type-Options: nosniff
    xssFilter: true // X-XSS-Protection
  })
);

// 3. Configuracion segura de CORS con lista blanca y soporte de credenciales
// Permite solicitudes del mismo origen (host del servidor), lista blanca configurada y llamadas locales
app.use(
  cors((req, callback) => {
    const origen = req.headers.origin;
    const host = req.headers.host;
    const esMismoOrigen = Boolean(
      origen && host && (origen === `http://${host}` || origen === `https://${host}`)
    );

    if (!origen || esMismoOrigen || origenesConfigurados.includes(origen)) {
      callback(null, {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
      });
    } else {
      callback(new AppError(`Origen no permitido por politica CORS: ${origen}`, 403));
    }
  })
);

// 4. Procesamiento de cuerpo, cookies y proteccion CSRF
// El limite se calcula desde COMPROBANTE_MAX_MB (por defecto 2 MB de archivo).
const limiteCuerpo = limiteCuerpoComprobante();
app.use(express.json({ limit: limiteCuerpo }));
app.use(express.urlencoded({ extended: true, limit: limiteCuerpo }));
app.use(cookieParser());
app.use(proteccionCsrf);

// 5. Servir estaticos del frontend (css, js, assets, favicon)
app.use('/css', express.static(path.join(rutaFrontend, 'css')));
app.use('/js', express.static(path.join(rutaFrontend, 'js')));
app.use(
  '/assets',
  express.static(path.join(rutaFrontend, 'assets'), {
    setHeaders: (res, archivo) => {
      if (archivo.toLowerCase().endsWith('.avif')) {
        res.setHeader('Content-Type', 'image/avif');
      }
    }
  })
);
app.get('/favicon.ico', (_req, res) => {
  res.sendFile(path.join(rutaFrontend, 'assets', 'brand', 'icono1.png'));
});

// 6. Montar rutas principales de la API (/api)
app.use('/api', apiRouter);

// Asegurar que rutas no encontradas en /api/* devuelvan error 404 JSON estructurado
app.use('/api', rutaNoEncontrada);

// 7. Proteccion server-side de rutas internas del personal (/staff/*)
// Si la peticion no trae sesion valida de personal, redirige a /staff/login.
// Si es un cliente, redirige a / (CLAUDE.md Seccion 3).
app.get(/^\/staff(?:\/.*)?$/, (req, res, next) => {
  // /staff/login es de libre acceso para renderizar el formulario de autenticacion
  if (req.path === '/staff/login' || req.path === '/staff/login/') {
    return next();
  }

  // Verificar si hay sesion valida mediante cookie access_token o refresh_token
  const token = req.cookies?.access_token || req.cookies?.token;
  const refreshToken = req.cookies?.refresh_token;
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  let usuarioValido: any = null;

  if (token && jwtSecret) {
    try {
      usuarioValido = jwt.verify(token, jwtSecret);
    } catch {
      // Si el access_token expiro, comprobar si existe un refresh_token valido
      if (refreshToken && jwtRefreshSecret) {
        try {
          usuarioValido = jwt.verify(refreshToken, jwtRefreshSecret);
        } catch {
          usuarioValido = null;
        }
      }
    }
  } else if (refreshToken && jwtRefreshSecret) {
    try {
      usuarioValido = jwt.verify(refreshToken, jwtRefreshSecret);
    } catch {
      usuarioValido = null;
    }
  }

  // 1. Si no hay sesion valida o la cuenta esta inactiva: redirigir al login de staff
  if (!usuarioValido || usuarioValido.activo === false) {
    return res.redirect('/staff/login');
  }

  // 2. Si el usuario autenticado tiene rol 'cliente': denegar y redirigir a la tienda publica
  if (usuarioValido.rol === 'cliente') {
    return res.redirect('/');
  }

  // 3. Es miembro autorizado del personal ('admin', 'almacen', 'logistica', 'vendedor'): permitir servir la SPA
  return next();
});

// 8. Fallback SPA para la navegacion en frontend (devuelve index.html para que F5 no de 404)
app.get('*', (req, res, next) => {
  // Las rutas de API ya fueron procesadas; si llegara alguna aqui, pasar al 404
  if (req.path.startsWith('/api')) {
    return next();
  }

  // Si la ruta pide un archivo con extension (js, css, png, svg, ico, map, etc.)
  // NO se debe devolver index.html: seria un 404 disfrazado de HTML y el navegador
  // fallaria con "Expected a JavaScript module script but server responded text/html".
  if (/\/[^/]+\.[a-z0-9]+$/i.test(req.path)) {
    return next();
  }

  const archivoIndex = path.join(rutaFrontend, 'index.html');
  if (fs.existsSync(archivoIndex)) {
    return res.sendFile(archivoIndex);
  }
  return next();
});

// 9. Manejo de rutas no encontradas (404) y manejo centralizado de errores
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
