/**
 * ============================================================================
 * NUBAGLOW APP - LIMITES DE COMPROBANTES DE PAGO
 * ============================================================================
 * El tamano maximo por comprobante lo define el entorno con COMPROBANTE_MAX_MB.
 * Por defecto se permiten 2 MB porque el archivo se almacena en la base de datos.
 */

const MEGABYTE = 1024 * 1024;
const MAX_MB_POR_DEFECTO = 2;

export function maxMbComprobante(): number {
  const crudo = process.env.COMPROBANTE_MAX_MB;
  if (crudo === undefined || crudo.trim() === '') return MAX_MB_POR_DEFECTO;

  const valor = Number(crudo);
  return Number.isFinite(valor) && valor > 0 ? valor : MAX_MB_POR_DEFECTO;
}

export function tamanoMaximoComprobanteBytes(): number {
  return Math.floor(maxMbComprobante() * MEGABYTE);
}

/**
 * Limite del parser JSON: el contenido viaja en base64 (aprox. 4/3 del archivo)
 * mas los metadatos declarados. Se agregan 2 MB de margen.
 */
export function limiteCuerpoComprobante(): string {
  return `${Math.ceil(maxMbComprobante() + 2)}mb`;
}
