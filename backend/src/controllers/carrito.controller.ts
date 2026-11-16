/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE CARRITO PERSISTENTE
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { carritoService } from '../services/carrito.service';

export async function obtenerCarrito(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const carrito = await carritoService.obtenerCarrito(usuarioId);
    res.status(200).json({
      exito: true,
      datos: { carrito }
    });
  } catch (error) {
    next(error);
  }
}

export async function agregarItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const { variante_id, cantidad } = req.body;
    const carrito = await carritoService.agregarItem(usuarioId, Number(variante_id), Number(cantidad));
    res.status(200).json({
      exito: true,
      mensaje: 'Articulo agregado al carrito exitosamente',
      datos: { carrito }
    });
  } catch (error) {
    next(error);
  }
}

export async function actualizarCantidad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const itemId = Number(req.params.itemId);
    const { cantidad } = req.body;
    const carrito = await carritoService.actualizarCantidad(usuarioId, itemId, Number(cantidad));
    res.status(200).json({
      exito: true,
      mensaje: 'Cantidad actualizada exitosamente',
      datos: { carrito }
    });
  } catch (error) {
    next(error);
  }
}

export async function eliminarItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const itemId = Number(req.params.itemId);
    const carrito = await carritoService.eliminarItem(usuarioId, itemId);
    res.status(200).json({
      exito: true,
      mensaje: 'Articulo removido del carrito',
      datos: { carrito }
    });
  } catch (error) {
    next(error);
  }
}

export async function vaciarCarrito(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    await carritoService.vaciarCarrito(usuarioId);
    res.status(200).json({
      exito: true,
      mensaje: 'Carrito vaciado exitosamente'
    });
  } catch (error) {
    next(error);
  }
}
