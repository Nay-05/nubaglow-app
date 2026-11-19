/**
 * ============================================================================
 * NUBAGLOW APP - CONFIGURACION DE PAYPAL
 * ============================================================================
 * PAYPAL_MODO decide si se usa la pasarela simulada o la API real de sandbox.
 * Las credenciales y la URL base solo viven en el entorno; nunca en el codigo.
 * PayPal no opera con bolivianos: el servidor convierte Bs. a USD con el tipo
 * de cambio definido por el negocio.
 */

export type ModoPaypal = 'simulado' | 'sandbox';

const TIPO_CAMBIO_POR_DEFECTO = 6.96;
const BASE_URL_SANDBOX = 'https://api-m.sandbox.paypal.com';

export function modoPaypal(): ModoPaypal {
  const valor = (process.env.PAYPAL_MODO || '').trim().toLowerCase();
  return valor === 'sandbox' ? 'sandbox' : 'simulado';
}

export function esPaypalSimulado(): boolean {
  return modoPaypal() === 'simulado';
}

export function baseUrlPaypal(): string {
  const configurada = (process.env.PAYPAL_BASE_URL || process.env.PAYPAL_API_BASE || '').trim();
  return (configurada || BASE_URL_SANDBOX).replace(/\/+$/, '');
}

export interface CredencialesPaypal {
  clientId: string;
  clientSecret: string;
}

export function credencialesPaypal(): CredencialesPaypal | null {
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * Tipo de cambio expresado como Bs. por 1 USD.
 * El valor por defecto es solo un ejemplo academico: el negocio debe definirlo.
 */
export function tipoCambioBobUsd(): number {
  const valor = Number(process.env.PAYPAL_TIPO_CAMBIO_BOB_USD);
  return Number.isFinite(valor) && valor > 0 ? valor : TIPO_CAMBIO_POR_DEFECTO;
}

export function convertirBobAUsd(montoBob: number): number {
  const monto = Number(montoBob);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error('El monto en bolivianos debe ser mayor a cero');
  }

  const montoUsd = Math.round((monto / tipoCambioBobUsd()) * 100) / 100;
  if (montoUsd < 0.01) {
    throw new Error('El monto convertido a USD es demasiado bajo para PayPal');
  }
  return montoUsd;
}

export function urlFrontend(): string {
  return (
    process.env.FRONTEND_URL?.trim() ||
    process.env.CLIENT_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

export function urlsRetornoPaypal(pedidoId: number): {
  returnUrl: string;
  cancelUrl: string;
} {
  const base = urlFrontend();
  return {
    returnUrl: `${base}/pedidos?paypal=retorno&pedido=${pedidoId}`,
    cancelUrl: `${base}/pedidos?paypal=cancelado&pedido=${pedidoId}`
  };
}

/**
 * La pasarela real solo puede ejecutarse en modo sandbox y con credenciales.
 * Si falta configuracion se falla de forma segura, sin caer a simulacion.
 */
export function verificarConfigSandbox(): CredencialesPaypal {
  if (modoPaypal() !== 'sandbox') {
    throw new Error('La pasarela sandbox de PayPal requiere PAYPAL_MODO=sandbox');
  }

  const credenciales = credencialesPaypal();
  if (!credenciales) {
    throw new Error(
      'PayPal sandbox requiere PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET configurados'
    );
  }

  return credenciales;
}
