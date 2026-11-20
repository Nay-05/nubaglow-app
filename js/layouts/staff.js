/**
 * ============================================================================
 * NUBAGLOW APP - LAYOUT INTERNO DEL PORTAL DE STAFF
 * ============================================================================
 * Dashboard con sidebar lateral (CLAUDE.md Seccion 3). Solo muestra los
 * modulos permitidos para el rol de la sesion. Ocultar un modulo aqui es UX:
 * el backend vuelve a validar el rol en cada endpoint.
 */

import { el, icono } from '../core/dom.js';
import { modulosPermitidos, ETIQUETA_ROL, rutaInicioPorRol } from '../core/permisos.js';
import { cerrarSesion } from '../core/sesion.js';

function esActiva(rutaActual, rutaModulo) {
  return rutaActual === rutaModulo || rutaActual.startsWith(`${rutaModulo}/`);
}

export function crearLayoutStaff({ usuario, ruta, router }) {
  const rol = usuario ? usuario.rol : 'cliente';
  const modulos = modulosPermitidos(rol);
  const raiz = el('div', { clase: 'layout-staff' });

  const marca = el(
    'a',
    {
      clase: 'sidebar-marca',
      href: rutaInicioPorRol(rol),
      atributos: { 'data-ruta': '' }
    },
    el('img', {
      clase: 'sidebar-logo',
      src: '/assets/brand/logo-nubaglow.png',
      alt: 'NubaGlow'
    }),
    el(
      'span',
      { clase: 'sidebar-marca-texto' },
      el('strong', { texto: 'NubaGlow' }),
      el('small', { texto: 'Portal interno' })
    )
  );

  const enlaces = modulos.map((modulo) => {
    const activo = esActiva(ruta, modulo.ruta);
    return el(
      'a',
      {
        clase: `sidebar-enlace${activo ? ' activo' : ''}`,
        href: modulo.ruta,
        atributos: {
          'data-ruta': '',
          ...(activo ? { 'aria-current': 'page' } : {})
        }
      },
      icono(modulo.icono, 18),
      el(
        'span',
        { clase: 'sidebar-enlace-texto' },
        el('span', { clase: 'sidebar-enlace-titulo', texto: modulo.etiqueta }),
        el('span', { clase: 'sidebar-enlace-descripcion', texto: modulo.descripcion })
      )
    );
  });

  const navegacion = el(
    'nav',
    { clase: 'sidebar-nav', atributos: { 'aria-label': 'Módulos del portal interno' } },
    ...enlaces
  );

  const botonSalir = el(
    'button',
    {
      clase: 'btn btn-outline sidebar-salir',
      atributos: { type: 'button' },
      on: {
        click: async () => {
          botonSalir.disabled = true;
          try {
            await cerrarSesion();
          } finally {
            router.navegar('/staff/login', { reemplazar: true });
          }
        }
      }
    },
    icono('salir', 16),
    el('span', { texto: 'Cerrar sesión' })
  );

  const usuarioInfo = el(
    'div',
    { clase: 'sidebar-usuario' },
    el('span', { clase: 'sidebar-usuario-nombre', texto: usuario?.nombre || 'Sesión' }),
    el('span', { clase: 'sidebar-usuario-rol', texto: ETIQUETA_ROL[rol] || rol })
  );

  const sidebar = el(
    'aside',
    { clase: 'sidebar-staff', atributos: { id: 'sidebar-staff' } },
    marca,
    navegacion,
    el('div', { clase: 'sidebar-pie' }, usuarioInfo, botonSalir)
  );

  const botonMenu = el(
    'button',
    {
      clase: 'btn-icono boton-menu',
      atributos: { type: 'button', 'aria-label': 'Abrir o cerrar menú' },
      on: {
        click: () => raiz.classList.toggle('sidebar-visible')
      }
    },
    icono('menu', 20)
  );

  const moduloActual = modulos.find((modulo) => esActiva(ruta, modulo.ruta));

  const encabezado = el(
    'header',
    { clase: 'staff-encabezado' },
    botonMenu,
    el(
      'div',
      { clase: 'staff-encabezado-texto' },
      el('h1', {
        clase: 'staff-titulo',
        texto: moduloActual?.etiqueta || 'Portal interno'
      }),
      el('p', {
        clase: 'staff-subtitulo',
        texto: moduloActual?.descripcion || 'Panel de gestión interna'
      }),
      el('span', {
        clase: 'staff-rol',
        texto:
          `Sesión: ${usuario?.nombre || 'Sin nombre'} ` +
          `(${ETIQUETA_ROL[rol] || rol})`
      })
    )
  );

  const contenido = el('main', { clase: 'staff-contenido', atributos: { id: 'contenido' } });
  const panel = el('div', { clase: 'staff-panel' }, encabezado, contenido);

  const velo = el('div', {
    clase: 'sidebar-velo',
    atributos: { 'aria-hidden': 'true' },
    on: { click: () => raiz.classList.remove('sidebar-visible') }
  });

  raiz.append(sidebar, panel, velo);
  return { raiz, contenido };
}
