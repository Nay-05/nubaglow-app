/**
 * ============================================================================
 * NUBAGLOW APP - LAYOUT PUBLICO (TIENDA)
 * ============================================================================
 * Cabecera editorial con banda de anuncios cerrable, menu Tienda alimentado
 * por /api/categorias, buscador, contador de carrito y menu movil. El pie se
 * organiza en columnas (Tienda, NubaGlow y Atencion) sin enlaces al portal
 * interno ni redes sociales ficticias. Todo el DOM se crea con helpers seguros.
 */

import { el, icono } from '../core/dom.js';
import { solicitar } from '../core/api.js';
import { CLAVE_CARRITO_VISITANTE } from '../core/carritoVisitante.js';
import { EVENTO_CARRITO, cargarCarrito } from '../core/carrito.js';
import { crearMiniCarrito } from './miniCarrito.js';

const CLAVE_ANUNCIO_CERRADO = 'nubaglow:anuncio-cerrado';
const SIMBOLO_CONTROLADOR = Symbol.for('nubaglow.layout.contadorCarrito');

const ENLACES_PUBLICOS = [
  { ruta: '/catalogo', etiqueta: 'Catálogo' },
  { ruta: '/pedidos', etiqueta: 'Pedidos' },
  { ruta: '/cuenta', etiqueta: 'Cuenta' }
];

function esActiva(rutaActual, rutaEnlace) {
  if (rutaEnlace === '/') return rutaActual === '/';
  return rutaActual === rutaEnlace || rutaActual.startsWith(`${rutaEnlace}/`);
}

function anuncioCerrado() {
  try {
    return window.localStorage.getItem(CLAVE_ANUNCIO_CERRADO) === '1';
  } catch {
    return false;
  }
}

function recordarCierreAnuncio() {
  try {
    window.localStorage.setItem(CLAVE_ANUNCIO_CERRADO, '1');
  } catch {
    /* localStorage puede estar deshabilitado: el anuncio se oculta igual. */
  }
}

function crearBandaAnuncio() {
  if (anuncioCerrado()) return null;

  const barra = el(
    'div',
    {
      clase: 'anuncio-barra',
      atributos: { role: 'region', 'aria-label': 'Anuncio de la tienda' }
    },
    el('p', {
      clase: 'anuncio-texto',
      texto: 'Pago contra entrega en Sucre. Coordinamos la entrega al confirmar tu pedido.'
    }),
    el(
      'button',
      {
        clase: 'anuncio-cerrar',
        atributos: { type: 'button', 'aria-label': 'Cerrar anuncio' },
        on: {
          click: () => {
            recordarCierreAnuncio();
            barra.hidden = true;
          }
        }
      },
      icono('cerrar', 16)
    )
  );

  return barra;
}

function crearMarca() {
  return el(
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
}

function crearEnlaceCategoria(categoria, clase) {
  const slug = String(categoria.slug || '');
  return el('a', {
    clase,
    href: `/catalogo?categoria=${encodeURIComponent(slug)}`,
    atributos: { 'data-ruta': '' },
    texto: categoria.nombre || 'Categoría'
  });
}

function crearMenuTienda() {
  const panel = el('div', {
    clase: 'desplegable-panel',
    atributos: { id: 'menu-tienda', 'aria-label': 'Categorías de la tienda' }
  });
  const cargando = el('p', {
    clase: 'desplegable-vacio',
    texto: 'Cargando categorías...'
  });
  panel.appendChild(cargando);
  panel.hidden = true;

  const boton = el(
    'button',
    {
      clase: 'cabecera-enlace cabecera-desplegable',
      atributos: {
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': 'menu-tienda'
      }
    },
    el('span', { texto: 'Tienda' }),
    icono('chevronAbajo', 14)
  );

  const contenedor = el('div', { clase: 'cabecera-menu-tienda' }, boton, panel);

  const cerrar = () => {
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
  };

  boton.addEventListener('click', () => {
    const abrir = panel.hidden;
    panel.hidden = !abrir;
    boton.setAttribute('aria-expanded', String(abrir));
  });

  contenedor.addEventListener('focusout', (evento) => {
    if (!contenedor.contains(evento.relatedTarget)) cerrar();
  });

  contenedor.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    cerrar();
    boton.focus();
  });

  return { contenedor, panel };
}

function crearAcciones(usuario, router) {
  const entradaBusqueda = el('input', {
    clase: 'entrada buscador-cabecera-entrada',
    id: 'buscador-cabecera-campo',
    type: 'search',
    name: 'buscar',
    placeholder: 'Buscar productos',
    atributos: { autocomplete: 'off' }
  });

  const formulario = el('form', {
    clase: 'buscador-cabecera',
    atributos: { id: 'buscador-cabecera', role: 'search' }
  });
  formulario.hidden = true;

  const cerrarBusqueda = () => {
    formulario.hidden = true;
    botonBuscar.setAttribute('aria-expanded', 'false');
  };

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const termino = entradaBusqueda.value.trim();
    const destino = termino ? `/catalogo?buscar=${encodeURIComponent(termino)}` : '/catalogo';
    cerrarBusqueda();
    if (router && typeof router.navegar === 'function') {
      router.navegar(destino);
    } else {
      window.location.assign(destino);
    }
  });

  formulario.append(
    el('label', {
      clase: 'solo-lectores',
      atributos: { for: 'buscador-cabecera-campo' },
      texto: 'Buscar productos'
    }),
    entradaBusqueda,
    el(
      'button',
      {
        clase: 'cabecera-accion buscador-enviar',
        atributos: { type: 'submit', 'aria-label': 'Buscar productos' }
      },
      icono('buscar', 16)
    )
  );

  entradaBusqueda.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      cerrarBusqueda();
      botonBuscar.focus();
    }
  });

  const botonBuscar = el(
    'button',
    {
      clase: 'cabecera-accion',
      atributos: {
        type: 'button',
        'aria-label': 'Abrir búsqueda',
        'aria-expanded': 'false',
        'aria-controls': 'buscador-cabecera'
      }
    },
    icono('buscar', 18)
  );

  botonBuscar.addEventListener('click', () => {
    const abrir = formulario.hidden;
    formulario.hidden = !abrir;
    botonBuscar.setAttribute('aria-expanded', String(abrir));
    if (abrir) entradaBusqueda.focus();
  });

  const contador = el('span', {
    clase: 'badge-carrito',
    atributos: { 'aria-hidden': 'true' }
  });
  contador.hidden = true;

  const enlaceCarrito = el(
    'button',
    {
      clase: 'cabecera-accion carrito-enlace',
      atributos: {
        type: 'button',
        'aria-label': 'Carrito',
        'aria-haspopup': 'dialog',
        'aria-controls': 'mini-carrito-panel',
        'aria-expanded': 'false'
      }
    },
    icono('carrito', 18),
    contador
  );

  const actualizarContador = (total) => {
    const cantidad = Math.max(0, Number(total) || 0);
    contador.textContent = cantidad > 99 ? '99+' : String(cantidad);
    contador.hidden = cantidad <= 0;
    enlaceCarrito.setAttribute(
      'aria-label',
      cantidad > 0 ? `Carrito, ${cantidad} artículo${cantidad === 1 ? '' : 's'}` : 'Carrito'
    );
  };

  const refrescarContador = async () => {
    try {
      const carrito = await cargarCarrito(usuario);
      actualizarContador(carrito.totalArticulos);
    } catch {
      /* Si la consulta falla se conserva el ultimo valor visible. */
    }
  };

  if (window[SIMBOLO_CONTROLADOR]) window[SIMBOLO_CONTROLADOR].abort();
  const controlador = new AbortController();
  window[SIMBOLO_CONTROLADOR] = controlador;

  window.addEventListener(EVENTO_CARRITO, refrescarContador, { signal: controlador.signal });
  window.addEventListener(
    'storage',
    (evento) => {
      if (!evento.key || evento.key === CLAVE_CARRITO_VISITANTE) refrescarContador();
    },
    { signal: controlador.signal }
  );

  refrescarContador();

  return {
    acciones: el('div', { clase: 'cabecera-acciones' }, botonBuscar, enlaceCarrito),
    formulario,
    botonCarrito: enlaceCarrito
  };
}

function crearMenuMovil(ruta) {
  const categorias = el('div', {
    clase: 'menu-movil-categorias',
    atributos: { id: 'menu-movil-categorias' }
  });
  categorias.appendChild(
    el('p', { clase: 'desplegable-vacio', texto: 'Cargando categorías...' })
  );

  const enlaces = ENLACES_PUBLICOS.map((enlace) => {
    const activo = esActiva(ruta, enlace.ruta);
    return el('a', {
      clase: `menu-movil-enlace${activo ? ' activo' : ''}`,
      href: enlace.ruta,
      atributos: {
        'data-ruta': '',
        ...(activo ? { 'aria-current': 'page' } : {})
      },
      texto: enlace.etiqueta
    });
  });

  const menu = el(
    'nav',
    { clase: 'menu-movil', atributos: { 'aria-label': 'Menú de la tienda' } },
    el('p', { clase: 'menu-movil-titulo', texto: 'Tienda' }),
    el('div', { clase: 'menu-movil-grupo' }, ...enlaces),
    el('p', { clase: 'menu-movil-titulo', texto: 'Categorías' }),
    categorias
  );
  menu.hidden = true;

  return { menu, categorias };
}

async function cargarCategorias(panel, categoriasMovil) {
  try {
    const respuesta = await solicitar('/categorias');
    const categorias = respuesta?.datos?.categorias || [];

    if (categorias.length === 0) {
      panel.replaceChildren(
        el('p', { clase: 'desplegable-vacio', texto: 'Todavía no hay categorías publicadas.' })
      );
      categoriasMovil.replaceChildren(
        el('p', { clase: 'desplegable-vacio', texto: 'Todavía no hay categorías publicadas.' })
      );
      return;
    }

    panel.replaceChildren(
      ...categorias.map((categoria) =>
        crearEnlaceCategoria(categoria, 'desplegable-enlace')
      )
    );
    categoriasMovil.replaceChildren(
      ...categorias.map((categoria) => crearEnlaceCategoria(categoria, 'menu-movil-enlace'))
    );
  } catch {
    const mensaje = 'No se pudieron cargar las categorías.';
    panel.replaceChildren(el('p', { clase: 'desplegable-vacio', texto: mensaje }));
    categoriasMovil.replaceChildren(el('p', { clase: 'desplegable-vacio', texto: mensaje }));
  }
}

function crearNavegacion(ruta) {
  const { contenedor, panel } = crearMenuTienda();

  const enlaces = ENLACES_PUBLICOS.map((enlace) => {
    const activo = esActiva(ruta, enlace.ruta);
    return el('a', {
      clase: `cabecera-enlace${activo ? ' activo' : ''}`,
      href: enlace.ruta,
      atributos: {
        'data-ruta': '',
        ...(activo ? { 'aria-current': 'page' } : {})
      },
      texto: enlace.etiqueta
    });
  });

  return {
    navegacion: el(
      'nav',
      { clase: 'cabecera-nav', atributos: { 'aria-label': 'Navegación principal' } },
      contenedor,
      ...enlaces
    ),
    panel
  };
}

function crearPie() {
  const enlacesTienda = el(
    'ul',
    { clase: 'pie-lista' },
    el('li', {}, el('a', { clase: 'pie-enlace', href: '/catalogo', atributos: { 'data-ruta': '' }, texto: 'Catálogo' })),
    el('li', {}, el('a', { clase: 'pie-enlace', href: '/pedidos', atributos: { 'data-ruta': '' }, texto: 'Rastrear pedido' })),
    el('li', {}, el('a', { clase: 'pie-enlace', href: '/carrito', atributos: { 'data-ruta': '' }, texto: 'Carrito' })),
    el('li', {}, el('a', { clase: 'pie-enlace', href: '/cuenta', atributos: { 'data-ruta': '' }, texto: 'Mi cuenta' }))
  );

  return el(
    'footer',
    { clase: 'pie' },
    el(
      'div',
      { clase: 'pie-columnas' },
      el(
        'nav',
        { clase: 'pie-columna', atributos: { 'aria-label': 'Enlaces de la tienda' } },
        el('h2', { clase: 'pie-titulo', texto: 'Tienda' }),
        enlacesTienda
      ),
      el(
        'section',
        { clase: 'pie-columna' },
        el('h2', { clase: 'pie-titulo', texto: 'NubaGlow' }),
        el('p', {
          clase: 'pie-texto',
          texto: 'Skincare y maquillaje seleccionados con criterio profesional en Sucre, Bolivia.'
        }),
        el('a', {
          clase: 'pie-enlace',
          href: '/',
          atributos: { 'data-ruta': '' },
          texto: 'Volver al inicio'
        })
      ),
      el(
        'section',
        { clase: 'pie-columna' },
        el('h2', { clase: 'pie-titulo', texto: 'Atención' }),
        el(
          'ul',
          { clase: 'pie-lista' },
          el('li', { clase: 'pie-texto', texto: 'Pago contra entrega en Sucre' }),
          el('li', {}, el('a', { clase: 'pie-enlace', href: '/pedidos', atributos: { 'data-ruta': '' }, texto: 'Rastreo de pedidos' })),
          el('li', { clase: 'pie-texto', texto: 'Contacto por WhatsApp para coordinar tu entrega' })
        )
      )
    ),
    el('p', {
      clase: 'pie-nota',
      texto: 'Proyecto académico de Ingeniería de Software · Nuba Beauty, Sucre, Bolivia.'
    })
  );
}

export function crearLayoutPublico({ ruta, usuario, router }) {
  const raiz = el('div', { clase: 'app-publico' });

  const miniCarrito = crearMiniCarrito({ usuario, router });
  const anuncio = crearBandaAnuncio();
  const { acciones, formulario, botonCarrito } = crearAcciones(usuario, router);
  const { navegacion, panel } = crearNavegacion(ruta);
  const { menu: menuMovil, categorias: categoriasMovil } = crearMenuMovil(ruta);

  miniCarrito.vincularDisparador(botonCarrito);

  const botonMenu = el(
    'button',
    {
      clase: 'cabecera-menu-boton',
      atributos: {
        type: 'button',
        'aria-label': 'Abrir menú',
        'aria-expanded': 'false',
        'aria-controls': 'menu-movil'
      }
    },
    icono('menu', 20)
  );

  menuMovil.setAttribute('id', 'menu-movil');

  botonMenu.addEventListener('click', () => {
    const abrir = menuMovil.hidden;
    menuMovil.hidden = !abrir;
    botonMenu.setAttribute('aria-expanded', String(abrir));
    botonMenu.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
  });

  const encabezado = el(
    'header',
    { clase: 'cabecera-tienda' },
    el(
      'div',
      { clase: 'cabecera-fila' },
      botonMenu,
      crearMarca(),
      navegacion,
      acciones,
      formulario
    ),
    menuMovil
  );

  const contenido = el('main', {
    clase: 'contenido-publico',
    atributos: { id: 'contenido' }
  });

  raiz.append(
    ...[anuncio, encabezado, contenido, crearPie(), miniCarrito.raiz].filter(Boolean)
  );

  cargarCategorias(panel, categoriasMovil);

  return { raiz, contenido };
}
