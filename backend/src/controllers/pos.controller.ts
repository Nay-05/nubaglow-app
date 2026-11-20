/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE VENTAS POS (MOSTRADOR)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { posService } from '../services/pos.service';
import { posPdfService } from '../services/posPdf.service';

export async function registrarVentaPos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vendedorId = req.usuario!.id;
    const venta = await posService.registrarVentaPos(vendedorId, req.body);
    res.status(201).json({
      exito: true,
      mensaje: 'Venta de mostrador registrada exitosamente',
      datos: { venta }
    });
  } catch (error) {
    next(error);
  }
}

export async function historialVentas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const rolUsuario = req.usuario!.rol;
    const fecha = req.query.fecha as string | undefined;
    const ventas = await posService.historialVentas(
      usuarioId,
      rolUsuario,
      fecha
    );
    res.status(200).json({
      exito: true,
      datos: { ventas }
    });
  } catch (error) {
    next(error);
  }
}

export async function descargarComprobantePosPdf(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ventaId = Number(req.params.id);
    const usuario = req.usuario!;
    const venta = await posService.obtenerVentaDetalle(
      ventaId,
      usuario.id,
      usuario.rol
    );
    const comprobante = await posPdfService.generar(venta);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${comprobante.nombreArchivo}"`
    );
    res.setHeader('Content-Length', String(comprobante.buffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(comprobante.buffer);
  } catch (error) {
    next(error);
  }
}

export async function cierreCaja(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const rolUsuario = req.usuario!.rol;
    const fecha = req.query.fecha as string | undefined;
    const resumen = await posService.cierreCaja(usuarioId, rolUsuario, fecha);
    res.status(200).json({
      exito: true,
      datos: { cierre: resumen }
    });
  } catch (error) {
    next(error);
  }
}
