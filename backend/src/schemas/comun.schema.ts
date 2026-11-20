/**
 * ============================================================================
 * NUBAGLOW APP - ESQUEMAS ZOD COMUNES (PARAMS Y QUERY)
 * ============================================================================
 * Garantiza que el 100% de los endpoints validen req.params y req.query con Zod.
 */

import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El parametro id debe ser un numero entero valido').transform(Number)
});

export const slugParamSchema = z.object({
  slug: z
    .string()
    .min(1, 'El slug no puede estar vacio')
    .max(250, 'El slug no puede exceder 250 caracteres')
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minusculas, numeros y guiones')
});

export const productoIdParamSchema = z.object({
  productoId: z
    .string()
    .regex(/^\d+$/, 'El parametro productoId debe ser un numero entero valido')
    .transform(Number)
});

export const varianteIdParamSchema = z.object({
  varianteId: z
    .string()
    .regex(/^\d+$/, 'El parametro varianteId debe ser un numero entero valido')
    .transform(Number)
});

export const imagenProductoParamSchema = z.object({
  productoId: z
    .string()
    .regex(/^\d+$/, 'El parametro productoId debe ser un numero entero valido')
    .transform(Number),
  imagenId: z
    .string()
    .regex(/^\d+$/, 'El parametro imagenId debe ser un numero entero valido')
    .transform(Number)
});

export const itemIdParamSchema = z.object({
  itemId: z
    .string()
    .regex(/^\d+$/, 'El parametro itemId debe ser un numero entero valido')
    .transform(Number)
});

export const codigoRastreoParamSchema = z.object({
  codigo: z
    .string()
    .regex(/^NB-2026-\d{4}$/, 'El codigo de rastreo debe tener el formato estricto NB-2026-XXXX')
});
