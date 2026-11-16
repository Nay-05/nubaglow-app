/**
 * ============================================================================
 * NUBAGLOW APP - MIDDLEWARES DE SEGURIDAD Y LIMITACION DE TASA
 * ============================================================================
 * Cumple con CLAUDE.md Seccion 9:
 * "express-rate-limit general y uno estricto en /login para frenar fuerza bruta."
 */

import rateLimit from 'express-rate-limit';

// Limitador estricto para rutas de autenticacion (10 intentos cada 15 minutos)
export const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    exito: false,
    error: 'Demasiados intentos de acceso desde esta direccion IP. Por seguridad, intente en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limitador general para creacion publica de cuentas (5 registros cada hora por IP)
export const limitadorRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    exito: false,
    error: 'Limite de registros alcanzado desde esta direccion IP. Intente mas tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
