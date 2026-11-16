/**
 * ============================================================================
 * NUBAGLOW APP - DEFINICIONES GLOBALES DE TIPOS Y MODELOS
 * ============================================================================
 */

import { Request } from 'express';

export type RolUsuario = 'cliente' | 'vendedor' | 'operaciones' | 'admin';

export interface UsuarioAutenticado {
  id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

// Extender la interfaz Request de Express para incluir al usuario autenticado
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

export interface RespuestaExito<T = any> {
  exito: true;
  datos: T;
  mensaje?: string;
}

export interface RespuestaError {
  exito: false;
  error: string;
  codigo?: string;
  detalles?: any;
}
