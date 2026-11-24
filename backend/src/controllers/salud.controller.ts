/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE SALUD DEL SISTEMA
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { saludService } from '../services/salud.service';
import { diagnosticoNotificaciones } from '../config/env';
import { notificacionesService } from '../services/notificaciones.service';

export async function obtenerSalud(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const diagnostico = await saludService.verificarSalud();
    const codigoEstado = diagnostico.baseDeDatos.conectada ? 200 : 503;
    res.status(codigoEstado).json(diagnostico);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/salud/notificaciones
 * Diagnostico de configuracion sin enviar nada y sin exponer secretos:
 * indica que variables existen, su longitud y los ultimos 4 caracteres.
 */
export function obtenerDiagnosticoNotificaciones(
  _req: Request,
  res: Response
): void {
  res.status(200).json({
    exito: true,
    diagnostico: diagnosticoNotificaciones()
  });
}

/**
 * POST /api/salud/probar-notificaciones
 * Ejecuta una prueba real de correo y Telegram con el entorno actual.
 * Protegido por clave (x-notificaciones-key / body.clave) o sesion admin.
 */
export async function probarNotificaciones(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const correo = typeof req.body?.correo === 'string' ? req.body.correo : undefined;
    const chatId = typeof req.body?.chatId === 'string' ? req.body.chatId : undefined;

    const resultado = await notificacionesService.probarNotificaciones({
      correo,
      chatId
    });

    const exito = resultado.correo.exito && resultado.telegram.exito;

    res.status(exito ? 200 : 502).json({
      exito,
      mensaje: exito
        ? 'Correo y Telegram enviados correctamente'
        : 'Uno o ambos canales fallaron; revisa el detalle exacto',
      resultados: resultado
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Endpoint de prueba para verificar autorizacion de token y roles
 * Utilizado para validacion del Bloque A
 */
export function verificarAutenticacionPrueba(
  req: Request,
  res: Response
): void {
  res.status(200).json({
    exito: true,
    mensaje: 'Autenticacion y permisos verificados exitosamente',
    usuario: req.usuario
  });
}
