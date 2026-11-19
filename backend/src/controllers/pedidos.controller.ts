/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE PEDIDOS Y CHECKOUT
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { pedidosService } from '../services/pedidos.service';
import { cotizacionesService } from '../services/cotizaciones.service';
import { cancelarPedido } from '../services/cancelaciones.service';
import { comprobantesService } from '../services/comprobantes.service';
import { obtenerDatosCobro } from '../config/cobro';

export async function cotizarPedido(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cotizacion = await cotizacionesService.cotizar(req.body);
    res.status(200).json({
      exito: true,
      datos: { cotizacion }
    });
  } catch (error) {
    next(error);
  }
}

export async function crearPedido(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const pedido = await pedidosService.crearPedido(usuarioId, req.body);
    res.status(201).json({
      exito: true,
      mensaje: 'Pedido confirmado exitosamente',
      datos: {
        pedido,
        cobro: obtenerDatosCobro(),
        simulacion: true
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function registrarComprobantePago(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pedidoId = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const comprobante = await comprobantesService.registrar(pedidoId, usuarioId, req.body);

    res.status(201).json({
      exito: true,
      mensaje:
        'Comprobante de pago recibido. El pago quedo En verificación para revision manual',
      datos: { comprobante, simulacion: true }
    });
  } catch (error) {
    next(error);
  }
}

export async function listarMisPedidos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const pedidos = await pedidosService.listarMisPedidos(usuarioId);
    res.status(200).json({
      exito: true,
      datos: { pedidos }
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerDetallePedido(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pedidoId = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const rolUsuario = req.usuario!.rol;
    const pedido = await pedidosService.obtenerDetalle(pedidoId, usuarioId, rolUsuario);
    res.status(200).json({
      exito: true,
      datos: { pedido }
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelarPedidoAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pedidoId = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const motivo = req.body.motivo || 'Cancelacion administrativa del pedido';
    const resultado = await cancelarPedido(pedidoId, usuarioId, motivo);

    res.status(200).json({
      exito: true,
      mensaje: resultado.yaCancelado
        ? 'El pedido ya estaba cancelado; no se repuso stock nuevamente'
        : 'Pedido cancelado y stock repuesto exitosamente',
      datos: { cancelacion: resultado }
    });
  } catch (error) {
    next(error);
  }
}
