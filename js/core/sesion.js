/**
 * ============================================================================
 * NUBAGLOW APP - ESTADO DE SESION DEL FRONTEND
 * ============================================================================
 * La sesion real vive en cookies HttpOnly emitidas por el backend. Este modulo
 * solo mantiene en memoria el perfil publico (id, nombre, email, rol) para
 * pintar la interfaz; nunca guarda tokens ni contrasenas en localStorage.
 */

import { api, definirManejadorSesionExpirada } from './api.js';
import { rutaInicioPorRol } from './permisos.js';

let usuarioActual = null;
const suscriptores = new Set();

export const EVENTO_SESION_EXPIRADA = 'nubaglow:sesion-expirada';

function notificar() {
  for (const suscriptor of suscriptores) {
    try {
      suscriptor(usuarioActual);
    } catch (error) {
      console.error('Suscriptor de sesión falló:', error);
    }
  }
}

export function suscribirSesion(suscriptor) {
  suscriptores.add(suscriptor);
  return () => suscriptores.delete(suscriptor);
}

export function obtenerUsuario() {
  return usuarioActual;
}

export function sesionActiva() {
  return Boolean(usuarioActual);
}

export function esStaff() {
  return Boolean(usuarioActual && usuarioActual.rol !== 'cliente');
}

definirManejadorSesionExpirada(() => {
  usuarioActual = null;
  notificar();
  window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
});

export async function cargarPerfil() {
  try {
    // /auth/sesion responde siempre 200 (usuario null si no hay sesion), asi
    // el arranque no dispara refresh ni ensucia la consola con 401.
    const respuesta = await api.obtener('/auth/sesion', { sinRenovacion: true });
    usuarioActual = respuesta.datos.usuario || null;
  } catch {
    usuarioActual = null;
  }
  notificar();
  return usuarioActual;
}

export async function iniciarSesionCliente(email, password) {
  const respuesta = await api.crear(
    '/auth/login',
    { email, password },
    { sinRenovacion: true }
  );
  usuarioActual = respuesta.datos.usuario;
  notificar();
  return usuarioActual;
}


export async function registrarCliente(datos) {
  const respuesta = await api.crear(
    '/auth/register',
    datos,
    { sinRenovacion: true }
  );
  usuarioActual = respuesta.datos.usuario;
  notificar();
  return usuarioActual;
}

export async function iniciarSesionStaff(email, password) {
  const respuesta = await api.crear(
    '/auth/staff-login',
    { email, password },
    { sinRenovacion: true }
  );
  usuarioActual = respuesta.datos.usuario;
  notificar();
  return usuarioActual;
}

export async function cerrarSesion() {
  try {
    await api.crear('/auth/logout', undefined, { sinRenovacion: true });
  } finally {
    usuarioActual = null;
    notificar();
  }
}

export function destinoTrasLoginCliente(usuario) {
  if (!usuario) return '/login';
  if (usuario.rol !== 'cliente') return rutaInicioPorRol(usuario.rol);
  return '/cuenta';
}
