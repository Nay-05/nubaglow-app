/**
 * ============================================================================
 * NUBAGLOW APP - ESQUEMAS DE PRUEBA DE NOTIFICACIONES
 * ============================================================================
 * Valida el cuerpo del endpoint de diagnostico real de correo y Telegram.
 */

import { z } from 'zod';

export const pruebaNotificacionesSchema = z.object({
  correo: z
    .string()
    .trim()
    .email('El correo de prueba debe tener un formato valido')
    .max(255, 'El correo no puede exceder 255 caracteres')
    .optional(),
  chatId: z
    .string()
    .trim()
    .min(1, 'El chatId no puede estar vacio')
    .max(64, 'El chatId no puede exceder 64 caracteres')
    .optional(),
  clave: z
    .string()
    .trim()
    .max(200, 'La clave no puede exceder 200 caracteres')
    .optional()
});
