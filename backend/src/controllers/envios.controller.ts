/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE ENVIOS Y RASTREO
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { enviosService, DatosEntrega } from '../services/envios.service';

export async function rastreoPublico(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { codigo } = req.params;
    const rastreo = await enviosService.rastreoPublico(codigo);
    res.status(200).json({
      exito: true,
      datos: { rastreo }
    });
  } catch (error) {
    next(error);
  }
}

export async function cambiarEstadoEnvio(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const envioId = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const rolUsuario = req.usuario!.rol;
    const { estado, descripcion } = req.body;
    const resultado = await enviosService.cambiarEstado(
      envioId,
      estado,
      descripcion,
      usuarioId,
      rolUsuario
    );

    res.status(200).json({
      exito: true,
      mensaje: `Estado del envio actualizado a '${estado}'`,
      datos: resultado
    });
  } catch (error) {
    next(error);
  }
}

export async function cerrarEntrega(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const envioId = Number(req.params.id);
    const usuarioId = req.usuario!.id;
    const rolUsuario = req.usuario!.rol;
    const resultado = await enviosService.cerrarEntrega(
      envioId,
      req.body as DatosEntrega,
      usuarioId,
      rolUsuario
    );

    res.status(200).json({
      exito: true,
      mensaje: `Entrega del envio ${resultado.codigoRastreo} registrada exitosamente`,
      datos: resultado
    });
  } catch (error) {
    next(error);
  }
}
