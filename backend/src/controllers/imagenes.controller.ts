/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE IMAGENES DE PRODUCTO
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { imagenesService } from '../services/imagenes.service';

export async function listarImagenesProducto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productoId = Number(req.params.productoId);
    const imagenes = await imagenesService.listarPorProducto(productoId);
    res.status(200).json({ exito: true, datos: { imagenes } });
  } catch (error) {
    next(error);
  }
}

export async function crearImagenProducto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productoId = Number(req.params.productoId);
    const usuarioId = req.usuario!.id;
    const imagen = await imagenesService.crear(
      productoId,
      req.body,
      usuarioId
    );
    res.status(201).json({
      exito: true,
      mensaje: 'Imagen agregada exitosamente',
      datos: { imagen }
    });
  } catch (error) {
    next(error);
  }
}

export async function actualizarImagenProducto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productoId = Number(req.params.productoId);
    const imagenId = Number(req.params.imagenId);
    const usuarioId = req.usuario!.id;
    const imagen = await imagenesService.actualizar(
      productoId,
      imagenId,
      req.body,
      usuarioId
    );
    res.status(200).json({
      exito: true,
      mensaje: 'Imagen actualizada exitosamente',
      datos: { imagen }
    });
  } catch (error) {
    next(error);
  }
}

export async function eliminarImagenProducto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productoId = Number(req.params.productoId);
    const imagenId = Number(req.params.imagenId);
    const usuarioId = req.usuario!.id;
    await imagenesService.eliminar(productoId, imagenId, usuarioId);
    res.status(200).json({
      exito: true,
      mensaje: 'Imagen eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
}
