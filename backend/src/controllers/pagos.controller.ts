/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE VERIFICACION DE PAGOS
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { pagosService } from '../services/pagos.service';
import {
  obtenerDatosCobro,
  obtenerImagenQrPublica
} from '../config/cobro';

/**
 * Datos de cobro para el cliente autenticado. Los valores bancarios salen
 * exclusivamente del entorno del servidor; nunca se escriben en el frontend.
 */
export async function obtenerDatosCobroCliente(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const datos = obtenerDatosCobro();
    res.status(200).json({
      exito: true,
      datos: {
        ...datos,
        qrImagenUrl: obtenerImagenQrPublica()
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function listarPagosEnVerificacion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const estado = String(req.query.estado || 'En verificación');
    const pagos = await pagosService.listarEnVerificacion(estado);
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

export async function cancelarPagosVencidos(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const cancelados = await pagosService.cancelarVencidos(usuarioId);

    res.status(200).json({
      exito: true,
      mensaje:
        cancelados.length > 0
          ? `Se cancelaron ${cancelados.length} pago(s) vencido(s) y se repuso el stock`
          : 'No hay pagos vencidos pendientes de cancelacion',
      datos: { total: cancelados.length, cancelados }
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
