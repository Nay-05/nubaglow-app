/**
 * ============================================================================
 * NUBAGLOW APP - CLIENTE DE API CON RENOVACION DE SESION
 * ============================================================================
 * - Todas las peticiones usan credentials: 'include' para enviar las cookies
 *   HttpOnly (access_token / refresh_token). El token JAMAS se guarda en JS.
 * - Si una peticion protegida responde 401, se intenta UNA sola renovacion con
 *   POST /api/auth/refresh y se repite la peticion original.
 * - Se excluyen del reintento los endpoints de autenticacion para no entrar en
 *   bucles ni ocultar credenciales invalidas.
 * - Las peticiones mutan con cookies y el middleware CSRF del backend valida
 *   Origin/Referer; el navegador los envia automaticamente en el mismo origen.
 */

const BASE_API = '/api';

const RUTAS_SIN_RENOVACION = new Set([
  '/auth/login',
  '/auth/staff-login',
  '/auth/register',
  '/auth/registro',
  '/auth/refresh',
  '/auth/logout',
  '/auth/sesion',
  '/auth/session'
]);

export class ErrorApi extends Error {
  constructor(mensaje, estado, datos) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.datos = datos;
  }
}

let refrescoEnCurso = null;
let alExpirarSesion = null;

export function definirManejadorSesionExpirada(manejador) {
  alExpirarSesion = typeof manejador === 'function' ? manejador : null;
}

async function interpretarRespuesta(respuesta) {
  const tipo = respuesta.headers.get('content-type') || '';
  if (!tipo.includes('application/json')) return null;
  try {
    return await respuesta.json();
  } catch {
    return null;
  }
}

async function enviarPeticion(ruta, { metodo = 'GET', cuerpo, senal } = {}) {
  const cabeceras = { Accept: 'application/json' };
  const configuracion = {
    method: metodo,
    credentials: 'include',
    headers: cabeceras
  };

  if (cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
    configuracion.body = JSON.stringify(cuerpo);
  }
  if (senal) configuracion.signal = senal;

  return fetch(`${BASE_API}${ruta}`, configuracion);
}

/**
 * Renueva el access token usando la cookie refresh_token.
 * Varias peticiones simultaneas comparten la misma promesa para no duplicar refresh.
 */
async function renovarSesion() {
  if (!refrescoEnCurso) {
    refrescoEnCurso = (async () => {
      try {
        const respuesta = await enviarPeticion('/auth/refresh', {
          metodo: 'POST',
          cuerpo: {}
        });
        if (!respuesta.ok) return false;
        const datos = await interpretarRespuesta(respuesta);
        return Boolean(datos && datos.exito);
      } catch {
        return false;
      } finally {
        refrescoEnCurso = null;
      }
    })();
  }
  return refrescoEnCurso;
}

export async function solicitar(ruta, opciones = {}) {
  let respuesta = await enviarPeticion(ruta, opciones);

  const puedeRenovar =
    respuesta.status === 401 &&
    !opciones.sinRenovacion &&
    !RUTAS_SIN_RENOVACION.has(ruta);

  if (puedeRenovar) {
    const renovada = await renovarSesion();
    if (renovada) {
      respuesta = await enviarPeticion(ruta, opciones);
    } else if (alExpirarSesion) {
      alExpirarSesion();
    }
  }

  const datos = await interpretarRespuesta(respuesta);

  if (!respuesta.ok || (datos && datos.exito === false)) {
    const mensaje =
      (datos && (datos.error || datos.mensaje)) ||
      `La solicitud fallo con estado ${respuesta.status}`;
    throw new ErrorApi(mensaje, respuesta.status, datos);
  }

  return datos;
}

export const api = {
  obtener: (ruta, opciones) => solicitar(ruta, { ...opciones, metodo: 'GET' }),
  crear: (ruta, cuerpo, opciones) => solicitar(ruta, { ...opciones, metodo: 'POST', cuerpo }),
  actualizar: (ruta, cuerpo, opciones) => solicitar(ruta, { ...opciones, metodo: 'PUT', cuerpo }),
  parchear: (ruta, cuerpo, opciones) => solicitar(ruta, { ...opciones, metodo: 'PATCH', cuerpo }),
  eliminar: (ruta, opciones) => solicitar(ruta, { ...opciones, metodo: 'DELETE' })
};
