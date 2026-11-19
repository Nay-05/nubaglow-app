/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE COMPROBANTES DE PAGO
 * ============================================================================
 * Entrega el archivo almacenado con cabeceras seguras para visualizacion inline.
 */

import { Request, Response, NextFunction } from 'express';
import { comprobantesService } from '../services/comprobantes.service';

export async function descargarComprobante(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const comprobanteId = Number(req.params.id);
    const usuario = req.usuario!;
    const archivo = await comprobantesService.obtenerParaDescarga(
      comprobanteId,
      usuario.id,
      usuario.rol
    );

    const nombreSeguro = archivo.nombreArchivo.replace(/["\r\n]/g, '_');

    res.setHeader('Content-Type', archivo.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${nombreSeguro}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(archivo.buffer);
  } catch (error) {
    next(error);
  }
}
