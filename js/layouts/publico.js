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
  { ruta: '/catalogo', etiqueta: 'Catálogo', icono: 'catalogo' },
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
    { clase: 'nav-publica', atributos: { 'aria-label': 'Navegación principal' } },
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

  const enlacesTienda = el(
    'ul',
    { clase: 'pie-lista' },
    ...ENLACES_PUBLICOS.map((enlace) =>
      el(
        'li',
        {},
        el('a', {
          clase: 'pie-enlace',
          href: enlace.ruta,
          atributos: { 'data-ruta': '' },
          texto: enlace.etiqueta
        })
      )
    )
  );

  const pie = el(
    'footer',
    { clase: 'pie' },
    el(
      'div',
      { clase: 'pie-columnas' },
      el(
        'section',
        { clase: 'pie-columna pie-columna-marca' },
        el(
          'a',
          {
            clase: 'pie-marca',
            href: '/',
            atributos: { 'data-ruta': '', 'aria-label': 'Nuba Beauty, ir al inicio' }
          },
          el('img', {
            clase: 'pie-logo',
            src: '/assets/brand/logo-nubaglow.png',
            alt: 'Nuba Beauty'
          }),
          el('span', { clase: 'pie-marca-texto', texto: 'Nuba Beauty' })
        ),
        el('p', {
          clase: 'pie-texto',
          texto: 'Skincare y maquillaje seleccionados con criterio profesional en Sucre, Bolivia.'
        })
      ),
      el(
        'nav',
        { clase: 'pie-columna', atributos: { 'aria-label': 'Enlaces de la tienda' } },
        el('h2', { clase: 'pie-titulo', texto: 'Tienda' }),
        enlacesTienda
      ),
      el(
        'section',
        { clase: 'pie-columna' },
        el('h2', { clase: 'pie-titulo', texto: 'Contacto' }),
        el('p', {
          clase: 'pie-texto',
          texto: 'Atención por WhatsApp para consultas y coordinación de entregas.'
        }),
        el('a', {
          clase: 'pie-enlace',
          href: '/pedidos',
          atributos: { 'data-ruta': '' },
          texto: 'Rastrear un pedido'
        })
      ),
      el(
        'section',
        { clase: 'pie-columna' },
        el('h2', { clase: 'pie-titulo', texto: 'Proyecto académico' }),
        el('p', { clase: 'pie-texto', texto: 'Ingeniería de Software · Grupo 11' }),
        el('p', {
          clase: 'pie-texto',
          texto: 'Comprobantes y pagos son simulaciones con fines académicos, sin valor fiscal.'
        })
      )
    ),
    el('p', {
      clase: 'pie-nota',
      texto: 'Nuba Beauty · Sucre, Bolivia. Proyecto académico de Ingeniería de Software.'
    })
  );

  raiz.append(encabezado, contenido, pie);
  return { raiz, contenido };
}
