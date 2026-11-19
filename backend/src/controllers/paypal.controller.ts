/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE PAGOS PAYPAL
 * ============================================================================
 * Solo clientes autenticados y duenos del pedido. Ningun monto ni estado de
 * aprobacion se acepta desde el navegador.
 */

import { Request, Response, NextFunction } from 'express';
import { paypalService } from '../services/paypal.service';

export async function crearOrdenPaypal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pedidoId = Number(req.body.pedido_id);
    const usuarioId = req.usuario!.id;
    const orden = await paypalService.crear(pedidoId, usuarioId);

    res.status(201).json({
      exito: true,
      mensaje: 'Orden PayPal creada. Redirija al cliente a urlAprobacion',
      datos: { orden }
    });
  } catch (error) {
    next(error);
  }
}

export async function capturarOrdenPaypal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pedidoId = Number(req.body.pedido_id);
    const ordenId = String(req.body.orden_id);
    const usuarioId = req.usuario!.id;
    const captura = await paypalService.capturar(pedidoId, ordenId, usuarioId);

    res.status(200).json({
      exito: true,
      mensaje: captura.idempotente
        ? 'La captura ya estaba registrada; el pago sigue Aprobado'
        : 'Pago capturado y aprobado por PayPal',
      datos: { captura }
    });
  } catch (error) {
    next(error);
  }
}

export async function aprobarOrdenPaypalSimulada(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pedidoId = Number(req.body.pedido_id);
    const ordenId = String(req.body.orden_id);
    const usuarioId = req.usuario!.id;
    const resultado = await paypalService.aprobarSimulado(pedidoId, ordenId, usuarioId);

    res.status(200).json({
      exito: true,
      mensaje: 'Orden PayPal simulada aprobada. Ahora puede capturarse',
      datos: { orden: resultado }
    });
  } catch (error) {
    next(error);
  }
}
