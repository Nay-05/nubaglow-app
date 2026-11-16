/**
 * ============================================================================
 * NUBAGLOW APP - ESQUEMAS DE VALIDACION ZOD: CATALOGO Y PRODUCTOS
 * ============================================================================
 */

import { z } from 'zod';

// ----------------------------------------------------------------------------
// 1. CATEGORIAS
// ----------------------------------------------------------------------------
export const crearCategoriaSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre de la categoria es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo puede contener letras minusculas, numeros y guiones')
    .max(120)
    .optional(),
  descripcion: z
    .string()
    .trim()
    .max(500, 'La descripcion no puede exceder 500 caracteres')
    .optional()
});

export const actualizarCategoriaSchema = crearCategoriaSchema.partial();

// ----------------------------------------------------------------------------
// 2. PRODUCTOS
// ----------------------------------------------------------------------------
export const tiposPielValidos = ['Todo tipo', 'Seca', 'Grasa', 'Mixta', 'Sensible'] as const;

export const consultaProductosSchema = z.object({
  categoria: z.string().trim().optional(),
  tipo_piel: z.enum(tiposPielValidos).optional(),
  precio_min: z.coerce.number().min(0, 'El precio minimo no puede ser negativo').optional(),
  precio_max: z.coerce.number().min(0, 'El precio maximo no puede ser negativo').optional(),
  buscar: z.string().trim().optional(),
  orden: z
    .enum(['precio_asc', 'precio_desc', 'nombre_asc', 'nombre_desc', 'recientes'])
    .default('recientes')
    .optional(),
  pagina: z.coerce.number().int().min(1, 'La pagina debe ser mayor o igual a 1').default(1).optional(),
  limite: z.coerce.number().int().min(1).max(50, 'El limite maximo por pagina es 50').default(12).optional()
});

export const crearProductoSchema = z.object({
  categoria_id: z.coerce.number().int().positive('El id de categoria debe ser un entero positivo'),
  nombre: z
    .string({ required_error: 'El nombre del producto es obligatorio' })
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo puede contener minusculas, numeros y guiones')
    .max(220)
    .optional(),
  marca: z.string().trim().max(100).default('Nuba Beauty'),
  tipo_piel: z.enum(tiposPielValidos, {
    errorMap: () => ({ message: 'Tipo de piel invalido. Opciones: Todo tipo, Seca, Grasa, Mixta, Sensible' })
  }),
  descripcion: z
    .string({ required_error: 'La descripcion es obligatoria' })
    .trim()
    .min(5, 'La descripcion debe tener al menos 5 caracteres'),
  ingredientes: z
    .string({ required_error: 'Los ingredientes son obligatorios' })
    .trim()
    .min(3, 'Los ingredientes deben tener al menos 3 caracteres'),
  modo_uso: z
    .string({ required_error: 'El modo de uso es obligatorio' })
    .trim()
    .min(3, 'El modo de uso debe tener al menos 3 caracteres'),
  activo: z.boolean().default(true).optional(),
  imagenes: z.array(z.string().trim()).optional()
});

export const actualizarProductoSchema = crearProductoSchema.partial();

// ----------------------------------------------------------------------------
// 3. VARIANTES
// ----------------------------------------------------------------------------
export const crearVarianteSchema = z.object({
  sku: z
    .string({ required_error: 'El SKU es obligatorio' })
    .trim()
    .toUpperCase()
    .min(3, 'El SKU debe tener al menos 3 caracteres')
    .max(60, 'El SKU no puede exceder 60 caracteres')
    .regex(/^[A-Z0-9\-_]+$/, 'El SKU solo puede contener letras mayusculas, numeros, guiones y guiones bajos'),
  nombre: z
    .string({ required_error: 'El nombre de la variante (tono o presentacion) es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(120, 'El nombre no puede exceder 120 caracteres'),
  precio: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  stock: z.coerce.number().int().min(0, 'El stock no puede ser negativo').default(0),
  punto_reorden: z.coerce.number().int().min(0, 'El punto de reorden no puede ser negativo').default(5),
  activo: z.boolean().default(true).optional()
});

export const actualizarVarianteSchema = crearVarianteSchema.partial();

export type ConsultaProductosInput = z.infer<typeof consultaProductosSchema>;
export type CrearProductoInput = z.infer<typeof crearProductoSchema>;
export type ActualizarProductoInput = z.infer<typeof actualizarProductoSchema>;
export type CrearVarianteInput = z.infer<typeof crearVarianteSchema>;
export type ActualizarVarianteInput = z.infer<typeof actualizarVarianteSchema>;
