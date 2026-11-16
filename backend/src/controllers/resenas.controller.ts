/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE RESENAS
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { resenasService } from '../services/resenas.service';

export async function crearResena(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const resena = await resenasService.crearResena(usuarioId, req.body);
    res.status(201).json({
      exito: true,
      mensaje: 'Resena publicada exitosamente',
      datos: { resena }
    });
  } catch (error) {
    next(error);
  }
}

export async function listarResenasPorProducto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productoId = Number(req.params.productoId);
    const resumen = await resenasService.listarPorProducto(productoId);
    res.status(200).json({
      exito: true,
      datos: resumen
    });
  } catch (error) {
    next(error);
  }
}
