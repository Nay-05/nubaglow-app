/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DEL ASISTENTE IA
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { asistenteService } from '../services/asistente.service';

export async function consultarAsistente(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resultado = await asistenteService.consultar(req.body);
    res.status(200).json({ exito: true, datos: resultado });
  } catch (error) {
    next(error);
  }
}
