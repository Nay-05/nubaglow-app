/**
 * ============================================================================
 * NUBAGLOW APP - HELPERS DE FORMATO
 * ============================================================================
 */

const formatoMoneda = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatearBs(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 'Bs. 0,00';
  return `Bs. ${formatoMoneda.format(numero)}`;
}

const formatoFecha = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

export function formatearFecha(valor) {
  if (!valor) return 'Sin fecha';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
  return formatoFecha.format(fecha);
}

export function formatearFechaCorta(valor) {
  if (!valor) return 'Sin fecha';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(fecha);
}
