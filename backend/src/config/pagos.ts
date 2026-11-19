/**
 * ============================================================================
 * NUBAGLOW APP - CONFIGURACION DE VENCIMIENTO DE PAGOS
 * ============================================================================
 * El plazo es configurable por entorno. Valor por defecto: 24 horas.
 */

export function horasVencimientoPago(): number {
  const valor = Number(process.env.PAGO_VENCIMIENTO_HORAS);
  return Number.isFinite(valor) && valor > 0 ? valor : 24;
}

export function fechaVencimientoPago(desde: Date = new Date()): Date {
  return new Date(desde.getTime() + horasVencimientoPago() * 60 * 60 * 1000);
}
