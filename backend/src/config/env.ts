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

export interface DiagnosticoSmtp {
  activo: boolean;
  faltantes: string[];
  host: string | null;
  port: number | null;
  secure: boolean;
}

export interface DiagnosticoTelegram {
  activo: boolean;
  faltantes: string[];
  chatConfigurado: boolean;
}

export interface DiagnosticoNotificaciones {
  nodeEnv: string;
  smtp: DiagnosticoSmtp;
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

export function diagnosticoNotificaciones(): DiagnosticoNotificaciones {
  const smtp = obtenerConfiguracionSmtp();
  const telegram = obtenerConfiguracionTelegram();

  return {
    nodeEnv: entornoActual(),
    smtp: {
      activo: Boolean(smtp.config),
      faltantes: smtp.faltantes,
      host: smtp.config?.host || null,
      port: smtp.config?.port || null,
      secure: smtp.config?.secure || false
    },
    telegram: {
      activo: Boolean(telegram.config),
      faltantes: telegram.faltantes,
      chatConfigurado: Boolean(telegram.config?.chatId)
    }
  };
}

/**
 * Anuncia una sola vez, al iniciar el servidor, si los canales quedaron
 * operativos y que variable exacta falta. Nunca muestra secretos.
 */
export function registrarDiagnosticoNotificaciones(): void {
  const estado = diagnosticoNotificaciones();
  const prefijo = '[NubaGlow][Notificaciones]';

  if (estado.nodeEnv === 'test') {
    console.log(`${prefijo} NODE_ENV=test: envios externos deshabilitados.`);
  }

  if (estado.smtp.activo) {
    console.log(
      `${prefijo} SMTP ACTIVO -> ${estado.smtp.host}:${estado.smtp.port} ` +
        `(secure=${estado.smtp.secure}).`
    );
  } else {
    console.log(
      `${prefijo} SMTP INACTIVO. Variables faltantes: ` +
        `${estado.smtp.faltantes.join(', ') || 'ninguna (revisar formato)'}.`
    );
  }

  if (estado.telegram.activo) {
    console.log(
      `${prefijo} Telegram ACTIVO -> chat configurado: ` +
        `${estado.telegram.chatConfigurado ? 'si' : 'no'}.`
    );
  } else {
    console.log(
      `${prefijo} Telegram INACTIVO. Variables faltantes: ` +
        `${estado.telegram.faltantes.join(', ') || 'ninguna'}.`
    );
  }
}
