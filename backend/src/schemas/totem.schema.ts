/**
 * ============================================================================
 * NUBAGLOW APP - ESQUEMA ZOD DEL TOTEM DE AUTOSERVICIO
 * ============================================================================
 * Validacion estricta del cuerpo de POST /api/totem/venta:
 * - Solo variantes existentes, cantidades enteras y metodos permitidos.
 * - El PIN y los ultimos 4 digitos solo se exigen en pago con tarjeta ATM.
 * - Se rechazan propiedades desconocidas para evitar manipulacion de precios
 *   o de datos internos enviados desde el totem.
 */

import { z } from 'zod';

export const METODO_TARJETA_ATM = 'Tarjeta Débito ATM (POS)';
export const METODO_QR_BANCARIO = 'QR Bancario';

const itemTotemSchema = z.object({
  variante_id: z.coerce
    .number({ invalid_type_error: 'La variante debe ser numerica' })
    .int('La variante debe ser un entero')
    .positive('La variante es obligatoria'),
  cantidad: z.coerce
    .number({ invalid_type_error: 'La cantidad debe ser numerica' })
    .int('La cantidad debe ser un entero')
    .min(1, 'La cantidad minima es 1')
    .max(50, 'La cantidad maxima por articulo es 50')
});

export const crearVentaTotemSchema = z
  .object({
    items: z
      .array(itemTotemSchema)
      .min(1, 'El pedido debe incluir al menos un articulo')
      .max(40, 'El pedido no puede exceder 40 articulos distintos'),
    cliente_nombre: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(150, 'El nombre no puede exceder 150 caracteres')
      .optional()
      .or(z.literal('')),
    cliente_nit_ci: z
      .string()
      .trim()
      .max(50, 'El NIT/CI no puede exceder 50 caracteres')
      .optional()
      .or(z.literal('')),
    metodo_pago: z.enum([METODO_TARJETA_ATM, METODO_QR_BANCARIO], {
      errorMap: () => ({
        message:
          'Metodo de pago no valido. Opciones: Tarjeta Debito ATM (POS) o QR Bancario'
      })
    }),
    pin: z
      .string()
      .regex(/^\d{4}$/, 'El PIN debe tener exactamente 4 digitos')
      .optional(),
    tarjeta_ultimos4: z
      .string()
      .regex(/^\d{4}$/, 'Los ultimos 4 digitos de la tarjeta no son validos')
      .optional()
  })
  .strict('El cuerpo contiene propiedades no permitidas para el totem')
  .superRefine((datos, contexto) => {
    if (datos.metodo_pago !== METODO_TARJETA_ATM) return;

    if (!datos.pin) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pin'],
        message: 'El PIN es obligatorio para pagar con tarjeta de debito ATM'
      });
    }

    if (!datos.tarjeta_ultimos4) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tarjeta_ultimos4'],
        message: 'Los ultimos 4 digitos de la tarjeta son obligatorios'
      });
    }
  });

export type CrearVentaTotemInput = z.infer<typeof crearVentaTotemSchema>;
