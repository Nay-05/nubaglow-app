/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE GESTION DE USUARIOS STAFF (ADMIN)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { usuariosService } from '../services/usuarios.service';

export async function listarStaff(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarios = await usuariosService.listarStaff();
    res.status(200).json({
      exito: true,
      datos: { usuarios }
    });
  } catch (error) {
    next(error);
  }
}

export async function crearStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.usuario!.id;
    const usuario = await usuariosService.crearStaff(req.body, adminId);
    res.status(201).json({
      exito: true,
      mensaje: `Cuenta de staff creada exitosamente con rol '${usuario.rol}'`,
      datos: { usuario }
    });
  } catch (error) {
    next(error);
  }
}

export async function actualizarStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const adminId = req.usuario!.id;
    const usuario = await usuariosService.actualizarStaff(id, req.body, adminId);
    res.status(200).json({
      exito: true,
      mensaje: 'Usuario actualizado exitosamente',
      datos: { usuario }
    });
  } catch (error) {
    next(error);
  }
}

export async function restablecerPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const adminId = req.usuario!.id;
    await usuariosService.restablecerPassword(id, req.body, adminId);
    res.status(200).json({
      exito: true,
      mensaje: 'Contrasena restablecida exitosamente'
    });
  } catch (error) {
    next(error);
  }
}
