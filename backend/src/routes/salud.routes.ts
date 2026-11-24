/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE SALUD Y VERIFICACION BASE
 * ============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import {
  obtenerSalud,
  obtenerDiagnosticoNotificaciones,
  probarNotificaciones,
  verificarAutenticacionPrueba
} from '../controllers/salud.controller';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { limitadorPruebaNotificaciones } from '../middlewares/seguridad';
import { validar } from '../middlewares/validar';
import { pruebaNotificacionesSchema } from '../schemas/notificaciones.schema';
import { leerVariable } from '../config/env';

const router = Router();

/**
 * Autoriza la prueba de notificaciones con una clave compartida o con sesion
 * de administrador. La clave se envia en `x-notificaciones-key` o en `clave`.
 */
function autorizarPruebaNotificaciones(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const esperada = leerVariable('NOTIFICACIONES_TEST_KEY');
  const recibida = String(
    req.headers['x-notificaciones-key'] ||
      (req.body && req.body.clave) ||
      ''
  ).trim();

  if (esperada && recibida) {
    const bufferEsperado = Buffer.from(esperada);
    const bufferRecibido = Buffer.from(recibida);
    if (
      bufferEsperado.length === bufferRecibido.length &&
      timingSafeEqual(bufferEsperado, bufferRecibido)
    ) {
      return next();
    }
  }

  // Sin clave valida, exigir sesion de administrador.
  verificarToken(req, res, () => requerirRol('admin')(req, res, next));
}

// 1. Diagnostico de salud publico (requerido por CLAUDE.md y la especificacion de entrega)
router.get('/salud', obtenerSalud);

// 2. Diagnostico publico de configuracion de notificaciones (no revela secretos)
router.get('/salud/notificaciones', obtenerDiagnosticoNotificaciones);

// 3. Prueba real de correo y Telegram (clave compartida o sesion admin)
router.post(
  '/salud/probar-notificaciones',
  limitadorPruebaNotificaciones,
  validar({ body: pruebaNotificacionesSchema }),
  autorizarPruebaNotificaciones,
  probarNotificaciones
);

// 4. Ruta protegida de prueba para validar que verificarToken funciona
router.get('/salud/protegida', verificarToken, verificarAutenticacionPrueba);

// 5. Ruta protegida con RBAC para validar requerirRol('admin')
router.get('/salud/solo-admin', verificarToken, requerirRol('admin'), verificarAutenticacionPrueba);

// 6. Ruta protegida con RBAC para roles de personal interno
router.get(
  '/salud/solo-staff',
  verificarToken,
  requerirRol('vendedor', 'almacen', 'logistica', 'admin'),
  verificarAutenticacionPrueba
);

export default router;
