/**
 * ============================================================================
 * NUBAGLOW APP - PARAMETROS DE ENVIO
 * ============================================================================
 * El costo de envio y el umbral de envio gratis los define el negocio, no son
 * valores fijos del sistema. Se leen del entorno en cada cotizacion:
 *   - ENVIO_COSTO: costo fijo en Bolivianos cuando no se alcanza el umbral.
 *   - ENVIO_GRATIS_DESDE: subtotal minimo para que el envio sea gratuito.
 * Los valores por defecto son solo de ejemplo para la demostracion academica.
 */

const COSTO_ENVIO_POR_DEFECTO = 15;
const GRATIS_DESDE_POR_DEFECTO = 200;

function leerNumeroNoNegativo(nombre: string, porDefecto: number): number {
  const crudo = process.env[nombre];
  if (crudo === undefined || crudo.trim() === '') return porDefecto;

  const valor = Number(crudo);
  return Number.isFinite(valor) && valor >= 0 ? valor : porDefecto;
}

export interface ParametrosEnvio {
  costo: number;
  gratisDesde: number;
}

/**
 * Lee los parametros de envio definidos por el negocio en variables de entorno.
 */
export function obtenerParametrosEnvio(): ParametrosEnvio {
  return {
    costo: leerNumeroNoNegativo('ENVIO_COSTO', COSTO_ENVIO_POR_DEFECTO),
    gratisDesde: leerNumeroNoNegativo('ENVIO_GRATIS_DESDE', GRATIS_DESDE_POR_DEFECTO)
  };
}

/**
 * Calcula el costo de envio de un subtotal segun la politica vigente del negocio.
 */
export function calcularCostoEnvio(subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;

  const { costo, gratisDesde } = obtenerParametrosEnvio();
  return subtotal >= gratisDesde ? 0 : costo;
}
