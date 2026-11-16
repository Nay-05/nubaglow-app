/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE CATEGORIAS
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { categoriasService } from '../services/categorias.service';

export async function listarCategorias(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categorias = await categoriasService.listar();
    res.status(200).json({
      exito: true,
      datos: { categorias }
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerCategoriaPorSlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params;
    const categoria = await categoriasService.obtenerPorSlug(slug);
    res.status(200).json({
      exito: true,
      datos: { categoria }
    });
  } catch (error) {
    next(error);
  }
}

export async function crearCategoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const categoria = await categoriasService.crear(req.body, usuarioId);
    res.status(201).json({
      exito: true,
      mensaje: 'Categoria creada exitosamente',
      datos: { categoria }
    });
  } catch (error) {
    next(error);
  }
}

export async function actualizarCategoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const categoria = await categoriasService.actualizar(id, req.body, usuarioId);
    res.status(200).json({
      exito: true,
      mensaje: 'Categoria actualizada exitosamente',
      datos: { categoria }
    });
  } catch (error) {
    next(error);
  }
}

export async function eliminarCategoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    await categoriasService.eliminar(id, usuarioId);
    res.status(200).json({
      exito: true,
      mensaje: 'Categoria eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
}
