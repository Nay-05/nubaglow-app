/**
 * ============================================================================
 * NUBAGLOW APP - CONTROLADOR DE AUTENTICACION Y SESIONES
 * ============================================================================
 * Gestiona el registro, logins diferenciados (cliente vs staff), refresh de token,
 * logout con limpieza de cookies HttpOnly y consulta de perfil.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

const esProduccion = process.env.NODE_ENV === 'production';

function fijarCookiesAutenticacion(res: Response, accessToken: string, refreshToken?: string): void {
  // Cookie de acceso (15 minutos)
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: esProduccion,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000
  });

  // Cookie de actualizacion (7 dias)
  if (refreshToken) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: esProduccion,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }
}

function limpiarCookiesAutenticacion(res: Response): void {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: esProduccion,
    sameSite: 'lax'
  });
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: esProduccion,
    sameSite: 'lax'
  });
}

/**
 * Registro publico de clientes
 */
export async function registro(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await authService.registrarCliente(req.body);
    fijarCookiesAutenticacion(res, resultado.accessToken, resultado.refreshToken);

    res.status(201).json({
      exito: true,
      mensaje: 'Registro completado exitosamente',
      datos: {
        usuario: resultado.usuario,
        accessToken: resultado.accessToken
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login de clientes (tienda publica)
 */
export async function loginCliente(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await authService.autenticar(req.body, false);
    fijarCookiesAutenticacion(res, resultado.accessToken, resultado.refreshToken);

    res.status(200).json({
      exito: true,
      mensaje: 'Inicio de sesion exitoso',
      datos: {
        usuario: resultado.usuario,
        accessToken: resultado.accessToken
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login de personal interno (staff: vendedor, operaciones, admin)
 */
export async function loginStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await authService.autenticar(req.body, true);
    fijarCookiesAutenticacion(res, resultado.accessToken, resultado.refreshToken);

    res.status(200).json({
      exito: true,
      mensaje: 'Acceso concedido al panel de gestion interna',
      datos: {
        usuario: resultado.usuario,
        accessToken: resultado.accessToken
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Renovacion del token de acceso (Refresh)
 */
export async function refrescarSesion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokenRecibido = req.cookies?.refresh_token || req.body?.refreshToken;
    const resultado = await authService.refrescarToken(tokenRecibido);

    fijarCookiesAutenticacion(res, resultado.accessToken);

    res.status(200).json({
      exito: true,
      mensaje: 'Token de acceso renovado exitosamente',
      datos: {
        usuario: resultado.usuario,
        accessToken: resultado.accessToken
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cierre de sesion
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  limpiarCookiesAutenticacion(res);
  res.status(200).json({
    exito: true,
    mensaje: 'Sesion cerrada exitosamente'
  });
}

/**
 * Perfil del usuario autenticado
 */
export async function obtenerPerfil(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.usuario!.id;
    const usuario = await authService.obtenerPerfil(usuarioId);

    res.status(200).json({
      exito: true,
      datos: { usuario }
    });
  } catch (error) {
    next(error);
  }
}
