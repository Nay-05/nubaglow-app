/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE SALUD DEL SISTEMA
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { saludService } from '../services/salud.service';

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
