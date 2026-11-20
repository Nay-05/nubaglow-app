/**
 * ============================================================================
 * NUBAGLOW APP - ESQUEMAS DE VALIDACION ZOD: ASISTENTE IA
 * ============================================================================
 */

import { z } from 'zod';

export const historialAsistenteSchema = z.object({
  rol: z.enum(['usuario', 'asistente']),
  contenido: z
    .string()
    .trim()
    .min(1, 'El contenido del historial no puede estar vacio')
    .max(1200, 'Cada mensaje del historial es demasiado largo')
});

export const consultaAsistenteSchema = z.object({
  mensaje: z
    .string({ required_error: 'El mensaje es obligatorio' })
    .trim()
    .min(2, 'El mensaje debe tener al menos 2 caracteres')
    .max(600, 'El mensaje no puede exceder 600 caracteres'),
  historial: z.array(historialAsistenteSchema).max(8).optional()
});

export type ConsultaAsistenteInput = z.infer<typeof consultaAsistenteSchema>;
export type HistorialAsistenteItem = z.infer<typeof historialAsistenteSchema>;
