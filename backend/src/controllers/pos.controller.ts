/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE VENTAS POS (MOSTRADOR)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { posService } from '../services/pos.service';

export async function registrarVentaPos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vendedorId = req.usuario!.id;
    const venta = await posService.registrarVentaPos(vendedorId, req.body);
    res.status(201).json({
      exito: true,
      mensaje: 'Venta de mostrador registrada exitosamente',
      datos: { venta }
    });
  } catch (error) {
    next(error);
  }
}

export async function historialVentas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const rolUsuario = req.usuario!.rol;
    const ventas = await posService.historialVentas(usuarioId, rolUsuario);
    res.status(200).json({
      exito: true,
      datos: { ventas }
    });
  } catch (error) {
    next(error);
  }
}

export async function cierreCaja(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const rolUsuario = req.usuario!.rol;
    const fecha = req.query.fecha as string | undefined;
    const resumen = await posService.cierreCaja(usuarioId, rolUsuario, fecha);
    res.status(200).json({
      exito: true,
      datos: { cierre: resumen }
    });
  } catch (error) {
    next(error);
  }
}
