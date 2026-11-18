/**
 * ============================================================================
 * NUBAGLOW APP - LAYOUT PUBLICO (TIENDA)
 * ============================================================================
 * Navbar minimalista definido en CLAUDE.md Seccion 6: Inicio, Catalogo,
 * Pedidos, Carrito y Cuenta. Nunca muestra enlaces al portal interno.
 */

import { el, icono } from '../core/dom.js';

const ENLACES_PUBLICOS = [
  { ruta: '/', etiqueta: 'Inicio', icono: 'inicio' },
  { ruta: '/catalogo', etiqueta: 'Catalogo', icono: 'catalogo' },
  { ruta: '/pedidos', etiqueta: 'Pedidos', icono: 'pedido' },
  { ruta: '/carrito', etiqueta: 'Carrito', icono: 'carrito' },
  { ruta: '/cuenta', etiqueta: 'Cuenta', icono: 'cuenta' }
];

function esActiva(rutaActual, rutaEnlace) {
  if (rutaEnlace === '/') return rutaActual === '/';
  return rutaActual === rutaEnlace || rutaActual.startsWith(`${rutaEnlace}/`);
}

export function crearLayoutPublico({ ruta }) {
  const raiz = el('div', { clase: 'app-publico' });

  const marca = el(
    'a',
    {
      clase: 'marca',
      href: '/',
      atributos: { 'data-ruta': '', 'aria-label': 'NubaGlow, ir al inicio' }
    },
    el('img', {
      clase: 'marca-imagen',
      src: '/assets/brand/logo-nubaglow.png',
      alt: 'NubaGlow'
    }),
    el('span', { clase: 'marca-texto', texto: 'NubaGlow' })
  );

  const navegacion = el(
    'nav',
    { clase: 'nav-publica', atributos: { 'aria-label': 'Navegacion principal' } },
    ...ENLACES_PUBLICOS.map((enlace) => {
      const activo = esActiva(ruta, enlace.ruta);
      return el(
        'a',
        {
          clase: `nav-enlace${activo ? ' activo' : ''}`,
          href: enlace.ruta,
          atributos: {
            'data-ruta': '',
            ...(activo ? { 'aria-current': 'page' } : {})
          }
        },
        icono(enlace.icono, 16),
        el('span', { texto: enlace.etiqueta })
      );
    })
  );

  const encabezado = el('header', { clase: 'barra-superior' }, marca, navegacion);
  const contenido = el('main', { clase: 'contenido-publico', atributos: { id: 'contenido' } });

  const pie = el(
    'footer',
    { clase: 'pie' },
    el('p', {
      texto: 'Nuba Beauty - Sucre, Bolivia. Proyecto academico de Ingenieria de Software.'
    }),
    el('p', {
      clase: 'pie-nota',
      texto: 'Comprobantes y pagos son simulaciones con fines academicos.'
    })
  );

  raiz.append(encabezado, contenido, pie);
  return { raiz, contenido };
}
