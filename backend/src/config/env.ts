/**
 * ============================================================================
 * NUBAGLOW APP - LECTURA CENTRALIZADA DE VARIABLES DE ENTORNO
 * ============================================================================
 * Render puede conservar espacios o saltos de linea al copiar credenciales.
 * Por eso TODAS las variables sensibles se leen con .trim() antes de usarse.
 * Este modulo nunca imprime contrasenas ni tokens: solo nombres de variables
 * faltantes y datos no sensibles (host, puerto y modo seguro).
 */

import dotenv from 'dotenv';
import path from 'path';

// Cargar .env desde backend/ o desde la raiz del monorepo. Es idempotente.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

export const URL_PUBLICA_POR_DEFECTO = 'https://nubaglow-web.onrender.com';

export interface ConfiguracionSmtp {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface ConfiguracionTelegram {
  token: string;
  chatId: string;
}

/**
 * Canal de correo por API HTTP. Se usa como respaldo cuando Render bloquea
 * los puertos SMTP (465/587) o cuando solo se configura la API key.
 */
export interface ConfiguracionCorreoHttp {
  proveedor: 'resend' | 'brevo';
  apiKey: string;
  from: string;
  replyTo: string | null;
  apiUrl: string;
}

export interface DiagnosticoSecreto {
  presente: boolean;
  longitud: number;
  ultimos4: string | null;
}

export interface DiagnosticoSmtp {
  activo: boolean;
  faltantes: string[];
  host: string | null;
  port: number | null;
  secure: boolean;
  usuario: DiagnosticoSecreto;
  remitente: string | null;
}

export interface DiagnosticoCorreoHttp {
  activo: boolean;
  proveedor: string | null;
  faltantes: string[];
  remitente: string | null;
  apiKey: DiagnosticoSecreto;
}

export interface DiagnosticoTelegram {
  activo: boolean;
  faltantes: string[];
  chatConfigurado: boolean;
  token: DiagnosticoSecreto;
  chatId: DiagnosticoSecreto;
}

export interface DiagnosticoNotificaciones {
  nodeEnv: string;
  smtp: DiagnosticoSmtp;
  correoHttp: DiagnosticoCorreoHttp;
  telegram: DiagnosticoTelegram;
}

/**
 * Lee una variable de entorno y elimina espacios/saltos de linea invisibles.
 */
export function leerVariable(nombre: string): string {
  return (process.env[nombre] ?? '').trim();
}

export function entornoActual(): string {
  return leerVariable('NODE_ENV') || 'development';
}

/**
 * URL publica del sistema. Prioriza APP_URL y luego FRONTEND_URL.
 * En produccion cae a nubaglow-web.onrender.com, nunca a localhost.
 */
function normalizarUrlPublica(url: string): string {
  // Corrige valores antiguos copiados en Render sin tocar otros dominios.
  return url.replace(
    /nubaglow-app\.onrender\.com/gi,
    'nubaglow-web.onrender.com'
  );
}

export function urlAplicacion(): string {
  const appUrl = leerVariable('APP_URL');
  const frontendUrl = leerVariable('FRONTEND_URL');
  const base =
    appUrl ||
    frontendUrl ||
    (entornoActual() === 'production'
      ? URL_PUBLICA_POR_DEFECTO
      : 'http://localhost:4000');

  return normalizarUrlPublica(base).replace(/\/+$/, '');
}

export function obtenerConfiguracionSmtp(): {
  config: ConfiguracionSmtp | null;
  faltantes: string[];
} {
  const host = leerVariable('SMTP_HOST');
  const portTexto = leerVariable('SMTP_PORT');
  const port = Number(portTexto);
  const user = leerVariable('SMTP_USER');
  const pass = leerVariable('SMTP_PASS');
  const from = leerVariable('SMTP_FROM');

  const faltantes: string[] = [];
  if (!host) faltantes.push('SMTP_HOST');
  if (!portTexto || !Number.isInteger(port) || port <= 0 || port > 65535) {
    faltantes.push('SMTP_PORT');
  }
  if (!user) faltantes.push('SMTP_USER');
  if (!pass) faltantes.push('SMTP_PASS');
  if (!from) faltantes.push('SMTP_FROM');

  if (faltantes.length > 0) {
    return { config: null, faltantes };
  }

  return {
    config: {
      host,
      port,
      secure: port === 465,
      user,
      pass,
      from
    },
    faltantes: []
  };
}

export function obtenerConfiguracionTelegram(): {
  config: ConfiguracionTelegram | null;
  faltantes: string[];
} {
  const token = leerVariable('TELEGRAM_BOT_TOKEN');
  const chatId = leerVariable('TELEGRAM_CHAT_ID');
  const faltantes: string[] = [];

  if (!token) faltantes.push('TELEGRAM_BOT_TOKEN');
  if (!chatId) faltantes.push('TELEGRAM_CHAT_ID');

  if (faltantes.length > 0) {
    return { config: null, faltantes };
  }

  return { config: { token, chatId }, faltantes: [] };
}

/**
 * Describe un secreto sin exponerlo: solo indica si existe, su longitud y
 * los ultimos 4 caracteres (suficientes para comparar en Render).
 */
export function describirSecreto(valor: string): DiagnosticoSecreto {
  const limpio = String(valor ?? '').trim();
  return {
    presente: limpio.length > 0,
    longitud: limpio.length,
    ultimos4: limpio.length >= 4 ? limpio.slice(-4) : null
  };
}

/**
 * Remitente usado por cualquier canal de correo (SMTP o API HTTP).
 */
export function remitenteCorreo(): string {
  return (
    leerVariable('SMTP_FROM') ||
    leerVariable('RESEND_FROM') ||
    leerVariable('BREVO_FROM') ||
    leerVariable('EMAIL_FROM')
  );
}

/**
 * Configuracion del correo por API HTTP.
 * Prioridad: Resend si existe RESEND_API_KEY; si no, Brevo con BREVO_API_KEY.
 */
export function obtenerConfiguracionCorreoHttp(): {
  config: ConfiguracionCorreoHttp | null;
  faltantes: string[];
} {
  const resendKey = leerVariable('RESEND_API_KEY');
  const brevoKey = leerVariable('BREVO_API_KEY');
  const from = remitenteCorreo();
  const replyTo = leerVariable('EMAIL_REPLY_TO') || null;

  if (!resendKey && !brevoKey) {
    return {
      config: null,
      faltantes: ['RESEND_API_KEY o BREVO_API_KEY']
    };
  }

  const faltantes: string[] = [];
  if (!from) {
    faltantes.push('SMTP_FROM o RESEND_FROM/BREVO_FROM');
  }

  const proveedor: 'resend' | 'brevo' = resendKey ? 'resend' : 'brevo';
  const apiKey = resendKey || brevoKey;
  const apiUrl =
    (proveedor === 'resend'
      ? leerVariable('RESEND_API_URL')
      : leerVariable('BREVO_API_URL')) ||
    (proveedor === 'resend'
      ? 'https://api.resend.com/emails'
      : 'https://api.brevo.com/v3/smtp/email');

  if (faltantes.length > 0) {
    return { config: null, faltantes };
  }

  return {
    config: { proveedor, apiKey, from, replyTo, apiUrl },
    faltantes: []
  };
}

export function diagnosticoNotificaciones(): DiagnosticoNotificaciones {
  const smtp = obtenerConfiguracionSmtp();
  const correoHttp = obtenerConfiguracionCorreoHttp();
  const telegram = obtenerConfiguracionTelegram();

  return {
    nodeEnv: entornoActual(),
    smtp: {
      activo: Boolean(smtp.config),
      faltantes: smtp.faltantes,
      host: smtp.config?.host || null,
      port: smtp.config?.port || null,
      secure: smtp.config?.secure || false,
      usuario: describirSecreto(leerVariable('SMTP_USER')),
      remitente: remitenteCorreo() || null
    },
    correoHttp: {
      activo: Boolean(correoHttp.config),
      proveedor: correoHttp.config?.proveedor || null,
      faltantes: correoHttp.faltantes,
      remitente: correoHttp.config?.from || remitenteCorreo() || null,
      apiKey: describirSecreto(
        leerVariable('RESEND_API_KEY') || leerVariable('BREVO_API_KEY')
      )
    },
    telegram: {
      activo: Boolean(telegram.config),
      faltantes: telegram.faltantes,
      chatConfigurado: Boolean(telegram.config?.chatId),
      token: describirSecreto(leerVariable('TELEGRAM_BOT_TOKEN')),
      chatId: describirSecreto(leerVariable('TELEGRAM_CHAT_ID'))
    }
  };
}

/**
 * Anuncia, al iniciar el servidor, si los canales quedaron operativos y que
 * variable exacta falta. Nunca muestra secretos completos.
 */
export function registrarDiagnosticoNotificaciones(): void {
  const estado = diagnosticoNotificaciones();
  const prefijo = '[NubaGlow][Notificaciones]';
  const describir = (valor: DiagnosticoSecreto) =>
    valor.presente
      ? `presente (longitud=${valor.longitud}, ultimos4=${valor.ultimos4 ?? '****'})`
      : 'ausente';

  console.log('============================================================');
  console.log(`${prefijo} Diagnostico de canales al iniciar el servidor`);
  console.log(`${prefijo} Entorno: ${estado.nodeEnv}`);

  // Telegram
  if (estado.telegram.activo) {
    console.log(
      `${prefijo} Telegram: ACTIVO -> chat configurado: ` +
        `${estado.telegram.chatConfigurado ? 'si' : 'no'}.`
    );
  } else {
    console.log(
      `${prefijo} Telegram: INACTIVO. Variables faltantes: ` +
        `${estado.telegram.faltantes.join(', ') || 'ninguna'}.`
    );
  }
  console.log(
    `${prefijo}   TELEGRAM_BOT_TOKEN: ${describir(estado.telegram.token)}`
  );
  console.log(
    `${prefijo}   TELEGRAM_CHAT_ID: ${describir(estado.telegram.chatId)}`
  );

  // SMTP
  if (estado.smtp.activo) {
    console.log(
      `${prefijo} Correo SMTP: ACTIVO -> ${estado.smtp.host}:${estado.smtp.port} ` +
        `(secure=${estado.smtp.secure}, usuario=${estado.smtp.usuario.ultimos4 ?? '****'}).`
    );
  } else {
    console.log(
      `${prefijo} Correo SMTP: INACTIVO. Variables faltantes: ` +
        `${estado.smtp.faltantes.join(', ') || 'ninguna (revisar formato)'}.`
    );
  }

  // API HTTP de correo (Resend / Brevo)
  if (estado.correoHttp.activo) {
    console.log(
      `${prefijo} Correo HTTP: ACTIVO -> proveedor=${estado.correoHttp.proveedor}, ` +
        `remitente=${estado.correoHttp.remitente ?? 'sin remitente'}, ` +
        `apiKey=${estado.correoHttp.apiKey.ultimos4 ?? '****'}.`
    );
  } else {
    console.log(
      `${prefijo} Correo HTTP: INACTIVO. Variables faltantes: ` +
        `${estado.correoHttp.faltantes.join(', ') || 'ninguna'}.`
    );
  }

  console.log(
    `${prefijo} Prueba real: POST /api/salud/probar-notificaciones`
  );
  console.log('============================================================');
}
