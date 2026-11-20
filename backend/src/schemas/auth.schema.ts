/**
 * ============================================================================
 * NUBAGLOW APP - ESQUEMAS DE VALIDACION ZOD: AUTENTICACION
 * ============================================================================
 * Cumple con CLAUDE.md Seccion 9:
 * - Password con min 8 caracteres, 1 mayuscula y 1 numero.
 * - Registro publico SIEMPRE fuerza rol = 'cliente'.
 */

import { z } from 'zod';

function normalizarCelularBoliviano(valor: unknown): string {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (digitos.startsWith('591') && digitos.length === 11) {
    return digitos.slice(3);
  }
  return digitos;
}

const celularOpcionalSchema = z.preprocess(
  (valor) => {
    const normalizado = normalizarCelularBoliviano(valor);
    return normalizado === '' ? undefined : normalizado;
  },
  z
    .string()
    .regex(
      /^[67]\d{7}$/,
      'Ingresa un celular boliviano válido, por ejemplo 72860307'
    )
    .optional()
);

export const registroSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre completo es obligatorio' })
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  email: z
    .string({ required_error: 'El correo electronico es obligatorio' })
    .trim()
    .toLowerCase()
    .email('El formato del correo electronico no es valido')
    .max(255, 'El correo no puede exceder 255 caracteres'),
  celular: celularOpcionalSchema,
  password: z
    .string({ required_error: 'La contrasena es obligatoria' })
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contrasena debe contener al menos una letra mayuscula')
    .regex(/[0-9]/, 'La contrasena debe contener al menos un numero')
    .max(100, 'La contrasena no puede exceder 100 caracteres')
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'El correo electronico es obligatorio' })
    .trim()
    .toLowerCase()
    .email('El formato del correo electronico no es valido'),
  password: z
    .string({ required_error: 'La contrasena es obligatoria' })
    .min(1, 'La contrasena no puede estar vacia')
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional()
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
