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
    .array(crearPedidoItemSchema, {
      required_error: 'El carrito está vacío. Agrega al menos un artículo antes de cotizar.'
    })
    .min(1, 'El carrito está vacío. Agrega al menos un artículo antes de cotizar.')
});

function normalizarCelularBoliviano(valor: unknown): string {
  const digitos = String(valor ?? '').replace(/\D/g, '');

  if (digitos.startsWith('591') && digitos.length === 11) {
    return digitos.slice(3);
  }

  return digitos;
}

const celularBolivianoSchema = z.preprocess(
  (valor) => normalizarCelularBoliviano(valor),
  z
    .string()
    .regex(
      /^[67]\d{7}$/,
      'Ingresa un celular boliviano válido, por ejemplo 72860307'
    )
);

export const crearPedidoSchema = z.object({
  nombre_cliente: z
    .string({ required_error: 'El nombre completo del cliente es obligatorio' })
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  celular_cliente: celularBolivianoSchema,
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
  metodo_pago: z.enum(['qr_simple', 'qr', 'deposito_bancario', 'paypal', 'contra_entrega'], {
    errorMap: () => ({
      message:
        'Metodo de pago no valido. Opciones permitidas: ' +
        'qr_simple, deposito_bancario, paypal, contra_entrega'
    })
  }),
  // Opcional: si se envia items se compran esos; si no se envia se procesa el carrito persistente
  items: z
    .array(crearPedidoItemSchema)
    .min(1, 'Debe incluir al menos un item para comprar')
    .optional()
});

// ----------------------------------------------------------------------------
// 2.1 COMPROBANTE DE PAGO (QR SIMPLE / DEPOSITO BANCARIO)
// ----------------------------------------------------------------------------
export const mimeTiposComprobante = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
] as const;

function esFechaNoFutura(valor: string): boolean {
  const partes = valor.split('-').map(Number);
  if (partes.length !== 3 || partes.some((p) => !Number.isInteger(p))) return false;

  const [anio, mes, dia] = partes;
  const fecha = new Date(anio, mes - 1, dia);
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return false;
  }

  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return fecha.getTime() <= inicioHoy.getTime();
}

export const subirComprobantePagoSchema = z.object({
  nombre_archivo: z
    .string({ required_error: 'El nombre del archivo es obligatorio' })
    .trim()
    .min(1, 'El nombre del archivo no puede estar vacio')
    .max(255, 'El nombre del archivo no puede exceder 255 caracteres'),
  mime_type: z.enum(mimeTiposComprobante, {
    errorMap: () => ({
      message:
        'Tipo de archivo no permitido. Formatos aceptados: ' +
        'image/jpeg, image/png, image/webp, application/pdf'
    })
  }),
  referencia: z
    .string({ required_error: 'La referencia u operacion del pago es obligatoria' })
    .trim()
    .min(3, 'La referencia debe tener al menos 3 caracteres')
    .max(150, 'La referencia no puede exceder 150 caracteres'),
  fecha_deposito: z
    .string({ required_error: 'La fecha del deposito es obligatoria' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha del deposito debe tener formato YYYY-MM-DD')
    .refine(esFechaNoFutura, 'La fecha del deposito no puede ser futura ni una fecha invalida'),
  monto_pagado: z.coerce
    .number({ invalid_type_error: 'El monto pagado debe ser un numero' })
    .positive('El monto pagado debe ser mayor a cero')
    .max(1_000_000, 'El monto pagado excede el maximo permitido'),
  // Acepta base64 puro o un data URL (data:image/png;base64,...). El limite real
  // lo aplica el servicio segun COMPROBANTE_MAX_MB.
  contenido_base64: z
    .string({ required_error: 'El contenido del comprobante es obligatorio' })
    .trim()
    .min(1, 'El contenido del comprobante no puede estar vacio')
    .max(30_000_000, 'El comprobante excede el tamano maximo permitido')
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
        'Estado de envio invalido. Opciones: Pendiente, ' +
        'En preparación, Empacado, En tránsito, Entregado'
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
  comprobante_url: z
    .string()
    .trim()
    .url('El comprobante debe ser una URL valida')
    .max(500)
    .optional()
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

// ----------------------------------------------------------------------------
// 2.2 ORDENES PAYPAL
// ----------------------------------------------------------------------------
const pedidoIdPaypalSchema = z.coerce
  .number({ invalid_type_error: 'El pedido es obligatorio' })
  .int('El pedido debe ser un entero')
  .positive('El pedido debe ser valido');

const ordenIdPaypalSchema = z
  .string({ required_error: 'La orden PayPal es obligatoria' })
  .trim()
  .min(3, 'La orden PayPal es invalida')
  .max(150, 'La orden PayPal no puede exceder 150 caracteres');

export const crearOrdenPaypalSchema = z.object({
  pedido_id: pedidoIdPaypalSchema
});

export const capturarOrdenPaypalSchema = z.object({
  pedido_id: pedidoIdPaypalSchema,
  orden_id: ordenIdPaypalSchema
});

export const aprobarOrdenPaypalSimuladoSchema = capturarOrdenPaypalSchema;

export type CrearOrdenPaypalInput = z.infer<typeof crearOrdenPaypalSchema>;
export type CapturarOrdenPaypalInput = z.infer<typeof capturarOrdenPaypalSchema>;

export type AgregarCarritoItemInput = z.infer<typeof agregarCarritoItemSchema>;
export type ActualizarCarritoItemInput = z.infer<typeof actualizarCarritoItemSchema>;
export type CotizarPedidoInput = z.infer<typeof cotizarPedidoSchema>;
export type CrearPedidoInput = z.infer<typeof crearPedidoSchema>;
export type SubirComprobantePagoInput = z.infer<typeof subirComprobantePagoSchema>;
export type CambiarEstadoEnvioInput = z.infer<typeof cambiarEstadoEnvioSchema>;
export type CrearResenaInput = z.infer<typeof crearResenaSchema>;
