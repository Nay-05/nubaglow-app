/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE INVENTARIO Y DESPACHOS
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { inventarioService } from '../services/inventario.service';

export async function listarInventario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const soloStockBajo = req.query.bajo === 'true';
    const inventario = await inventarioService.listarInventario(soloStockBajo);
    res.status(200).json({
      exito: true,
      datos: { inventario }
    });
  } catch (error) {
    next(error);
  }
}

export async function ajustarStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const varianteId = Number(req.params.varianteId);
    const usuarioId = req.usuario!.id;
    const resultado = await inventarioService.ajustarStock(varianteId, req.body, usuarioId);

    res.status(200).json({
      exito: true,
      mensaje: 'Movimiento de inventario registrado exitosamente en el Kardex',
      datos: resultado
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerKardex(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const varianteId = Number(req.params.varianteId);
    const kardex = await inventarioService.obtenerKardex(varianteId);
    res.status(200).json({
      exito: true,
      datos: kardex
    });
  } catch (error) {
    next(error);
  }
}

export async function colaDespachos(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pedidos = await inventarioService.colaDespachos();
    res.status(200).json({
      exito: true,
      datos: { pedidos }
    });
  } catch (error) {
    next(error);
  }
}

export async function colaDespachosPreparacion(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pedidos = await inventarioService.colaDespachos(['Pendiente', 'En preparación']);
    res.status(200).json({
      exito: true,
      datos: { pedidos }
    });
  } catch (error) {
    next(error);
  }
}

export async function colaDespachosLogistica(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pedidos = await inventarioService.colaDespachos([
      'Empacado',
      'En tránsito'
    ]);
    res.status(200).json({
      exito: true,
      datos: { pedidos }
    });
  } catch (error) {
    next(error);
  }
}
