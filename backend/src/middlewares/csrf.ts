/**
 * ============================================================================
 * NUBAGLOW APP - MIDDLEWARE DE PROTECCION CSRF (CROSS-SITE REQUEST FORGERY)
 * ============================================================================
 * Cumple con CLAUDE.md Seccion 9:
 * 1. Para peticiones que mutan estado (POST, PUT, PATCH, DELETE) autenticadas
 *    mediante cookies (access_token o refresh_token), valida que el encabezado
 *    'Origin' o 'Referer' coincida exactamente con la lista blanca de origenes del frontend
 *    o con el mismo host del servidor.
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

  // Sin cookies no hay CSRF clasico: API clientes usan Authorization Bearer.
  if (!tieneCookiesSesion) {
    return next();
  }

  // Si usa cookies, validar estrictamente el encabezado Origin o Referer
  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  const host = req.headers['host'];
  const esMismoHost = (origenStr: string) => {
    if (!host) return false;
    const origenNormalizado = origenStr.toLowerCase();
    return (
      origenNormalizado === `http://${host}`.toLowerCase() ||
      origenNormalizado === `https://${host}`.toLowerCase()
    );
  };

  const esProduccion = process.env.NODE_ENV === 'production';
  const puertoActual = process.env.PORT || 4000;

  // Lista base sin duplicados; localhost y 127.0.0.1 solo en entornos de desarrollo/test (no production)
  const origenesBase = [
    process.env.APP_URL,
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    'https://nubaglow-web.onrender.com',
    ...(esProduccion
      ? []
      : [
          `http://localhost:${puertoActual}`,
          `http://127.0.0.1:${puertoActual}`,
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:4000',
          'http://127.0.0.1:4000',
          'http://localhost:5173',
          'http://127.0.0.1:5173'
        ])
  ].filter(Boolean) as string[];

  // Eliminar duplicados normalizando a minusculas
  const origenesPermitidos = Array.from(
    new Set(origenesBase.map((o) => o.trim().toLowerCase()))
  );

  // 1. Validar Origin si esta presente (comparacion de igualdad exacta)
  if (origin) {
    const originNormalizado = origin.trim().toLowerCase();
    const esValido =
      esMismoHost(originNormalizado) || origenesPermitidos.includes(originNormalizado);
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

  // 2. Validar Referer si Origin no esta presente (extraccion de origin y comparacion exacta)
  if (referer) {
    let origenReferer: string;
    try {
      const urlParsed = new URL(referer);
      origenReferer = urlParsed.origin.toLowerCase();
    } catch {
      return next(
        new AppError(
          'Solicitud rechazada por proteccion CSRF: encabezado Referer malformado',
          403
        )
      );
    }

    const esValido =
      esMismoHost(origenReferer) || origenesPermitidos.includes(origenReferer);
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

  // 3. Si usa cookies de sesion pero no proporciona ni Origin ni Referer, se rechaza categoricamente
  return next(
    new AppError(
      'Solicitud rechazada por proteccion CSRF: falta verificacion de origen seguro (Origin o Referer ausente)',
      403
    )
  );
}
