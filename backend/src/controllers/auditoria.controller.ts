/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DEL VISOR DE AUDITORIA (ADMIN)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { auditoriaService } from '../services/auditoria.service';

export async function opcionesAuditoria(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const opciones = await auditoriaService.opciones();
    res.status(200).json({ exito: true, datos: opciones });
  } catch (error) {
    next(error);
  }
}

export async function listarAuditoria(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resultado = await auditoriaService.listar(req.query as any);
    res.status(200).json({ exito: true, datos: resultado });
  } catch (error) {
    next(error);
  }
}
