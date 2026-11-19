/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE VERIFICACION DE PAGOS
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { pagosService } from '../services/pagos.service';

export async function listarPagosEnVerificacion(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pagos = await pagosService.listarEnVerificacion();
    res.status(200).json({
      exito: true,
      datos: { pagos }
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerPago(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagoId = Number(req.params.id);
    const pago = await pagosService.obtenerDetalle(pagoId);
    res.status(200).json({
      exito: true,
      datos: { pago }
    });
  } catch (error) {
    next(error);
  }
}

export async function aprobarPago(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagoId = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const resultado = await pagosService.aprobar(pagoId, usuarioId);

    res.status(200).json({
      exito: true,
      mensaje: 'Pago aprobado exitosamente',
      datos: { pago: resultado }
    });
  } catch (error) {
    next(error);
  }
}

export async function rechazarPago(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagoId = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const { motivo } = req.body;
    const resultado = await pagosService.rechazar(pagoId, motivo, usuarioId);

    res.status(200).json({
      exito: true,
      mensaje: 'Pago rechazado y registrado en auditoria',
      datos: { pago: resultado }
    });
  } catch (error) {
    next(error);
  }
}
