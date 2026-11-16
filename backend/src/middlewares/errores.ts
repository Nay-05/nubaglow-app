/**
 * ============================================================================
 * NUBAGLOW APP - MANEJO CENTRALIZADO DE ERRORES Y EXCEPCIONES
 * ============================================================================
 * Cumple con CLAUDE.md Seccion 9:
 * "Manejo de errores: Devolver mensajes claros y seguros al cliente sin exponer
 *  trazas internas de SQL o stack traces."
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public statusCode: number;
  public esOperacional: boolean;
  public detalles?: any;

  constructor(mensaje: string, statusCode: number = 400, detalles?: any) {
    super(mensaje);
    this.statusCode = statusCode;
    this.esOperacional = true;
    this.detalles = detalles;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware central de captura de errores para Express.
 * Transforma cualquier error en una respuesta JSON estructurada y segura.
 */
export function manejadorErrores(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const timestamp = new Date().toISOString();

  // 1. Error de validacion de esquema Zod
  if (err instanceof ZodError) {
    const detalles = err.errors.map((e) => ({
      campo: e.path.join('.'),
      mensaje: e.message
    }));
    res.status(400).json({
      exito: false,
      error: 'Error de validacion en los datos de la solicitud',
      detalles
    });
    return;
  }

  // 2. Error operacional controlado con AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      exito: false,
      error: err.message,
      ...(err.detalles ? { detalles: err.detalles } : {})
    });
    return;
  }

  // 3. Error de JsonWebToken
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      exito: false,
      error: 'Token de sesion invalido o alterado'
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      exito: false,
      error: 'La sesion ha expirado. Por favor inicie sesion nuevamente'
    });
    return;
  }

  // 4. Error de base de datos PostgreSQL (pg)
  // Seguridad: NUNCA enviar detalles tecnicos de SQL, tablas o restricciones al cliente
  if (err.code && typeof err.code === 'string' && err.code.length === 5) {
    console.error(`[${timestamp}] [ERROR DB ${err.code}]`, {
      mensaje: err.message,
      detail: err.detail,
      ruta: `${req.method} ${req.originalUrl}`
    });

    if (err.code === '23505') {
      // Violacion de unicidad (ej. email ya registrado, slug duplicado)
      res.status(409).json({
        exito: false,
        error: 'El recurso o registro ya existe con los mismos datos unicos'
      });
      return;
    }

    if (err.code === '23503') {
      // Violacion de llave foranea
      res.status(409).json({
        exito: false,
        error: 'No se puede completar la operacion debido a restricciones de integridad referencial'
      });
      return;
    }

    res.status(500).json({
      exito: false,
      error: 'Error al procesar la operacion en la base de datos'
    });
    return;
  }

  // 5. Error inesperado de servidor (500)
  // Registrar internamente en la consola del servidor para depuracion
  console.error(`[${timestamp}] [ERROR NO CONTROLADO 500]`, {
    mensaje: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    ruta: `${req.method} ${req.originalUrl}`
  });

  res.status(500).json({
    exito: false,
    error: 'Ha ocurrido un error interno en el servidor. Por favor intente mas tarde'
  });
}

/**
 * Middleware para rutas no encontradas (404)
 */
export function rutaNoEncontrada(req: Request, res: Response): void {
  res.status(404).json({
    exito: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
}
