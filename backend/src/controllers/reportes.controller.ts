/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE REPORTES Y METRICAS (ADMIN)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { reportesService } from '../services/reportes.service';

export async function resumenWebVsPos(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resumen = await reportesService.resumenWebVsPos();
    res.status(200).json({
      exito: true,
      datos: resumen
    });
  } catch (error) {
    next(error);
  }
}

export async function ingresosPorDia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reporte = await reportesService.ingresosPorDia(req.query as any);
    res.status(200).json({
      exito: true,
      datos: reporte
    });
  } catch (error) {
    next(error);
  }
}

export async function rankingProductos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limite = req.query.limite ? Number(req.query.limite) : 10;
    const ranking = await reportesService.rankingProductos(limite);
    res.status(200).json({
      exito: true,
      datos: { ranking }
    });
  } catch (error) {
    next(error);
  }
}
