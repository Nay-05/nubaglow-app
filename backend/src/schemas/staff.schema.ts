/**
 * ============================================================================
 * NUBAGLOW APP - ESQUEMAS DE VALIDACION ZOD: MODULOS INTERNOS DE STAFF
 * ============================================================================
 */

import { z } from 'zod';

const fechaCalendarioSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD')
  .refine((fecha) => {
    const valor = new Date(`${fecha}T00:00:00Z`);
    return (
      !Number.isNaN(valor.getTime()) &&
      valor.toISOString().startsWith(fecha)
    );
  }, 'La fecha no es valida');

// ----------------------------------------------------------------------------
// 1. VENTAS POS (MOSTRADOR)
// ----------------------------------------------------------------------------
export const crearVentaPosItemSchema = z.object({
  variante_id: z.coerce.number().int().positive('El id de variante es obligatorio'),
  cantidad: z.coerce.number().int().min(1, 'La cantidad minima a vender es 1')
});

export const consultaFechaPosSchema = z.object({
  fecha: fechaCalendarioSchema.optional()
});

export const crearVentaPosSchema = z.object({
  items: z.array(crearVentaPosItemSchema).min(1, 'La venta POS debe incluir al menos un producto'),
  metodo_pago: z.enum(['Efectivo', 'QR Simple'], {
    errorMap: () => ({ message: 'Metodo de pago POS no valido. Opciones: Efectivo, QR Simple' })
  }),
  monto_recibido: z.coerce.number().min(0, 'El monto recibido no puede ser negativo').default(0),
  cliente_nombre: z.string().trim().max(150).optional(),
  cliente_nit_ci: z.string().trim().max(50).optional(),
  cliente_correo: z.string().trim().email('El correo del cliente no es valido').optional().or(z.literal(''))
});

// ----------------------------------------------------------------------------
// 2. INVENTARIO Y KARDEX
// ----------------------------------------------------------------------------
export const ajusteInventarioSchema = z.object({
  tipo: z.enum(['entrada', 'ajuste'], {
    errorMap: () => ({ message: 'Tipo de movimiento invalido. Opciones: entrada, ajuste' })
  }),
  cantidad: z.coerce.number().int('La cantidad debe ser un numero entero'),
  motivo: z
    .string({ required_error: 'El motivo del movimiento es obligatorio' })
    .trim()
    .min(3, 'El motivo debe tener al menos 3 caracteres')
    .max(500, 'El motivo no puede exceder 500 caracteres')
});

// ----------------------------------------------------------------------------
// 3. REPORTES
// ----------------------------------------------------------------------------
export const consultaReportesSchema = z.object({
  desde: fechaCalendarioSchema.optional(),
  hasta: fechaCalendarioSchema.optional()
});

export const consultaAuditoriaSchema = z.object({
  usuario_id: z.coerce.number().int().positive().optional(),
  accion: z.string().trim().max(100).optional(),
  fecha: fechaCalendarioSchema.optional(),
  pagina: z.coerce.number().int().min(1).default(1).optional(),
  limite: z.coerce
    .number()
    .int()
    .min(1)
    .max(100, 'El limite maximo es 100')
    .default(25)
    .optional()
});

// ----------------------------------------------------------------------------
// 4. VERIFICACION DE PAGOS
// ----------------------------------------------------------------------------
export const estadosPagoFiltro = [
  'En verificación',
  'Aprobado',
  'Rechazado'
] as const;

export const consultaPagosSchema = z.object({
  estado: z.enum(estadosPagoFiltro).optional()
});

export const rechazarPagoSchema = z.object({
  motivo: z
    .string({ required_error: 'El motivo de rechazo es obligatorio' })
    .trim()
    .min(5, 'El motivo del rechazo debe tener al menos 5 caracteres')
    .max(500, 'El motivo del rechazo no puede exceder 500 caracteres')
});

// ----------------------------------------------------------------------------
// 5. GESTION DE USUARIOS STAFF
// ----------------------------------------------------------------------------
export const rolesStaffValidos = ['vendedor', 'almacen', 'logistica', 'admin'] as const;

export const crearUsuarioStaffSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(150),
  email: z
    .string({ required_error: 'El correo electronico es obligatorio' })
    .trim()
    .toLowerCase()
    .email('El formato del correo electronico no es valido'),
  password: z
    .string({ required_error: 'La contrasena es obligatoria' })
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contrasena debe contener al menos una mayuscula')
    .regex(/[0-9]/, 'La contrasena debe contener al menos un numero'),
  rol: z.enum(rolesStaffValidos, {
    errorMap: () => ({ message: 'Rol de personal no valido. Opciones permitidas: vendedor, almacen, logistica, admin' })
  })
});

export const actualizarUsuarioStaffSchema = z.object({
  nombre: z.string().trim().min(3).max(150).optional(),
  rol: z.enum(rolesStaffValidos).optional(),
  activo: z.boolean().optional()
});

export const restablecerPasswordStaffSchema = z.object({
  nueva_password: z
    .string({ required_error: 'La nueva contrasena es obligatoria' })
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contrasena debe contener al menos una mayuscula')
    .regex(/[0-9]/, 'La contrasena debe contener al menos un numero')
});

export type CrearVentaPosInput = z.infer<typeof crearVentaPosSchema>;
export type AjusteInventarioInput = z.infer<typeof ajusteInventarioSchema>;
export const cancelarPedidoSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(5, 'El motivo de cancelacion debe tener al menos 5 caracteres')
    .max(500, 'El motivo de cancelacion no puede exceder 500 caracteres')
    .optional()
});

export type ConsultaReportesInput = z.infer<typeof consultaReportesSchema>;
export type ConsultaAuditoriaInput = z.infer<typeof consultaAuditoriaSchema>;
export type ConsultaPagosInput = z.infer<typeof consultaPagosSchema>;
export type RechazarPagoInput = z.infer<typeof rechazarPagoSchema>;
export type CancelarPedidoInput = z.infer<typeof cancelarPedidoSchema>;
export type CrearUsuarioStaffInput = z.infer<typeof crearUsuarioStaffSchema>;
export type ActualizarUsuarioStaffInput = z.infer<typeof actualizarUsuarioStaffSchema>;
export type RestablecerPasswordStaffInput = z.infer<typeof restablecerPasswordStaffSchema>;
