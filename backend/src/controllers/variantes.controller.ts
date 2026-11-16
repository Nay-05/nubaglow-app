/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE VARIANTES DE PRODUCTO
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { variantesService } from '../services/variantes.service';

export async function listarVariantesPorProducto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productoId = Number(req.params.productoId);
    const esAdmin = req.usuario?.rol === 'admin';
    const variantes = await variantesService.listarPorProducto(productoId, !esAdmin);

    res.status(200).json({
      exito: true,
      datos: { variantes }
    });
  } catch (error) {
    next(error);
  }
}

export async function crearVariante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productoId = Number(req.params.productoId);
    const usuarioId = req.usuario!.id;
    const variante = await variantesService.crear(productoId, req.body, usuarioId);

    res.status(201).json({
      exito: true,
      mensaje: 'Variante creada exitosamente',
      datos: { variante }
    });
  } catch (error) {
    next(error);
  }
}

export async function actualizarVariante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const variante = await variantesService.actualizar(id, req.body, usuarioId);

    res.status(200).json({
      exito: true,
      mensaje: 'Variante actualizada exitosamente',
      datos: { variante }
    });
  } catch (error) {
    next(error);
  }
}

export async function eliminarVariante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const resultado = await variantesService.eliminar(id, usuarioId);

    res.status(200).json({
      exito: true,
      mensaje: resultado.mensaje
    });
  } catch (error) {
    next(error);
  }
}
