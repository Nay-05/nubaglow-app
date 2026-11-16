/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE PRODUCTOS
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { productosService } from '../services/productos.service';

export async function listarProductos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Si la peticion proviene de un admin en portal interno, podria ver inactivos si lo requiere
    const esAdmin = req.usuario?.rol === 'admin';
    const soloActivos = !esAdmin || req.query.todos !== 'true';

    const resultado = await productosService.listar(req.query as any, soloActivos);
    res.status(200).json({
      exito: true,
      datos: resultado
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerProductoPorSlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params;
    const esAdmin = req.usuario?.rol === 'admin';
    const producto = await productosService.obtenerPorSlug(slug, !esAdmin);

    res.status(200).json({
      exito: true,
      datos: { producto }
    });
  } catch (error) {
    next(error);
  }
}

export async function crearProducto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const producto = await productosService.crear(req.body, usuarioId);

    res.status(201).json({
      exito: true,
      mensaje: 'Producto registrado exitosamente en el catalogo',
      datos: { producto }
    });
  } catch (error) {
    next(error);
  }
}

export async function actualizarProducto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const producto = await productosService.actualizar(id, req.body, usuarioId);

    res.status(200).json({
      exito: true,
      mensaje: 'Producto actualizado exitosamente',
      datos: { producto }
    });
  } catch (error) {
    next(error);
  }
}

export async function eliminarProducto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const resultado = await productosService.eliminar(id, usuarioId);

    res.status(200).json({
      exito: true,
      mensaje: resultado.mensaje,
      datos: { tipo: resultado.tipo }
    });
  } catch (error) {
    next(error);
  }
}
