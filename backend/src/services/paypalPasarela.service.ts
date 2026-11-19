/**
 * ============================================================================
 * NUBAGLOW APP - PASARELA PAYPAL (SIMULADA Y SANDBOX)
 * ============================================================================
 * Interfaz comun:
 *   crearOrden(pedido, montoUsd) -> ordenId + urlAprobacion
 *   capturarOrden(ordenId)       -> estado + monto + moneda + capturaId
 *
 * La implementacion sandbox usa PayPal Orders v2 (OAuth2 + CAPTURE) y solo se
 * instancia cuando PAYPAL_MODO=sandbox y existen credenciales. Las pruebas y
 * el modo por defecto usan la implementacion simulada en memoria.
 */

import crypto from 'crypto';
import { AppError } from '../middlewares/errores';
import {
  baseUrlPaypal,
  esPaypalSimulado,
  urlsRetornoPaypal,
  verificarConfigSandbox
} from '../config/paypal';

export interface PedidoPaypal {
  id: number;
  codigoRastreo: string;
}

export interface OrdenPaypalCreada {
  ordenId: string;
  urlAprobacion: string;
}

export interface CapturaPaypal {
  estado: string;
  monto: number;
  moneda: string;
  capturaId: string;
}

export interface PasarelaPaypal {
  crearOrden(pedido: PedidoPaypal, montoUsd: number): Promise<OrdenPaypalCreada>;
  capturarOrden(ordenId: string): Promise<CapturaPaypal>;
  /** Solo la implementacion simulada lo expone para el endpoint de pruebas. */
  aprobarOrdenSimulada?(ordenId: string): Promise<{ estado: string }>;
}

interface OrdenSimulada {
  pedidoId: number;
  codigoRastreo: string;
  montoUsd: number;
  moneda: 'USD';
  estado: 'CREATED' | 'APPROVED' | 'CAPTURED';
  capturaId: string | null;
}

export class PaypalSimulado implements PasarelaPaypal {
  private readonly ordenes = new Map<string, OrdenSimulada>();

  async crearOrden(pedido: PedidoPaypal, montoUsd: number): Promise<OrdenPaypalCreada> {
    const ordenId = `SIM-PAYPAL-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    this.ordenes.set(ordenId, {
      pedidoId: pedido.id,
      codigoRastreo: pedido.codigoRastreo,
      montoUsd: Math.round(montoUsd * 100) / 100,
      moneda: 'USD',
      estado: 'CREATED',
      capturaId: null
    });

    const { returnUrl } = urlsRetornoPaypal(pedido.id);
    return {
      ordenId,
      urlAprobacion: `${returnUrl}&orden=${encodeURIComponent(ordenId)}&simulado=1`
    };
  }

  async aprobarOrdenSimulada(ordenId: string): Promise<{ estado: string }> {
    const orden = this.ordenes.get(ordenId);
    if (!orden) {
      throw new AppError('Orden PayPal simulada no encontrada', 404);
    }

    if (orden.estado === 'CREATED') {
      orden.estado = 'APPROVED';
    }
    return { estado: orden.estado };
  }

  async capturarOrden(ordenId: string): Promise<CapturaPaypal> {
    const orden = this.ordenes.get(ordenId);
    if (!orden) {
      throw new AppError('Orden PayPal simulada no encontrada', 404);
    }

    if (orden.estado === 'CAPTURED' && orden.capturaId) {
      return {
        estado: 'COMPLETED',
        monto: orden.montoUsd,
        moneda: orden.moneda,
        capturaId: orden.capturaId
      };
    }

    if (orden.estado !== 'APPROVED') {
      return {
        estado: orden.estado,
        monto: orden.montoUsd,
        moneda: orden.moneda,
        capturaId: ''
      };
    }

    orden.estado = 'CAPTURED';
    orden.capturaId = `SIM-CAPTURA-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;

    return {
      estado: 'COMPLETED',
      monto: orden.montoUsd,
      moneda: orden.moneda,
      capturaId: orden.capturaId
    };
  }
}

interface TokenPaypal {
  valor: string;
  expiraEn: number;
}

export class PaypalSandbox implements PasarelaPaypal {
  private token: TokenPaypal | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  private async obtenerToken(): Promise<string> {
    if (this.token && this.token.expiraEn > Date.now() + 30_000) {
      return this.token.valor;
    }

    const autenticacion = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const respuesta = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${autenticacion}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15_000)
    });

    if (!respuesta.ok) {
      await this.errorPaypal(respuesta, 'No se pudo autenticar con PayPal');
    }

    const datos = (await respuesta.json()) as any;
    const valor = String(datos.access_token || '');
    if (!valor) {
      throw new AppError('PayPal no devolvio un token de acceso valido', 502);
    }

    const segundos = Number(datos.expires_in) || 300;
    this.token = { valor, expiraEn: Date.now() + segundos * 1000 };
    return valor;
  }

  private async errorPaypal(respuesta: Response, mensajeBase: string): Promise<never> {
    let detalle = '';
    try {
      const datos = (await respuesta.json()) as any;
      detalle = datos?.details?.[0]?.description || datos?.message || datos?.error || '';
    } catch {
      detalle = '';
    }

    const estado = respuesta.status === 422 ? 409 : 502;
    throw new AppError(
      detalle ? `${mensajeBase}: ${String(detalle).slice(0, 200)}` : mensajeBase,
      estado
    );
  }

  async crearOrden(pedido: PedidoPaypal, montoUsd: number): Promise<OrdenPaypalCreada> {
    const token = await this.obtenerToken();
    const { returnUrl, cancelUrl } = urlsRetornoPaypal(pedido.id);

    const respuesta = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `nubaglow-orden-${pedido.id}-${Date.now()}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: `pedido-${pedido.id}`,
            custom_id: pedido.codigoRastreo,
            amount: {
              currency_code: 'USD',
              value: montoUsd.toFixed(2)
            }
          }
        ],
        application_context: {
          brand_name: 'NubaGlow',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl
        }
      }),
      signal: AbortSignal.timeout(20_000)
    });

    if (!respuesta.ok) {
      await this.errorPaypal(respuesta, 'No se pudo crear la orden de PayPal');
    }

    const datos = (await respuesta.json()) as any;
    const ordenId = String(datos.id || '');
    const enlaces = Array.isArray(datos.links) ? datos.links : [];
    const enlaceAprobacion =
      enlaces.find((enlace: any) => enlace?.rel === 'payer-action') ||
      enlaces.find((enlace: any) => enlace?.rel === 'approve');

    if (!ordenId || !enlaceAprobacion?.href) {
      throw new AppError('PayPal devolvio una orden sin enlace de aprobacion', 502);
    }

    return { ordenId, urlAprobacion: String(enlaceAprobacion.href) };
  }

  async capturarOrden(ordenId: string): Promise<CapturaPaypal> {
    const token = await this.obtenerToken();

    const respuesta = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(ordenId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `nubaglow-captura-${ordenId}`
        },
        body: '{}',
        signal: AbortSignal.timeout(20_000)
      }
    );

    if (!respuesta.ok) {
      await this.errorPaypal(respuesta, 'PayPal no pudo capturar la orden');
    }

    const datos = (await respuesta.json()) as any;
    const captura = datos?.purchase_units?.[0]?.payments?.captures?.[0];

    if (!captura) {
      throw new AppError('PayPal no devolvio datos de la captura', 502);
    }

    return {
      estado: String(captura.status || datos.status || ''),
      monto: Number(captura.amount?.value),
      moneda: String(captura.amount?.currency_code || ''),
      capturaId: String(captura.id || '')
    };
  }
}

/**
 * Instancia compartida del simulador para que crear/aprobar/capturar vean las
 * mismas ordenes durante la vida del proceso.
 */
export const paypalSimulado = new PaypalSimulado();

let pasarelaSandbox: PaypalSandbox | null = null;
let claveSandbox = '';

/**
 * Fabrica unica usada por el servicio. En modo simulado no toca la red.
 * La instancia sandbox se reutiliza para aprovechar el cache del token OAuth2.
 */
export function crearPasarelaPaypal(): PasarelaPaypal {
  if (esPaypalSimulado()) {
    return paypalSimulado;
  }

  try {
    const credenciales = verificarConfigSandbox();
    const baseUrl = baseUrlPaypal();
    const clave = `${baseUrl}|${credenciales.clientId}`;

    if (!pasarelaSandbox || claveSandbox !== clave) {
      pasarelaSandbox = new PaypalSandbox(
        baseUrl,
        credenciales.clientId,
        credenciales.clientSecret
      );
      claveSandbox = clave;
    }

    return pasarelaSandbox;
  } catch (error: any) {
    throw new AppError(error.message || 'PayPal sandbox no esta configurado', 503);
  }
}
