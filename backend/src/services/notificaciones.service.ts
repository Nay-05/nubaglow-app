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
import {
  ConfiguracionCorreoHttp,
  ConfiguracionSmtp,
  leerVariable,
  obtenerConfiguracionCorreoHttp,
  obtenerConfiguracionSmtp,
  obtenerConfiguracionTelegram,
  remitenteCorreo,
  urlAplicacion
} from '../config/env';
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
  html?: string;
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

export interface IntentoPruebaCanal {
  proveedor: string;
  exito: boolean;
  mensaje: string | null;
  codigo: string | number | null;
  respuesta: unknown;
}

export interface ResultadoPruebaCanal {
  canal: CanalNotificacion | 'correo_http';
  exito: boolean;
  proveedor?: string | null;
  destinatario?: string | null;
  error: string | null;
  intentos?: IntentoPruebaCanal[];
  detalles?: unknown;
}

export interface ResultadoPruebaNotificaciones {
  correo: ResultadoPruebaCanal;
  telegram: ResultadoPruebaCanal;
}

export type EnviadorCorreo = (datos: DatosCorreo) => Promise<void>;
export type EnviadorTelegram = (
  datos: DatosTelegram,
  destinatario: string
) => Promise<void>;

const TIEMPO_ESPERA_MS = 10_000;

interface DetalleErrorEnvio {
  message: string;
  code: string | number | null;
  response: unknown;
  command?: string | null;
}

function detalleErrorEnvio(error: unknown): DetalleErrorEnvio {
  const detalle = error as any;
  return {
    message:
      detalle?.message ||
      (error instanceof Error ? error.message : String(error || 'Error desconocido')),
    code: detalle?.code ?? detalle?.status ?? null,
    response: detalle?.response ?? detalle?.body ?? null,
    command: detalle?.command ?? null
  };
}

function mensajeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'Error desconocido');
}

/**
 * Traduce los errores mas comunes de Telegram en una accion concreta.
 */
function pistaTelegram(detalle: string): string | null {
  if (/chat not found/i.test(detalle)) {
    return (
      'TELEGRAM_CHAT_ID no existe para este bot o la cuenta nunca inicio ' +
      'el bot. Envia /start al bot y actualiza TELEGRAM_CHAT_ID en Render.'
    );
  }
  if (/bot was blocked|Forbidden/i.test(detalle)) {
    return (
      'La cuenta bloqueo el bot o el bot no es administrador del canal. ' +
      'Desbloquealo o agregalo como administrador.'
    );
  }
  if (/Unauthorized/i.test(detalle)) {
    return 'TELEGRAM_BOT_TOKEN invalido o revocado. Genera uno nuevo con BotFather.';
  }
  return null;
}

function registrarFalloEnvio(canal: string, error: unknown): void {
  console.error(
    `[NubaGlow][${canal}] Fallo al enviar notificacion:`,
    detalleErrorEnvio(error)
  );
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

export interface CorreoGenerado {
  texto: string;
  html: string;
}

interface ItemCorreo {
  productoNombre: string;
  varianteNombre?: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface TotalCorreo {
  etiqueta: string;
  valor: number;
  destacado?: boolean;
}

interface DetalleCorreo {
  etiqueta: string;
  valor: string;
}

interface DatosEditorial {
  nombre: string;
  titulo: string;
  subtitulo: string;
  codigoEtiqueta?: string;
  codigo?: string;
  items?: ItemCorreo[];
  totales?: TotalCorreo[];
  detalles?: DetalleCorreo[];
  pago?: { metodo: string; estado: string };
  instrucciones?: string;
  nota?: string;
  urlAccion?: string;
  etiquetaAccion?: string;
}

export function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ESTILOS_CORREO = `
  body { margin: 0; padding: 0; background: #f3ece5; color: #2b2124; }
  .email-bg { background: #f3ece5; }
  .email-wrap { padding: 24px 12px; }
  .email-card {
    width: 100%; max-width: 620px; margin: 0 auto; background: #faf8f5;
    border: 1px solid #cebebe; border-radius: 14px; overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
  }
  .email-header { background: #6d2e46; padding: 26px 28px; }
  .email-brand {
    margin: 0; color: #faf8f5; font-family: Georgia, 'Times New Roman', serif;
    font-size: 24px; font-weight: 400; letter-spacing: 0.02em;
  }
  .email-tagline {
    margin: 6px 0 0; color: #ece2d0; font-size: 12px;
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .email-content { padding: 28px; }
  .email-title {
    margin: 0 0 6px; color: #6d2e46; font-family: Georgia, 'Times New Roman', serif;
    font-size: 28px; font-weight: 400;
  }
  .email-subtitle { margin: 0 0 22px; color: #6b5b60; font-size: 14px; }
  .tracking-box {
    padding: 16px; margin: 0 0 22px; background: #ece2d0;
    border: 1px solid #cebebe; border-radius: 10px;
  }
  .email-label {
    margin: 0 0 4px; color: #6b5b60; font-size: 11px;
    font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  }
  .tracking-code {
    margin: 0; color: #6d2e46; font-family: Consolas, Menlo, monospace;
    font-size: 19px; font-weight: 700; letter-spacing: 0.04em;
  }
  .email-section { margin: 24px 0 10px; color: #6d2e46; font-size: 16px; }
  .items { width: 100%; border-collapse: collapse; font-size: 13px; }
  .items th {
    padding: 8px 6px; color: #6b5b60; background: #ece2d0;
    font-size: 10px; letter-spacing: 0.08em; text-align: left;
    text-transform: uppercase;
  }
  .items td { padding: 10px 6px; border-bottom: 1px solid #cebebe; }
  .items .num { text-align: right; white-space: nowrap; }
  .muted { color: #6b5b60; font-size: 11px; }
  .totals { width: 100%; margin-top: 10px; border-collapse: collapse; }
  .totals td { padding: 6px 6px; font-size: 13px; }
  .totals .num { text-align: right; white-space: nowrap; }
  .totals .total-row td {
    padding-top: 12px; color: #6d2e46; font-size: 17px; font-weight: 700;
  }
  .details { width: 100%; margin-top: 12px; border-collapse: collapse; }
  .details td { padding: 6px; border-bottom: 1px solid #ece2d0; font-size: 13px; }
  .details td:first-child { color: #6b5b60; width: 42%; }
  .badges { margin: 18px 0; }
  .badge {
    display: inline-block; padding: 5px 10px; margin: 0 6px 6px 0;
    color: #6d2e46; background: #ece2d0; border: 1px solid #cebebe;
    border-radius: 999px; font-size: 11px; font-weight: 700;
  }
  .badge-status { background: #faf8f5; }
  .notice {
    padding: 14px 16px; margin: 18px 0; color: #2b2124;
    background: #f4eee6; border-left: 3px solid #6d2e46;
    border-radius: 0 8px 8px 0; font-size: 13px; line-height: 1.6;
  }
  .email-button {
    display: inline-block; padding: 12px 20px; margin-top: 8px;
    color: #faf8f5; background: #6d2e46; border-radius: 8px;
    font-size: 14px; font-weight: 700; text-decoration: none;
  }
  .email-footer {
    padding: 20px 28px; color: #6b5b60; background: #f4eee6;
    border-top: 1px solid #cebebe; font-size: 11px; line-height: 1.6;
  }
  @media only screen and (max-width: 600px) {
    .email-content { padding: 20px !important; }
    .email-header, .email-footer { padding-left: 20px !important; padding-right: 20px !important; }
    .email-title { font-size: 24px !important; }
  }
`;

function crearHtmlEditorial(datos: DatosEditorial): string {
  const items = datos.items || [];
  const totales = datos.totales || [];
  const detalles = datos.detalles || [];

  const filasItems = items
    .map(
      (item) =>
        '<tr>' +
        '<td>' +
        `${escaparHtml(item.productoNombre)}` +
        (item.varianteNombre
          ? `<br><span class="muted">${escaparHtml(item.varianteNombre)}</span>`
          : '') +
        '</td>' +
        `<td class="num">${escaparHtml(item.cantidad)}</td>` +
        `<td class="num">${escaparHtml(
          formatearBsNotificacion(item.precioUnitario)
        )}</td>` +
        `<td class="num">${escaparHtml(
          formatearBsNotificacion(item.subtotal)
        )}</td>` +
        '</tr>'
    )
    .join('');

  const filasTotales = totales
    .map(
      (total) =>
        `<tr class="${total.destacado ? 'total-row' : ''}">` +
        `<td>${escaparHtml(total.etiqueta)}</td>` +
        `<td class="num">${escaparHtml(
          formatearBsNotificacion(total.valor)
        )}</td>` +
        '</tr>'
    )
    .join('');

  const filasDetalles = detalles
    .map(
      (detalle) =>
        '<tr>' +
        `<td>${escaparHtml(detalle.etiqueta)}</td>` +
        `<td>${escaparHtml(detalle.valor)}</td>` +
        '</tr>'
    )
    .join('');

  const tablaItems = items.length
    ? '<h2 class="email-section">Detalle de artículos</h2>' +
      '<table role="presentation" class="items" cellpadding="0" cellspacing="0">' +
      '<thead><tr>' +
      '<th>Producto</th><th class="num">Cant.</th>' +
      '<th class="num">P. unit.</th><th class="num">Subtotal</th>' +
      '</tr></thead>' +
      `<tbody>${filasItems}</tbody>` +
      '</table>'
    : '';

  const tablaTotales = totales.length
    ? '<table role="presentation" class="totals" cellpadding="0" cellspacing="0">' +
      `<tbody>${filasTotales}</tbody>` +
      '</table>'
    : '';

  const tablaDetalles = detalles.length
    ? '<table role="presentation" class="details" cellpadding="0" cellspacing="0">' +
      `<tbody>${filasDetalles}</tbody>` +
      '</table>'
    : '';

  const badges = datos.pago
    ? '<div class="badges">' +
      `<span class="badge">Método: ${escaparHtml(datos.pago.metodo)}</span>` +
      `<span class="badge badge-status">Estado: ${escaparHtml(
        datos.pago.estado
      )}</span>` +
      '</div>'
    : '';

  const instrucciones = datos.instrucciones
    ? `<div class="notice">${escaparHtml(datos.instrucciones)}</div>`
    : '';

  const nota = datos.nota
    ? `<p class="muted">${escaparHtml(datos.nota)}</p>`
    : '';

  const boton =
    datos.urlAccion && datos.etiquetaAccion
      ? `<a class="email-button" href="${escaparHtml(datos.urlAccion)}">` +
        `${escaparHtml(datos.etiquetaAccion)}</a>`
      : '';

  const tracking =
    datos.codigo
      ? '<div class="tracking-box">' +
        `<p class="email-label">${escaparHtml(
          datos.codigoEtiqueta || 'Código de rastreo'
        )}</p>` +
        `<p class="tracking-code">${escaparHtml(datos.codigo)}</p>` +
        '</div>'
      : '';

  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>NubaGlow</title>',
    `<style>${ESTILOS_CORREO}</style>`,
    '</head>',
    '<body>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-bg">',
    '<tr><td align="center" class="email-wrap">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card">',
    '<tr><td class="email-header">',
    '<h1 class="email-brand">NubaGlow — Sucre, Bolivia</h1>',
    '<p class="email-tagline">Skincare y maquillaje</p>',
    '</td></tr>',
    '<tr><td class="email-content">',
    `<h2 class="email-title">${escaparHtml(datos.titulo)}</h2>`,
    `<p class="email-subtitle">${escaparHtml(datos.subtitulo)}</p>`,
    `<p class="email-subtitle">Hola ${escaparHtml(datos.nombre)},</p>`,
    tracking,
    badges,
    tablaItems,
    tablaTotales,
    tablaDetalles,
    instrucciones,
    boton,
    nota,
    '</td></tr>',
    '<tr><td class="email-footer">',
    'NubaGlow · Sucre, Bolivia<br>',
    'Comprobante académico de simulación — Sin valor fiscal.',
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>'
  ].join('\n');
}

export function crearCorreoConfirmacionPedido(pedido: any): CorreoGenerado {
  const texto = crearCuerpoCorreo(pedido);
  const metodo = pedido.pago?.metodo || '';
  const etiqueta = ETIQUETAS_METODO[metodo] || 'Sin pago registrado';
  const items = (Array.isArray(pedido.items) ? pedido.items : []).map(
    (item: any) => ({
      productoNombre: String(item.productoNombre || 'Producto'),
      varianteNombre: String(item.varianteNombre || ''),
      cantidad: Number(item.cantidad) || 0,
      precioUnitario: Number(item.precioUnitario) || 0,
      subtotal: Number(item.subtotal) || 0
    })
  );
  const rutaPedido =
    `${urlAplicacion()}/pedido/` +
    encodeURIComponent(String(pedido.codigoRastreo));
  const html = crearHtmlEditorial({
    nombre: String(pedido.nombreCliente || 'cliente'),
    titulo: 'Pedido confirmado',
    subtitulo: 'Gracias por tu compra. Ya estamos preparando tu pedido.',
    codigo: String(pedido.codigoRastreo || ''),
    items,
    totales: [
      { etiqueta: 'Subtotal', valor: Number(pedido.subtotal) || 0 },
      { etiqueta: 'Envío', valor: Number(pedido.costoEnvio) || 0 },
      {
        etiqueta: 'Total',
        valor: Number(pedido.total) || 0,
        destacado: true
      }
    ],
    pago: {
      metodo: etiqueta,
      estado: String(pedido.pago?.estado || 'Sin pago registrado')
    },
    instrucciones: instruccionesPago(metodo),
    nota: 'Adjuntamos tu comprobante PDF. Conserva este correo.',
    urlAccion: rutaPedido,
    etiquetaAccion: 'Ver mi pedido'
  });
  return { texto, html };
}

export interface DatosCambioEnvioCorreo {
  nombreCliente: string;
  codigoRastreo: string;
  estadoAnterior: string;
  nuevoEstado: string;
  descripcion: string;
  fecha: string;
  enlace: string;
}

export function crearCorreoCambioEnvio(
  datos: DatosCambioEnvioCorreo
): CorreoGenerado {
  const nombre = String(datos.nombreCliente || 'cliente');
  const texto = [
    `Hola ${nombre},`,
    '',
    `Tu pedido ${datos.codigoRastreo} cambió de estado.`,
    `Estado anterior: ${datos.estadoAnterior}`,
    `Nuevo estado: ${datos.nuevoEstado}`,
    datos.descripcion,
    `Fecha y hora: ${datos.fecha}`,
    '',
    `Revisa el seguimiento en: ${datos.enlace}`,
    '',
    'NubaGlow'
  ].join('\n');
  const html = crearHtmlEditorial({
    nombre,
    titulo: `Tu pedido está en ${datos.nuevoEstado}`,
    subtitulo: 'Actualización del envío',
    codigo: datos.codigoRastreo,
    detalles: [
      { etiqueta: 'Estado anterior', valor: datos.estadoAnterior },
      { etiqueta: 'Nuevo estado', valor: datos.nuevoEstado },
      { etiqueta: 'Fecha y hora', valor: datos.fecha }
    ],
    nota: datos.descripcion,
    instrucciones:
      'Puedes revisar la línea de tiempo completa en la página del pedido.',
    urlAccion: datos.enlace,
    etiquetaAccion: 'Ver seguimiento'
  });
  return { texto, html };
}

export function crearCorreoReciboPos(venta: any): CorreoGenerado {
  const items = (Array.isArray(venta.items) ? venta.items : []).map(
    (item: any) => ({
      productoNombre: String(item.productoNombre || 'Producto'),
      varianteNombre: String(item.varianteNombre || ''),
      cantidad: Number(item.cantidad) || 0,
      precioUnitario: Number(item.precioUnitario) || 0,
      subtotal: Number(item.subtotal) || 0
    })
  );
  const total = Number(venta.total) || 0;
  const texto = [
    `Hola ${venta.clienteNombre || 'cliente'},`,
    '',
    'Gracias por tu compra en NubaGlow.',
    `Ticket: ${venta.numeroTicket}`,
    `Factura: ${venta.factura?.numeroFactura || 'Sin factura'}`,
    `Total: ${formatearBsNotificacion(total)}`,
    `Método de pago: ${venta.metodoPago}`,
    '',
    'Adjuntamos tu comprobante en PDF.',
    'Comprobante académico de simulación — Sin valor fiscal.'
  ].join('\n');
  const html = crearHtmlEditorial({
    nombre: String(venta.clienteNombre || 'cliente'),
    titulo: 'Comprobante de venta',
    subtitulo: 'Gracias por tu compra en mostrador.',
    codigoEtiqueta: 'Ticket POS',
    codigo: String(venta.numeroTicket || ''),
    items,
    totales: [
      { etiqueta: 'Subtotal', valor: Number(venta.subtotal) || 0 },
      { etiqueta: 'Recibido', valor: Number(venta.montoRecibido) || 0 },
      { etiqueta: 'Cambio', valor: Number(venta.cambio) || 0 },
      { etiqueta: 'Total', valor: total, destacado: true }
    ],
    detalles: [
      {
        etiqueta: 'Factura',
        valor: String(venta.factura?.numeroFactura || 'Sin factura')
      }
    ],
    pago: {
      metodo: String(venta.metodoPago || 'Sin método'),
      estado: 'Pagado'
    },
    nota: 'Adjuntamos tu comprobante PDF.',
    urlAccion: urlAplicacion(),
    etiquetaAccion: 'Visitar NubaGlow'
  });
  return { texto, html };
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
    '<b>NubaGlow</b> — nuevo pedido',
    `Código: <code>${escaparHtml(pedido.codigoRastreo)}</code>`,
    `<b>Total:</b> ${escaparHtml(formatearBsNotificacion(pedido.total))}`,
    `<b>Método de pago:</b> ${escaparHtml(etiqueta)}`,
    `<b>Ciudad:</b> ${escaparHtml(pedido.ciudad || 'Sin ciudad')}`,
    `<b>Estado del pago:</b> ${escaparHtml(
      pedido.pago?.estado || 'Sin pago registrado'
    )}`,
    '<i>Revisa el panel interno para preparar el pedido.</i>'
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

const PATRON_EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * Extrae unicamente el email de un remitente configurado como
 * `NubaGlow <correo@dominio.com>`, `"NubaGlow" <correo@dominio.com>` o
 * simplemente `correo@dominio.com`. Brevo exige `sender.email` limpio.
 */
export function extraerEmailRemitente(valor: string): string {
  const texto = String(valor || '').trim();
  const entreAngulos = texto.match(/<([^>]+)>/);
  const candidato = (entreAngulos ? entreAngulos[1] : texto).trim();
  return candidato.replace(/^["']+|["']+$/g, '').trim();
}

/**
 * Separa un remitente en nombre y email limpio. Si no hay nombre usa
 * `nombrePorDefecto` y valida el email para evitar el 400 de Brevo.
 */
export function parsearRemitente(
  from: string,
  nombrePorDefecto = 'NubaGlow'
): { name: string; email: string } {
  const texto = String(from || '').trim();
  const coincidencia = texto.match(/<([^>]+)>/);
  const email = extraerEmailRemitente(texto);
  const nombreCrudo = coincidencia
    ? texto.slice(0, coincidencia.index).trim()
    : '';
  const nombre =
    nombreCrudo.replace(/^["']+|["']+$/g, '').trim() || nombrePorDefecto;

  if (!PATRON_EMAIL.test(email)) {
    throw new Error(
      `Remitente de correo invalido: "${email || 'vacio'}". ` +
        'Configura SMTP_FROM o BREVO_FROM con un email valido.'
    );
  }

  return { name: nombre, email };
}

function crearErrorProveedorHttp(
  proveedor: string,
  status: number,
  cuerpo: string
): Error & { code?: string; response?: string } {
  const error = new Error(
    `${proveedor} respondio ${status}: ${cuerpo.slice(0, 500)}`
  ) as Error & { code?: string; response?: string };
  error.code = `${proveedor.toUpperCase()}_${status}`;
  error.response = cuerpo.slice(0, 2000);
  return error;
}

/**
 * Envio por SMTP con Nodemailer.
 * `localAddress: '0.0.0.0'` fuerza IPv4: Nodemailer solo intenta direcciones
 * de la misma familia que la direccion local, evitando timeouts IPv6 de Gmail
 * en Render. Tambien se declara family: 4 para clientes/versiones que lo usan.
 */
async function enviarCorreoPorSmtp(
  config: ConfiguracionSmtp,
  datos: DatosCorreo
): Promise<void> {
  const opciones: Record<string, unknown> = {
    host: config.host,
    port: config.port,
    // 465 usa TLS directo; 587 usa STARTTLS.
    secure: Number(config.port) === 465,
    auth: { user: config.user, pass: config.pass },
    family: 4,
    localAddress: '0.0.0.0',
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000
  };

  const transporte = nodemailer.createTransport(opciones as any);

  try {
    await transporte.sendMail({
      from: config.from,
      to: datos.destinatario,
      subject: datos.asunto,
      text: datos.cuerpo,
      html: datos.html,
      attachments: (datos.adjuntos || []).map((adjunto) => ({
        filename: adjunto.filename,
        content: adjunto.content,
        contentType: adjunto.contentType
      }))
    });
  } finally {
    try {
      transporte.close();
    } catch {
      // El cierre del transporte no debe ocultar el error real del envio.
    }
  }
}

/**
 * Envio por API HTTP (Resend o Brevo). No usa los puertos SMTP, por lo que
 * funciona en Render incluso cuando Gmail bloquea 465/587.
 */
async function enviarCorreoPorApiHttp(
  config: ConfiguracionCorreoHttp,
  datos: DatosCorreo
): Promise<void> {
  if (config.proveedor === 'resend') {
    const remitente = parsearRemitente(config.from);
        const cuerpo: Record<string, unknown> = {
      from: `${remitente.name} <${remitente.email}>`,
      to: [datos.destinatario],
      subject: datos.asunto,
      text: datos.cuerpo,
      html: datos.html || undefined
    };
    if (datos.adjuntos && datos.adjuntos.length > 0) {
      cuerpo.attachments = datos.adjuntos.map((adjunto) => ({
        filename: adjunto.filename,
        content: adjunto.content.toString('base64')
      }));
    }
    if (config.replyTo) cuerpo.reply_to = extraerEmailRemitente(config.replyTo);

    const respuesta = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS)
    });
    const texto = await respuesta.text().catch(() => '');
    if (!respuesta.ok) {
      const error = crearErrorProveedorHttp('Resend', respuesta.status, texto);
      throw error;
    }
    return;
  }

  const remitente = parsearRemitente(config.from, 'NubaGlow');
    const cuerpo: Record<string, unknown> = {
    sender: { name: remitente.name, email: remitente.email },
    to: [{ email: datos.destinatario }],
    subject: datos.asunto,
    textContent: datos.cuerpo,
    htmlContent: datos.html || undefined
  };
  if (datos.adjuntos && datos.adjuntos.length > 0) {
    cuerpo.attachment = datos.adjuntos.map((adjunto) => ({
      name: adjunto.filename,
      content: adjunto.content.toString('base64')
    }));
  }
  if (config.replyTo) {
    const respuesta = parsearRemitente(config.replyTo, remitente.name);
    cuerpo.replyTo = { name: respuesta.name, email: respuesta.email };
  }

  const respuesta = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'api-key': config.apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TIEMPO_ESPERA_MS)
  });
  const texto = await respuesta.text().catch(() => '');
  if (!respuesta.ok) {
    const error = crearErrorProveedorHttp('Brevo', respuesta.status, texto);
    throw error;
  }
}

const ETIQUETA_CANAL_CORREO: Record<string, string> = {
  smtp: 'SMTP',
  resend: 'Resend',
  brevo: 'Brevo'
};

interface CanalCorreo {
  proveedor: 'smtp' | 'resend' | 'brevo';
  enviar: (datos: DatosCorreo) => Promise<void>;
}

/**
 * Ordena los canales de correo. Brevo va primero porque su API HTTP responde
 * en cerca de 1 segundo y evita esperar el timeout de SMTP en Render.
 */
function crearCanalesCorreo(
  smtp: ConfiguracionSmtp | null,
  http: ConfiguracionCorreoHttp | null
): CanalCorreo[] {
  const canales: CanalCorreo[] = [];

  if (http && http.proveedor === 'brevo') {
    const config = http;
    canales.push({
      proveedor: 'brevo',
      enviar: (datos) => enviarCorreoPorApiHttp(config, datos)
    });
  }

  if (smtp) {
    const config = smtp;
    canales.push({
      proveedor: 'smtp',
      enviar: (datos) => enviarCorreoPorSmtp(config, datos)
    });
  }

  if (http && http.proveedor === 'resend') {
    const config = http;
    canales.push({
      proveedor: 'resend',
      enviar: (datos) => enviarCorreoPorApiHttp(config, datos)
    });
  }

  return canales;
}

export function crearEnviadorCorreo(): EnviadorCorreo | null {
  if (process.env.NODE_ENV === 'test') return null;

  const canales = crearCanalesCorreo(
    obtenerConfiguracionSmtp().config,
    obtenerConfiguracionCorreoHttp().config
  );
  if (canales.length === 0) return null;

  return async (datos: DatosCorreo) => {
    const errores: string[] = [];

    for (const canal of canales) {
      const nombre = ETIQUETA_CANAL_CORREO[canal.proveedor] || canal.proveedor;
      try {
        await canal.enviar(datos);
        return;
      } catch (error) {
        const detalle = detalleErrorEnvio(error);
        errores.push(`${nombre}: ${detalle.message}`);
        registrarFalloEnvio(nombre, error);
        if (canales.length > 1) {
          console.warn(
            `[NubaGlow][Correo] ${nombre} fallo; se intentara el siguiente canal...`
          );
        }
      }
    }

    throw new Error(
      errores.join(' | ') || 'No hay canal de correo configurado'
    );
  };
}

export function crearEnviadorTelegram(): EnviadorTelegram | null {
  if (process.env.NODE_ENV === 'test') return null;

  const config = obtenerConfiguracionTelegram().config;
  if (!config) return null;

  return async (datos: DatosTelegram, destinatario: string) => {
    let respuesta: Response;

    try {
      respuesta = await fetch(
        `https://api.telegram.org/bot${config.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: destinatario,
            text: datos.cuerpo,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          }),
          signal: AbortSignal.timeout(TIEMPO_ESPERA_MS)
        }
      );
    } catch (error) {
      registrarFalloEnvio('Telegram', error);
      throw error;
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      const error = new Error(
        `Telegram respondio ${respuesta.status}: ${detalle.slice(0, 300)}`
      ) as Error & { code?: string; response?: string };
      error.code = `TELEGRAM_${respuesta.status}`;
      error.response = detalle.slice(0, 1000);
      registrarFalloEnvio('Telegram', error);
      const pista = pistaTelegram(detalle);
      if (pista) console.error(`[NubaGlow][Telegram] ${pista}`);
      throw error;
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
      console.log('[NubaGlow][Correo] Omitido: SMTP no configurado.');
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

    console.log(
      `[NubaGlow][Correo] Enviando a ${datos.destinatario} ` +
        `(pedido #${datos.pedidoId ?? 'n/d'})...`
    );
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
      console.log(
        `[NubaGlow][Correo] Resultado: enviada -> ${datos.destinatario}.`
      );
      return {
        canal: 'correo',
        destinatario: datos.destinatario,
        estado: 'enviada',
        error: null
      };
    } catch (error) {
      const mensaje = mensajeError(error);
      console.error(
        `[NubaGlow][Correo] Fallo al enviar notificacion a ` +
          `${datos.destinatario}:`,
        mensaje
      );
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
    const config = obtenerConfiguracionTelegram().config;
    const destinatario =
      (datos.destinatario || '').trim() ||
      config?.chatId ||
      'sin configurar';
    const enviador = this.telegramFactory();

    if (!enviador) {
      const error = 'Telegram no configurado';
      console.log('[NubaGlow][Telegram] Omitido: Telegram no configurado.');
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

    console.log(
      `[NubaGlow][Telegram] Enviando alerta a ${destinatario} ` +
        `(pedido #${datos.pedidoId ?? 'n/d'})...`
    );
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
      console.log(
        `[NubaGlow][Telegram] Resultado: enviada -> ${destinatario}.`
      );
      return {
        canal: 'telegram',
        destinatario,
        estado: 'enviada',
        error: null
      };
    } catch (error) {
      const mensaje = mensajeError(error);
      console.error('[NubaGlow][Telegram] Fallo al enviar alerta:', mensaje);
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

  /**
   * Prueba REAL de envio por correo usando las variables actuales del entorno.
   * No registra en la tabla notificaciones: devuelve el detalle exacto de cada
   * intento (SMTP y respaldo HTTP) para diagnosticar en Render al instante.
   */
  async probarCorreo(destinatario: string): Promise<ResultadoPruebaCanal> {
    if (process.env.NODE_ENV === 'test') {
      return {
        canal: 'correo',
        exito: false,
        error: 'NODE_ENV=test: envios externos deshabilitados.'
      };
    }

    const smtp = obtenerConfiguracionSmtp();
    const http = obtenerConfiguracionCorreoHttp();
    const intentos: IntentoPruebaCanal[] = [];

    if (!smtp.config && !http.config) {
      return {
        canal: 'correo',
        exito: false,
        error:
          'Sin configuracion de correo. Faltan SMTP ' +
          `(${smtp.faltantes.join(', ') || 'revisar formato'}) y API HTTP ` +
          `(${http.faltantes.join(', ') || 'revisar formato'}).`,
        intentos
      };
    }

    const datos: DatosCorreo = {
      destinatario,
      asunto: 'NubaGlow: prueba de notificaciones',
      cuerpo:
        'Prueba real de correo desde NubaGlow. Si recibes este mensaje, ' +
        'el canal de correo esta operativo en produccion.',
      html:
        '<p><strong>NubaGlow</strong></p><p>Prueba real de correo desde ' +
        'el servidor de produccion. Si recibes este mensaje, el canal de ' +
        'correo esta operativo.</p>'
    };

    if (smtp.config) {
      console.log('[NubaGlow][Correo][Prueba] Intentando SMTP...');
      try {
        await enviarCorreoPorSmtp(smtp.config, datos);
        console.log('[NubaGlow][Correo][Prueba] SMTP OK.');
        return {
          canal: 'correo',
          exito: true,
          proveedor: 'smtp',
          destinatario,
          error: null,
          intentos: [
            ...intentos,
            {
              proveedor: 'smtp',
              exito: true,
              mensaje: null,
              codigo: null,
              respuesta: null
            }
          ]
        };
      } catch (error) {
        const detalle = detalleErrorEnvio(error);
        console.error('[NubaGlow][Correo][Prueba] SMTP fallo:', detalle);
        intentos.push({
          proveedor: 'smtp',
          exito: false,
          mensaje: detalle.message,
          codigo: detalle.code,
          respuesta: detalle.response
        });
      }
    }

    if (http.config) {
      console.log(
        `[NubaGlow][Correo][Prueba] Intentando ${http.config.proveedor}...`
      );
      try {
        await enviarCorreoPorApiHttp(http.config, datos);
        console.log(
          `[NubaGlow][Correo][Prueba] ${http.config.proveedor} OK.`
        );
        return {
          canal: 'correo',
          exito: true,
          proveedor: http.config.proveedor,
          destinatario,
          error: null,
          intentos: [
            ...intentos,
            {
              proveedor: http.config.proveedor,
              exito: true,
              mensaje: null,
              codigo: null,
              respuesta: null
            }
          ]
        };
      } catch (error) {
        const detalle = detalleErrorEnvio(error);
        console.error(
          `[NubaGlow][Correo][Prueba] ${http.config.proveedor} fallo:`,
          detalle
        );
        intentos.push({
          proveedor: http.config.proveedor,
          exito: false,
          mensaje: detalle.message,
          codigo: detalle.code,
          respuesta: detalle.response
        });
      }
    }

    return {
      canal: 'correo',
      exito: false,
      destinatario,
      error: intentos
        .map((intento) => `${intento.proveedor}: ${intento.mensaje}`)
        .join(' | '),
      intentos
    };
  }

  /**
   * Prueba REAL de Telegram usando las variables actuales. Devuelve el codigo
   * HTTP y el cuerpo exacto que respondio la API de Telegram.
   */
  async probarTelegram(chatId?: string): Promise<ResultadoPruebaCanal> {
    if (process.env.NODE_ENV === 'test') {
      return {
        canal: 'telegram',
        exito: false,
        error: 'NODE_ENV=test: envios externos deshabilitados.'
      };
    }

    const configuracion = obtenerConfiguracionTelegram();
    if (!configuracion.config) {
      return {
        canal: 'telegram',
        exito: false,
        error:
          'Telegram sin configurar. Variables faltantes: ' +
          configuracion.faltantes.join(', '),
        intentos: []
      };
    }

    const config = configuracion.config;
    const destino = (chatId || '').trim() || config.chatId;
    console.log(`[NubaGlow][Telegram][Prueba] Enviando a ${destino}...`);

    try {
      const respuesta = await fetch(
        `https://api.telegram.org/bot${config.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: destino,
            text:
              '<b>NubaGlow</b> — prueba de notificaciones desde produccion.\n' +
              'Si lees este mensaje, el canal de Telegram esta operativo.',
            parse_mode: 'HTML',
            disable_web_page_preview: true
          }),
          signal: AbortSignal.timeout(TIEMPO_ESPERA_MS)
        }
      );
      const texto = await respuesta.text().catch(() => '');
      let cuerpo: any = texto;
      try {
        cuerpo = JSON.parse(texto);
      } catch {
        // Mantener texto plano si Telegram no respondio JSON.
      }

      const descripcion =
        cuerpo && cuerpo.description ? String(cuerpo.description) : texto;

      if (!respuesta.ok || (cuerpo && cuerpo.ok === false)) {
        const pista = pistaTelegram(descripcion);
        console.error(
          `[NubaGlow][Telegram][Prueba] Fallo ${respuesta.status}:`,
          descripcion
        );
        if (pista) console.error(`[NubaGlow][Telegram][Prueba] ${pista}`);
        return {
          canal: 'telegram',
          exito: false,
          destinatario: destino,
          error: `Telegram respondio ${respuesta.status}: ${descripcion.slice(
            0,
            500
          )}`,
          detalles: {
            status: respuesta.status,
            respuesta: cuerpo,
            sugerencia: pista
          }
        };
      }

      console.log('[NubaGlow][Telegram][Prueba] OK.');
      return {
        canal: 'telegram',
        exito: true,
        destinatario: destino,
        error: null,
        detalles: {
          status: respuesta.status,
          messageId: cuerpo?.result?.message_id ?? null
        }
      };
    } catch (error) {
      const detalle = detalleErrorEnvio(error);
      console.error('[NubaGlow][Telegram][Prueba] Excepcion:', detalle);
      return {
        canal: 'telegram',
        exito: false,
        destinatario: destino,
        error: detalle.message,
        detalles: detalle
      };
    }
  }

  /**
   * Ejecuta una prueba real de ambos canales y devuelve el resultado exacto.
   */
  async probarNotificaciones(opciones: {
    correo?: string;
    chatId?: string;
  } = {}): Promise<ResultadoPruebaNotificaciones> {
    const destinatario =
      (opciones.correo || '').trim() ||
      leerVariable('NOTIFICACIONES_TEST_EMAIL') ||
      remitenteCorreo();

    console.log(
      '[NubaGlow][Notificaciones] Iniciando prueba real de correo y Telegram...'
    );

    const correo = destinatario
      ? await this.probarCorreo(destinatario)
      : {
          canal: 'correo' as const,
          exito: false,
          error:
            'No hay destinatario de correo. Envia `correo` en el body o ' +
            'configura NOTIFICACIONES_TEST_EMAIL / SMTP_FROM.',
          intentos: []
        };
    const telegram = await this.probarTelegram(opciones.chatId);

    console.log(
      '[NubaGlow][Notificaciones] Resultado prueba -> ' +
        `correo=${correo.exito ? 'ok' : 'fallo'}` +
        `${correo.error ? ` (${correo.error})` : ''}; ` +
        `telegram=${telegram.exito ? 'ok' : 'fallo'}` +
        `${telegram.error ? ` (${telegram.error})` : ''}.`
    );

    return { correo, telegram };
  }

  async notificarPedido(pedido: any): Promise<ResultadoNotificacionPedido> {
    const referencia = `Pedido #${pedido.id ?? 'n/d'} (${pedido.codigoRastreo})`;
    const asunto = `NubaGlow: pedido ${pedido.codigoRastreo} confirmado`;

    console.log(
      `[${referencia}] Disparando notificaciones (correo + Telegram)...`
    );

    const correoGenerado = crearCorreoConfirmacionPedido(pedido);
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

    // Se envian en secuencia para registrar antes y despues de cada canal.
    console.log(
      `[${referencia}] Correo -> ${pedido.correoCliente}: enviando...`
    );
    const correo = await this.enviarCorreo({
      pedidoId: pedido.id,
      destinatario: pedido.correoCliente,
      asunto,
      cuerpo: correoGenerado.texto,
      html: correoGenerado.html,
      adjuntos
    });
    console.log(
      `[${referencia}] Correo -> resultado: ${correo.estado}` +
        `${correo.error ? ` (${correo.error})` : ''}.`
    );

    console.log(`[${referencia}] Telegram -> enviando alerta...`);
    const telegram = await this.enviarTelegram({
      pedidoId: pedido.id,
      asunto,
      cuerpo: cuerpoTelegram
    });
    console.log(
      `[${referencia}] Telegram -> resultado: ${telegram.estado}` +
        `${telegram.error ? ` (${telegram.error})` : ''}.`
    );

    return { correo, telegram };
  }
}

export const notificacionesService = new NotificacionesService();
