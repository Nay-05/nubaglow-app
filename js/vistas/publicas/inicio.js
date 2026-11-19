/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: INICIO
 * ============================================================================
 * Portada editorial con estructura de tienda de maquillaje:
 * - Carrusel de campanas con controles, pausa y respeto por movimiento reducido.
 * - Carrusel horizontal de "Mas vendidos" con tarjetas existentes.
 * - Bloque editorial de un solo producto.
 * - Mosaicos grandes "Comprar por categoría".
 * Todo el contenido dinamico se crea con helpers seguros (sin innerHTML).
 */

import { el, icono } from '../../core/dom.js';
import { solicitar } from '../../core/api.js';
import { formatearBs } from '../../core/formato.js';
import {
  enlaceInterno,
  estadoVacio,
  imagenProducto
} from '../comunes.js';
import { crearTarjetaProducto } from './tarjetaProducto.js';

const TOTAL_MAS_VENDIDOS = 8;
const INTERVALO_HERO = 6500;

const HERO_SLIDES = [
  {
    tema: 'sand',
    etiqueta: 'Ritual de temporada',
    titulo: 'Tu piel, en equilibrio',
    texto:
      'Fórmulas de skincare elegidas con criterio profesional para acompañar tu rutina diaria, de la limpieza al cuidado final.',
    cta: { etiqueta: 'Explorar catálogo', ruta: '/catalogo' }
  },
  {
    tema: 'rose',
    etiqueta: 'Color y cuidado',
    titulo: 'Luz natural, todos los días',
    texto:
      'Maquillaje que se siente ligero y cuida tu piel. Encuentra tonos, texturas y presentaciones pensadas para tu estilo.',
    cta: { etiqueta: 'Ver productos', ruta: '/catalogo?orden=mejor_valorados' }
  },
  {
    tema: 'plum',
    etiqueta: 'Compra con confianza',
    titulo: 'Recibe en la puerta de tu casa',
    texto:
      'Pago contra entrega en Sucre y rastreo con código único. Acompañamos tu pedido desde la confirmación hasta la entrega.',
    cta: { etiqueta: 'Rastrear mi pedido', ruta: '/pedidos' }
  }
];

function contarCategorias(total) {
  const numero = Number(total) || 0;
  if (numero === 0) return 'Sin productos por ahora';
  if (numero === 1) return '1 producto';
  return `${numero} productos`;
}

function crearSlide(slide, indice) {
  return el(
    'article',
    {
      clase: `hero-slide hero-slide--${slide.tema}`,
      atributos: {
        role: 'group',
        'aria-roledescription': 'diapositiva',
        'aria-label': `Diapositiva ${indice + 1} de ${HERO_SLIDES.length}`
      }
    },
    el(
      'div',
      { clase: 'hero-slide-texto' },
      el('p', { clase: 'hero-etiqueta', texto: slide.etiqueta }),
      el('h2', { clase: 'hero-titulo', texto: slide.titulo }),
      el('p', { clase: 'hero-texto', texto: slide.texto }),
      enlaceInterno(slide.cta.ruta, slide.cta.etiqueta, {
        clase: 'btn btn-primary',
        nombreIcono: 'flecha'
      })
    ),
    el(
      'div',
      { clase: 'hero-slide-visual', atributos: { 'aria-hidden': 'true' } },
      el('span', { clase: 'hero-slide-forma hero-slide-forma-una' }),
      el('span', { clase: 'hero-slide-forma hero-slide-forma-dos' }),
      el('span', { clase: 'hero-slide-forma hero-slide-forma-tres' }),
      el(
        'span',
        { clase: 'hero-slide-icono' },
        icono('corazon', 84)
      )
    )
  );
}

function crearHeroCarrusel() {
  const slides = HERO_SLIDES.map((slide, indice) => crearSlide(slide, indice));
  const pista = el('div', { clase: 'hero-pista' }, ...slides);

  const indicadores = el('div', {
    clase: 'hero-indicadores',
    atributos: { role: 'group', 'aria-label': 'Seleccionar diapositiva' }
  });

  const botonesIndicador = slides.map((slide, indice) =>
    el('button', {
      clase: 'hero-indicador',
      atributos: {
        type: 'button',
        'aria-label': `Ir a la diapositiva ${indice + 1}: ${HERO_SLIDES[indice].titulo}`,
        'aria-current': 'false'
      },
      on: {
        click: () => {
          mostrar(indice);
          reiniciarAutoplay();
        }
      }
    })
  );

  indicadores.append(...botonesIndicador);

  const movimientoReducido =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let indiceActual = 0;
  let pausado = false;
  let temporizador = null;

  const textoPausa = el('span', {
    clase: 'solo-lectores',
    texto: 'Pausar presentación'
  });

  const botonPausa = el(
    'button',
    {
      clase: 'hero-pausa',
      atributos: { type: 'button', 'aria-label': 'Pausar presentación' }
    },
    icono('pausa', 16),
    textoPausa
  );

  function mostrar(indice) {
    indiceActual = (indice + slides.length) % slides.length;
    slides.forEach((slide, posicion) => {
      slide.hidden = posicion !== indiceActual;
    });
    botonesIndicador.forEach((boton, posicion) => {
      const activo = posicion === indiceActual;
      boton.classList.toggle('activo', activo);
      boton.setAttribute('aria-current', activo ? 'true' : 'false');
    });
  }

  function detenerAutoplay() {
    if (temporizador) window.clearInterval(temporizador);
    temporizador = null;
  }

  function iniciarAutoplay() {
    detenerAutoplay();
    if (movimientoReducido || pausado) return;

    temporizador = window.setInterval(() => {
      if (!pista.isConnected) {
        detenerAutoplay();
        return;
      }
      mostrar(indiceActual + 1);
    }, INTERVALO_HERO);
  }

  function reiniciarAutoplay() {
    if (pausado) return;
    iniciarAutoplay();
  }

  function reflejarPausa() {
    botonPausa.setAttribute(
      'aria-label',
      pausado ? 'Reanudar presentación' : 'Pausar presentación'
    );
    textoPausa.textContent = pausado ? 'Reanudar presentación' : 'Pausar presentación';
    botonPausa.replaceChildren(icono(pausado ? 'reproducir' : 'pausa', 16), textoPausa);
  }

  botonPausa.addEventListener('click', () => {
    pausado = !pausado;
    reflejarPausa();
    if (pausado) {
      detenerAutoplay();
    } else {
      iniciarAutoplay();
    }
  });

  const anterior = el(
    'button',
    {
      clase: 'hero-flecha',
      atributos: { type: 'button', 'aria-label': 'Diapositiva anterior' },
      on: {
        click: () => {
          mostrar(indiceActual - 1);
          reiniciarAutoplay();
        }
      }
    },
    icono('flechaIzquierda', 16)
  );

  const siguiente = el(
    'button',
    {
      clase: 'hero-flecha',
      atributos: { type: 'button', 'aria-label': 'Diapositiva siguiente' },
      on: {
        click: () => {
          mostrar(indiceActual + 1);
          reiniciarAutoplay();
        }
      }
    },
    icono('flecha', 16)
  );

  if (movimientoReducido) botonPausa.hidden = true;

  const controles = el(
    'div',
    { clase: 'hero-controles' },
    anterior,
    indicadores,
    siguiente,
    botonPausa
  );

  const seccion = el(
    'section',
    {
      clase: 'hero-carrusel',
      atributos: {
        'aria-roledescription': 'carrusel',
        'aria-label': 'Campañas de NubaGlow'
      }
    },
    pista,
    controles
  );

  mostrar(0);
  iniciarAutoplay();

  return seccion;
}

function crearSeccionMasVendidos(productos, fallo, { router, usuario }) {
  let contenido;

  if (fallo) {
    contenido = el(
      'div',
      { clase: 'estado-vacio-inicio' },
      estadoVacio('No pudimos cargar los más vendidos. Recarga la página para intentarlo de nuevo.')
    );
  } else if (productos.length === 0) {
    contenido = el(
      'div',
      { clase: 'estado-vacio-inicio' },
      estadoVacio('Todavía no hay productos disponibles en la tienda.'),
      enlaceInterno('/catalogo', 'Explorar catálogo', {
        clase: 'btn btn-outline btn-pequeno',
        nombreIcono: 'flecha'
      })
    );
  } else {
    contenido = crearCarruselProductos(productos, { router, usuario });
  }

  return el(
    'section',
    { clase: 'carrusel-seccion', atributos: { 'aria-labelledby': 'titulo-mas-vendidos' } },
    el(
      'header',
      { clase: 'seccion-cabecera' },
      el(
        'div',
        { clase: 'seccion-cabecera-texto' },
        el('p', { clase: 'seccion-etiqueta', texto: 'Selección Nuba' }),
        el('h2', {
          clase: 'seccion-titulo',
          atributos: { id: 'titulo-mas-vendidos' },
          texto: 'Más vendidos'
        })
      ),
      enlaceInterno('/catalogo', 'Ver catálogo completo', {
        clase: 'enlace-ver',
        nombreIcono: 'flecha'
      })
    ),
    contenido
  );
}

function crearCarruselProductos(productos, { router, usuario }) {
  const movimientoReducido =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pista = el('div', {
    clase: 'carrusel-pista',
    atributos: { tabindex: '0', 'aria-label': 'Productos más vendidos' }
  });

  pista.append(
    ...productos.map((producto) => crearTarjetaProducto(producto, { router, usuario }))
  );

  const anterior = el(
    'button',
    {
      clase: 'carrusel-flecha',
      atributos: { type: 'button', 'aria-label': 'Ver productos anteriores' }
    },
    icono('flechaIzquierda', 16)
  );

  const siguiente = el(
    'button',
    {
      clase: 'carrusel-flecha',
      atributos: { type: 'button', 'aria-label': 'Ver más productos' }
    },
    icono('flecha', 16)
  );

  const desplazar = (direccion) => {
    const primero = pista.firstElementChild;
    const ancho = primero ? primero.getBoundingClientRect().width + 12 : pista.clientWidth * 0.8;
    pista.scrollBy({
      left: direccion * ancho,
      behavior: movimientoReducido ? 'auto' : 'smooth'
    });
  };

  anterior.addEventListener('click', () => desplazar(-1));
  siguiente.addEventListener('click', () => desplazar(1));

  const actualizarFlechas = () => {
    const maximo = pista.scrollWidth - pista.clientWidth;
    anterior.disabled = pista.scrollLeft <= 4;
    siguiente.disabled = maximo <= 4 || pista.scrollLeft >= maximo - 4;
  };

  pista.addEventListener('scroll', actualizarFlechas, { passive: true });
  window.setTimeout(actualizarFlechas, 0);

  return el(
    'div',
    { clase: 'carrusel-productos' },
    el('div', { clase: 'carrusel-controles' }, anterior, siguiente),
    pista
  );
}

function crearEditorial(producto) {
  if (!producto) return null;

  const ruta = `/producto/${encodeURIComponent(String(producto.slug || ''))}`;
  const precio = Number(producto.precioMin) || 0;

  return el(
    'section',
    { clase: 'editorial', atributos: { 'aria-labelledby': 'titulo-editorial' } },
    el(
      'div',
      { clase: 'editorial-visual' },
      imagenProducto(producto.imagenPrincipal, producto.nombre)
    ),
    el(
      'div',
      { clase: 'editorial-texto' },
      el('p', { clase: 'seccion-etiqueta', texto: 'En foco' }),
      el('h2', {
        clase: 'editorial-titulo',
        atributos: { id: 'titulo-editorial' },
        texto: producto.nombre || 'Producto NubaGlow'
      }),
      el('p', {
        clase: 'editorial-descripcion',
        texto:
          producto.descripcion ||
          'Una selección de NubaGlow para sumar a tu ritual de belleza diario.'
      }),
      el(
        'div',
        { clase: 'editorial-meta' },
        el('span', {
          clase: 'editorial-categoria',
          texto: producto.categoriaNombre || 'NubaGlow'
        }),
        el('span', {
          clase: 'editorial-precio',
          texto: precio > 0 ? `Desde ${formatearBs(precio)}` : 'Precio por confirmar'
        })
      ),
      enlaceInterno(ruta, 'Descubrir el producto', {
        clase: 'btn btn-primary',
        nombreIcono: 'flecha'
      })
    )
  );
}

function crearTarjetaMosaico(categoria) {
  const slug = String(categoria.slug || '');

  return el(
    'a',
    {
      clase: 'mosaico-categoria',
      href: `/catalogo?categoria=${encodeURIComponent(slug)}`,
      atributos: {
        'data-ruta': '',
        'aria-label': `Ver ${categoria.nombre || 'categoría'} en el catálogo`
      }
    },
    el('span', { clase: 'mosaico-forma mosaico-forma-una' }),
    el('span', { clase: 'mosaico-forma mosaico-forma-dos' }),
    el('span', { clase: 'mosaico-flecha' }, icono('flecha', 18)),
    el('span', { clase: 'mosaico-nombre', texto: categoria.nombre || 'Sin nombre' }),
    el('span', { clase: 'mosaico-meta', texto: contarCategorias(categoria.totalProductos) })
  );
}

function crearSeccionMosaico(categorias, fallo) {
  let contenido;

  if (fallo) {
    contenido = el(
      'div',
      { clase: 'estado-vacio-inicio' },
      estadoVacio('No pudimos cargar las categorías en este momento. Recarga la página para intentarlo de nuevo.')
    );
  } else if (categorias.length === 0) {
    contenido = el(
      'div',
      { clase: 'estado-vacio-inicio' },
      estadoVacio('Todavía no hay categorías disponibles en la tienda.'),
      enlaceInterno('/catalogo', 'Ver catálogo', {
        clase: 'btn btn-outline btn-pequeno',
        nombreIcono: 'flecha'
      })
    );
  } else {
    contenido = el(
      'div',
      { clase: 'mosaico-categorias' },
      ...categorias.map((categoria) => crearTarjetaMosaico(categoria))
    );
  }

  return el(
    'section',
    { clase: 'seccion-inicio', atributos: { 'aria-labelledby': 'titulo-comprar-categoria' } },
    el(
      'header',
      { clase: 'seccion-cabecera' },
      el(
        'div',
        { clase: 'seccion-cabecera-texto' },
        el('p', { clase: 'seccion-etiqueta', texto: 'Explora por categoría' }),
        el('h2', {
          clase: 'seccion-titulo',
          atributos: { id: 'titulo-comprar-categoria' },
          texto: 'Comprar por categoría'
        })
      )
    ),
    contenido
  );
}

export const vistaInicio = {
  async render(contexto = {}) {
    const { router, usuario } = contexto;

    const [resultadoCategorias, resultadoVendidos, resultadoRecientes] = await Promise.allSettled([
      solicitar('/categorias'),
      solicitar(`/productos?limite=${TOTAL_MAS_VENDIDOS}&orden=mejor_valorados`),
      solicitar('/productos?limite=1&orden=recientes')
    ]);

    const categorias =
      resultadoCategorias.status === 'fulfilled'
        ? resultadoCategorias.value?.datos?.categorias || []
        : [];
    const masVendidos =
      resultadoVendidos.status === 'fulfilled'
        ? resultadoVendidos.value?.datos?.productos || []
        : [];
    const recientes =
      resultadoRecientes.status === 'fulfilled'
        ? resultadoRecientes.value?.datos?.productos || []
        : [];

    const productoEditorial = masVendidos[0] || recientes[0] || null;

    return el(
      'div',
      { clase: 'inicio' },
      el('h1', {
        clase: 'solo-lectores',
        texto: 'NubaGlow · Skincare y maquillaje en Sucre, Bolivia'
      }),
      crearHeroCarrusel(),
      crearSeccionMasVendidos(masVendidos, resultadoVendidos.status === 'rejected', {
        router,
        usuario
      }),
      crearEditorial(productoEditorial),
      crearSeccionMosaico(categorias, resultadoCategorias.status === 'rejected')
    );
  }
};
