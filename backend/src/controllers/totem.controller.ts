/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DEL TOTEM DE AUTOSERVICIO
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { totemService } from '../services/totem.service';

export async function obtenerCatalogoTotem(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const catalogo = await totemService.catalogo();
    res.status(200).json({ exito: true, datos: catalogo });
  } catch (error) {
    next(error);
  }
}

export async function registrarVentaTotem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ticket = await totemService.registrarVenta(req.body);
    res.status(201).json({
      exito: true,
      mensaje: 'Pago aprobado y venta de autoservicio registrada',
      datos: { ticket }
    });
  } catch (error) {
    next(error);
  }
}
