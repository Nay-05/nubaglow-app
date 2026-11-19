/**
 * ============================================================================
 * NUBAGLOW APP - ESQUEMAS DE VALIDACION ZOD: COMPRA, PEDIDOS, ENVIOS Y RESENAS
 * ============================================================================
 */

import { z } from 'zod';

// ----------------------------------------------------------------------------
// 1. CARRITO
// ----------------------------------------------------------------------------
export const agregarCarritoItemSchema = z.object({
  variante_id: z.coerce.number().int().positive('El id de la variante debe ser un entero positivo'),
  cantidad: z.coerce.number().int().min(1, 'La cantidad minima a agregar es 1').default(1)
});

export const actualizarCarritoItemSchema = z.object({
  cantidad: z.coerce.number().int().min(1, 'La cantidad minima es 1')
});

// ----------------------------------------------------------------------------
// 2. PEDIDOS Y CHECKOUT
// ----------------------------------------------------------------------------
export const crearPedidoItemSchema = z.object({
  variante_id: z.coerce.number().int().positive('El id de la variante debe ser valido'),
  cantidad: z.coerce.number().int().min(1, 'La cantidad minima es 1')
});

export const cotizarPedidoSchema = z.object({
  ciudad: z
    .string({ required_error: 'La ciudad de entrega es obligatoria' })
    .trim()
    .min(2, 'La ciudad debe tener al menos 2 caracteres')
    .max(100),
  items: z
    .array(crearPedidoItemSchema)
    .min(1, 'Debe incluir al menos un item para cotizar')
});

export const crearPedidoSchema = z.object({
  nombre_cliente: z
    .string({ required_error: 'El nombre completo del cliente es obligatorio' })
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  celular_cliente: z
    .string({ required_error: 'El numero de celular es obligatorio' })
    .trim()
    .regex(
      /^(?:(?:\+?591)?\s*)?[67]\d{7}$/,
      'El numero de celular debe ser un numero valido de Bolivia (8 digitos iniciando con 6 o 7)'
    ),
  correo_cliente: z
    .string({ required_error: 'El correo electronico es obligatorio' })
    .trim()
    .toLowerCase()
    .email('El correo electronico no tiene un formato valido'),
  ciudad: z
    .string({ required_error: 'La ciudad de entrega es obligatoria' })
    .trim()
    .min(2, 'La ciudad debe tener al menos 2 caracteres')
    .max(100),
  direccion: z
    .string({ required_error: 'La direccion exacta de entrega es obligatoria' })
    .trim()
    .min(5, 'La direccion debe incluir calle, numero o detalles claros (minimo 5 caracteres)'),
  notas: z.string().trim().max(500, 'Las notas no pueden superar 500 caracteres').optional(),
  metodo_pago: z.enum(['qr_simple', 'qr', 'deposito_bancario', 'contra_entrega'], {
    errorMap: () => ({
      message:
        'Metodo de pago no valido. Opciones permitidas: qr_simple, deposito_bancario, contra_entrega'
    })
  }),
  // Opcional: si se envia items se compran esos; si no se envia se procesa el carrito persistente
  items: z.array(crearPedidoItemSchema).min(1, 'Debe incluir al menos un item para comprar').optional()
});

// ----------------------------------------------------------------------------
// 3. ENVIOS Y EVENTOS
// ----------------------------------------------------------------------------
export const estadosEnvioValidos = [
  'Pendiente',
  'En preparación',
  'Empacado',
  'En tránsito',
  'Entregado'
] as const;

export const cambiarEstadoEnvioSchema = z.object({
  estado: z.enum(estadosEnvioValidos, {
    errorMap: () => ({
      message:
        'Estado de envio invalido. Opciones: Pendiente, En preparación, Empacado, En tránsito, Entregado'
    })
  }),
  descripcion: z.string().trim().max(500).optional()
});

export const cerrarEntregaSchema = z.object({
  receptor: z
    .string({ required_error: 'El nombre del receptor es obligatorio' })
    .trim()
    .min(3, 'El receptor debe tener al menos 3 caracteres')
    .max(150),
  documento: z.string().trim().max(50).optional(),
  fecha_entrega: z
    .string({ required_error: 'La fecha de entrega es obligatoria' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de entrega debe tener formato YYYY-MM-DD'),
  hora_entrega: z
    .string({ required_error: 'La hora de entrega es obligatoria' })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora de entrega debe tener formato HH:MM'),
  nota: z
    .string({ required_error: 'La nota de entrega es obligatoria' })
    .trim()
    .min(3, 'La nota debe tener al menos 3 caracteres')
    .max(500),
  comprobante_url: z.string().trim().url('El comprobante debe ser una URL valida').max(500).optional()
});

// ----------------------------------------------------------------------------
// 4. RESENAS
// ----------------------------------------------------------------------------
export const crearResenaSchema = z.object({
  producto_id: z.coerce.number().int().positive('El id de producto es obligatorio'),
  calificacion: z.coerce
    .number()
    .int()
    .min(1, 'La calificacion minima es 1 estrella')
    .max(5, 'La calificacion maxima es 5 estrellas'),
  comentario: z
    .string({ required_error: 'El comentario de la resena es obligatorio' })
    .trim()
    .min(5, 'El comentario debe tener al menos 5 caracteres')
    .max(1000, 'El comentario no puede exceder 1000 caracteres')
});

export type AgregarCarritoItemInput = z.infer<typeof agregarCarritoItemSchema>;
export type ActualizarCarritoItemInput = z.infer<typeof actualizarCarritoItemSchema>;
export type CotizarPedidoInput = z.infer<typeof cotizarPedidoSchema>;
export type CrearPedidoInput = z.infer<typeof crearPedidoSchema>;
export type CambiarEstadoEnvioInput = z.infer<typeof cambiarEstadoEnvioSchema>;
export type CrearResenaInput = z.infer<typeof crearResenaSchema>;
