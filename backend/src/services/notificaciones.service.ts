/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE NOTIFICACIONES
 * ============================================================================
 * Envia correos por SMTP y mensajes por Telegram Bot API. Ningun metodo lanza
 * excepciones hacia afuera: cada intento se registra en la tabla notificaciones
 * con estado enviada, fallida u omitida. Un fallo de notificacion nunca debe
 * revertir ni bloquear una compra ya confirmada.
 */

import nodemailer from 'nodemailer';
import { consultar } from '../db';
import { urlAplicacion } from '../config/paypal';
import { comprobantePdfService } from './comprobantePdf.service';

export type EstadoNotificacion = 'enviada' | 'fallida' | 'omitida';
export type CanalNotificacion = 'correo' | 'telegram';

export interface AdjuntoCorreo {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface DatosCorreo {
  pedidoId?: number | null;
  destinatario: string;
  asunto: string;
  cuerpo: string;
  adjuntos?: AdjuntoCorreo[];
}

export interface DatosTelegram {
  pedidoId?: number | null;
  asunto?: string | null;
  cuerpo: string;
  destinatario?: string | null;
}

export interface ResultadoNotificacion {
  canal: CanalNotificacion;
  destinatario: string;
  estado: EstadoNotificacion;
  error: string | null;
}

export interface ResultadoNotificacionPedido {
  correo: ResultadoNotificacion;
  telegram: ResultadoNotificacion;
}

export type EnviadorCorreo = (datos: DatosCorreo) => Promise<void>;
export type EnviadorTelegram = (
  datos: DatosTelegram,
  destinatario: string
) => Promise<void>;

const TIEMPO_ESPERA_MS = 10_000;

interface ConfiguracionSmtp {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function configuracionSmtp(): ConfiguracionSmtp | null {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const from = (process.env.SMTP_FROM || '').trim();

  if (!host || !Number.isInteger(port) || port <= 0 || !user || !pass || !from) {
    return null;
  }

  return { host, port, user, pass, from };
}

function configuracionTelegram(): { token: string; chatId: string } | null {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();

  if (!token || !chatId) return null;
  return { token, chatId };
}

function mensajeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'Error desconocido');
}

const ETIQUETAS_METODO: Record<string, string> = {
  qr_simple: 'QR simple',
  qr: 'QR simple',
  deposito_bancario: 'Depósito bancario',
  paypal: 'PayPal',
  contra_entrega: 'Contra entrega'
};

function formatearBsNotificacion(valor: number): string {
  const numero = Number(valor);
  return `Bs. ${new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(numero) ? numero : 0)}`;
}

function instruccionesPago(metodo: string): string {
  if (metodo === 'qr_simple' || metodo === 'qr') {
    return (
      'Escanea el QR desde la página del pedido y sube el ' +
      'comprobante de pago.'
    );
  }
  if (metodo === 'deposito_bancario') {
    return (
      'Realiza el depósito bancario y sube el comprobante desde ' +
      'la página del pedido.'
    );
  }
  if (metodo === 'paypal') {
    return (
      'Completa el pago con PayPal desde el botón Pagar con PayPal ' +
      'en la página del pedido.'
    );
  }
  if (metodo === 'contra_entrega') {
    return 'El pago se realiza en efectivo al recibir el pedido en Sucre.';
  }
  return 'Revisa las instrucciones de pago en la página del pedido.';
}

function crearCuerpoCorreo(pedido: any): string {
  const metodo = pedido.pago?.metodo || '';
  const etiqueta = ETIQUETAS_METODO[metodo] || 'Sin pago registrado';
  const items = Array.isArray(pedido.items) ? pedido.items : [];
  const lineasItems = items.map((item: any) =>
    `- ${item.productoNombre} · ${item.varianteNombre}: ` +
    `${item.cantidad} x ${formatearBsNotificacion(item.precioUnitario)} ` +
    `= ${formatearBsNotificacion(item.subtotal)}`
  );
  const rutaPedido =
    `${urlAplicacion()}/pedido/` +
    encodeURIComponent(String(pedido.codigoRastreo));

  return [
    `Hola ${pedido.nombreCliente},`,
    '',
    'Gracias por comprar en NubaGlow. Tu pedido fue confirmado.',
    `Código de rastreo: ${pedido.codigoRastreo}`,
    '',
    'Resumen del pedido:',
    ...lineasItems,
    '',
    `Subtotal: ${formatearBsNotificacion(pedido.subtotal)}`,
    `Envío: ${formatearBsNotificacion(pedido.costoEnvio)}`,
    `Total: ${formatearBsNotificacion(pedido.total)}`,
    '',
    `Método de pago: ${etiqueta}`,
    `Estado del pago: ${pedido.pago?.estado || 'Sin pago registrado'}`,
    '',
    `Instrucciones: ${instruccionesPago(metodo)}`,
    `Puedes revisar tu pedido en: ${rutaPedido}`,
    '',
    'Adjuntamos tu comprobante en PDF.',
    'NubaGlow · Sucre, Bolivia'
  ].join('\n');
}

function crearCuerpoTelegram(pedido: any): string {
  const metodo = pedido.pago?.metodo || '';
  const etiqueta = ETIQUETAS_METODO[metodo] || 'Sin pago registrado';

  return [
    `NubaGlow: nuevo pedido ${pedido.codigoRastreo}`,
    `Total: ${formatearBsNotificacion(pedido.total)}`,
    `Método de pago: ${etiqueta}`,
    `Ciudad: ${pedido.ciudad}`,
    `Estado del pago: ${pedido.pago?.estado || 'Sin pago registrado'}`
  ].join('\n');
}

async function registrarNotificacion(registro: {
  pedidoId?: number | null;
  canal: CanalNotificacion;
  destinatario: string;
  asunto?: string | null;
  cuerpo: string;
  estado: EstadoNotificacion;
  error?: string | null;
}): Promise<void> {
  try {
    await consultar(
      `INSERT INTO notificaciones
        (pedido_id, canal, destinatario, asunto, cuerpo, estado, error, enviado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        registro.pedidoId ?? null,
        registro.canal,
        registro.destinatario,
        registro.asunto ?? null,
        registro.cuerpo,
        registro.estado,
        registro.error ?? null,
        registro.estado === 'enviada' ? new Date() : null
      ]
    );
  } catch (error) {
    console.error(
      'No se pudo registrar el intento de notificacion:',
      mensajeError(error)
    );
  }
}

export function crearEnviadorCorreo(): EnviadorCorreo | null {
  if (process.env.NODE_ENV === 'test') return null;

  const config = configuracionSmtp();
  if (!config) return null;

  return async (datos: DatosCorreo) => {
    const transporte = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: TIEMPO_ESPERA_MS,
      greetingTimeout: TIEMPO_ESPERA_MS,
      socketTimeout: TIEMPO_ESPERA_MS
    });

    await transporte.sendMail({
      from: config.from,
      to: datos.destinatario,
      subject: datos.asunto,
      text: datos.cuerpo,
      attachments: (datos.adjuntos || []).map((adjunto) => ({
        filename: adjunto.filename,
        content: adjunto.content,
        contentType: adjunto.contentType
      }))
    });
  };
}

export function crearEnviadorTelegram(): EnviadorTelegram | null {
  if (process.env.NODE_ENV === 'test') return null;

  const config = configuracionTelegram();
  if (!config) return null;

  return async (datos: DatosTelegram, destinatario: string) => {
    const respuesta = await fetch(
      `https://api.telegram.org/bot${config.token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: destinatario,
          text: datos.cuerpo,
          disable_web_page_preview: true
        }),
        signal: AbortSignal.timeout(TIEMPO_ESPERA_MS)
      }
    );

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      throw new Error(
        `Telegram respondio ${respuesta.status}: ${detalle.slice(0, 200)}`
      );
    }
  };
}

export class NotificacionesService {
  constructor(
    private readonly correoFactory: () => EnviadorCorreo | null =
      crearEnviadorCorreo,
    private readonly telegramFactory: () => EnviadorTelegram | null =
      crearEnviadorTelegram
  ) {}

  async enviarCorreo(datos: DatosCorreo): Promise<ResultadoNotificacion> {
    const enviador = this.correoFactory();

    if (!enviador) {
      const error = 'SMTP no configurado';
      await registrarNotificacion({
        pedidoId: datos.pedidoId,
        canal: 'correo',
        destinatario: datos.destinatario,
        asunto: datos.asunto,
        cuerpo: datos.cuerpo,
        estado: 'omitida',
        error
      });
      return {
        canal: 'correo',
        destinatario: datos.destinatario,
        estado: 'omitida',
        error
      };
    }

    try {
      await enviador(datos);
      await registrarNotificacion({
        pedidoId: datos.pedidoId,
        canal: 'correo',
        destinatario: datos.destinatario,
        asunto: datos.asunto,
        cuerpo: datos.cuerpo,
        estado: 'enviada'
      });
      return {
        canal: 'correo',
        destinatario: datos.destinatario,
        estado: 'enviada',
        error: null
      };
    } catch (error) {
      const mensaje = mensajeError(error);
      await registrarNotificacion({
        pedidoId: datos.pedidoId,
        canal: 'correo',
        destinatario: datos.destinatario,
        asunto: datos.asunto,
        cuerpo: datos.cuerpo,
        estado: 'fallida',
        error: mensaje
      });
      return {
        canal: 'correo',
        destinatario: datos.destinatario,
        estado: 'fallida',
        error: mensaje
      };
    }
  }

  async enviarTelegram(datos: DatosTelegram): Promise<ResultadoNotificacion> {
    const config = configuracionTelegram();
    const destinatario =
      (datos.destinatario || '').trim() ||
      config?.chatId ||
      'sin configurar';
    const enviador = this.telegramFactory();

    if (!enviador) {
      const error = 'Telegram no configurado';
      await registrarNotificacion({
        pedidoId: datos.pedidoId,
        canal: 'telegram',
        destinatario,
        asunto: datos.asunto ?? null,
        cuerpo: datos.cuerpo,
        estado: 'omitida',
        error
      });
      return { canal: 'telegram', destinatario, estado: 'omitida', error };
    }

    try {
      await enviador(datos, destinatario);
      await registrarNotificacion({
        pedidoId: datos.pedidoId,
        canal: 'telegram',
        destinatario,
        asunto: datos.asunto ?? null,
        cuerpo: datos.cuerpo,
        estado: 'enviada'
      });
      return {
        canal: 'telegram',
        destinatario,
        estado: 'enviada',
        error: null
      };
    } catch (error) {
      const mensaje = mensajeError(error);
      await registrarNotificacion({
        pedidoId: datos.pedidoId,
        canal: 'telegram',
        destinatario,
        asunto: datos.asunto ?? null,
        cuerpo: datos.cuerpo,
        estado: 'fallida',
        error: mensaje
      });
      return { canal: 'telegram', destinatario, estado: 'fallida', error: mensaje };
    }
  }

  async notificarPedido(pedido: any): Promise<ResultadoNotificacionPedido> {
    const asunto = `NubaGlow: pedido ${pedido.codigoRastreo} confirmado`;
    const cuerpoCorreo = crearCuerpoCorreo(pedido);
    const cuerpoTelegram = crearCuerpoTelegram(pedido);

    let adjuntos: AdjuntoCorreo[] = [];

    try {
      const comprobante = await comprobantePdfService.generar(pedido);
      adjuntos = [
        {
          filename: comprobante.nombreArchivo,
          content: comprobante.buffer,
          contentType: 'application/pdf'
        }
      ];
    } catch (error) {
      console.error(
        'No se pudo generar el comprobante PDF adjunto:',
        mensajeError(error)
      );
    }

    const [correo, telegram] = await Promise.all([
      this.enviarCorreo({
        pedidoId: pedido.id,
        destinatario: pedido.correoCliente,
        asunto,
        cuerpo: cuerpoCorreo,
        adjuntos
      }),
      this.enviarTelegram({
        pedidoId: pedido.id,
        asunto,
        cuerpo: cuerpoTelegram
      })
    ]);

    return { correo, telegram };
  }
}

export const notificacionesService = new NotificacionesService();
