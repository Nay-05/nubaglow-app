/**
 * ============================================================================
 * NUBAGLOW APP - MIDDLEWARE DE PROTECCION CSRF (CROSS-SITE REQUEST FORGERY)
 * ============================================================================
 * Cumple con CLAUDE.md Seccion 9:
 * 1. Para peticiones que mutan estado (POST, PUT, PATCH, DELETE) autenticadas
 *    mediante cookies (access_token o refresh_token), valida que el encabezado
 *    'Origin' o 'Referer' coincida con la lista blanca de orígenes del frontend.
 * 2. Si la peticion proviene de un origen cruzado no autorizado, se bloquea con 403.
 * 3. Se complementa con la directiva 'SameSite: strict' en las cookies HttpOnly.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errores';

const METODOS_MUTACION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function proteccionCsrf(req: Request, res: Response, next: NextFunction): void {
  // Solo aplica a metodos que modifican estado
  if (!METODOS_MUTACION.has(req.method.toUpperCase())) {
    return next();
  }

  // Verificar si la peticion transporta cookies de sesion
  const tieneCookiesSesion = Boolean(req.cookies?.access_token || req.cookies?.refresh_token);

  // Si no usa cookies (por ejemplo, usa Authorization: Bearer en API cliente o scripts), no es vulnerable a CSRF clasico
  if (!tieneCookiesSesion) {
    return next();
  }

  // Si usa cookies, validar estrictamente el encabezado Origin o Referer
  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  const origenesPermitidos = [
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ].filter(Boolean) as string[];

  // Validar Origin
  if (origin) {
    const esValido = origenesPermitidos.some(
      (permitido) => origin.toLowerCase() === permitido.toLowerCase()
    );
    if (!esValido) {
      return next(
        new AppError(
          'Solicitud rechazada por proteccion CSRF: encabezado Origin no autorizado',
          403
        )
      );
    }
    return next();
  }

  // Validar Referer si Origin no esta presente
  if (referer) {
    const esValido = origenesPermitidos.some((permitido) =>
      referer.toLowerCase().startsWith(permitido.toLowerCase())
    );
    if (!esValido) {
      return next(
        new AppError(
          'Solicitud rechazada por proteccion CSRF: encabezado Referer no autorizado',
          403
        )
      );
    }
    return next();
  }

  // Si usa cookies de sesion pero no proporciona ni Origin ni Referer en una mutacion cross-origin sospechosa
  // En entornos de testing permitimos si se define variable de entorno de prueba
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  return next(
    new AppError(
      'Solicitud rechazada por proteccion CSRF: falta verificacion de origen seguro',
      403
    )
  );
}
