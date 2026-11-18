/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: INICIO
 * ============================================================================
 * Portada editorial: hero de marca, categorias y productos destacados leidos
 * desde la API publica, seccion de confianza y estados vacios claros.
 * Todos los nodos se crean con helpers seguros (sin innerHTML).
 */

import { el, icono } from '../../core/dom.js';
import { solicitar } from '../../core/api.js';
import { formatearBs } from '../../core/formato.js';
import { enlaceInterno, estadoVacio, imagenProducto } from '../comunes.js';

const TOTAL_DESTACADOS = 8;

function contarCategorias(total) {
  const numero = Number(total) || 0;
  if (numero === 0) return 'Sin productos por ahora';
  if (numero === 1) return '1 producto';
  return `${numero} productos`;
}

function estrellas(promedio) {
  const valor = Number(promedio) || 0;
  const llenas = Math.round(valor);
  const nodos = [];

  for (let indice = 0; indice < 5; indice += 1) {
    const estrella = icono('estrella', 14);
    if (indice < llenas) estrella.classList.add('estrella-activa');
    nodos.push(estrella);
  }

  return el(
    'span',
    {
      clase: 'estrellas',
      atributos: {
        role: 'img',
        'aria-label': valor > 0 ? `Valoración ${valor.toFixed(1)} de 5` : 'Producto sin reseñas'
      }
    },
    ...nodos
  );
}

function valoracion(producto) {
  const promedio = Number(producto.promedioCalificacion) || 0;
  const total = Number(producto.totalResenas) || 0;

  return el(
    'div',
    { clase: 'valoracion' },
    estrellas(promedio),
    el('span', {
      texto: promedio > 0 ? `${promedio.toFixed(1)} (${total})` : 'Sin reseñas'
    })
  );
}

function estadoSeccion(mensaje, { ruta, etiqueta } = {}) {
  return el(
    'div',
    { clase: 'estado-vacio estado-vacio-inicio' },
    estadoVacio(mensaje),
    ruta ? enlaceInterno(ruta, etiqueta, { clase: 'btn btn-outline btn-pequeno', nombreIcono: 'flecha' }) : null
  );
}

function crearHero() {
  return el(
    'section',
    { clase: 'hero' },
    el(
      'div',
      { clase: 'hero-texto-bloque' },
      el('p', { clase: 'hero-etiqueta', texto: 'Nuba Beauty · Sucre, Bolivia' }),
      el('h1', { clase: 'hero-titulo' }, 'Belleza que cuida tu piel'),
      el('p', {
        clase: 'hero-texto',
        texto:
          'Cosméticos y skincare seleccionados con criterio profesional. Descubre tu ritual, compra en línea y sigue cada pedido hasta tu puerta.'
      }),
      el(
        'div',
        { clase: 'hero-acciones' },
        enlaceInterno('/catalogo', 'Ver catálogo', {
          clase: 'btn btn-primary',
          nombreIcono: 'catalogo'
        }),
        enlaceInterno('/pedidos', 'Rastrear pedido', {
          clase: 'btn btn-outline',
          nombreIcono: 'pedido'
        })
      ),
      el(
        'ul',
        { clase: 'hero-sellos', atributos: { 'aria-label': 'Ventajas de compra' } },
        el('li', {}, icono('pago', 16), el('span', { texto: 'Pago contra entrega' })),
        el('li', {}, icono('pedido', 16), el('span', { texto: 'Rastreo con código único' }))
      )
    ),
    el(
      'div',
      { clase: 'hero-visual', atributos: { 'aria-hidden': 'true' } },
      el('span', { clase: 'hero-forma hero-forma-una' }),
      el('span', { clase: 'hero-forma hero-forma-dos' }),
      el('span', { clase: 'hero-forma hero-forma-tres' }),
      el('img', {
        clase: 'hero-icono',
        src: '/assets/brand/icono2.png',
        alt: ''
      })
    )
  );
}

function crearTarjetaCategoria(categoria) {
  const slug = String(categoria.slug || '');

  return el(
    'a',
    {
      clase: 'tarjeta-categoria',
      href: `/catalogo?categoria=${encodeURIComponent(slug)}`,
      atributos: { 'data-ruta': '' }
    },
    el('span', { clase: 'categoria-icono' }, icono('corazon', 20)),
    el('span', { clase: 'categoria-flecha' }, icono('flecha', 16)),
    el('span', { clase: 'categoria-nombre', texto: categoria.nombre || 'Sin nombre' }),
    el('span', { clase: 'categoria-meta', texto: contarCategorias(categoria.totalProductos) })
  );
}

function crearSeccionCategorias(categorias, fallo) {
  let contenido;

  if (fallo) {
    contenido = estadoSeccion(
      'No pudimos cargar las categorías en este momento. Recarga la página para intentarlo de nuevo.'
    );
  } else if (categorias.length === 0) {
    contenido = estadoSeccion('Todavía no hay categorías disponibles en la tienda.', {
      ruta: '/catalogo',
      etiqueta: 'Ver catálogo'
    });
  } else {
    contenido = el(
      'div',
      { clase: 'grilla-categorias' },
      ...categorias.map((categoria) => crearTarjetaCategoria(categoria))
    );
  }

  return el(
    'section',
    { clase: 'seccion-inicio', atributos: { 'aria-labelledby': 'titulo-categorias' } },
    el(
      'header',
      { clase: 'seccion-cabecera' },
      el(
        'div',
        { clase: 'seccion-cabecera-texto' },
        el('p', { clase: 'seccion-etiqueta', texto: 'Explora por categoría' }),
        el('h2', { clase: 'seccion-titulo', atributos: { id: 'titulo-categorias' }, texto: 'Encuentra tu ritual' })
      ),
      enlaceInterno('/catalogo', 'Ver catálogo completo', {
        clase: 'enlace-ver',
        nombreIcono: 'flecha'
      })
    ),
    contenido
  );
}

function crearTarjetaProducto(producto) {
  const ruta = `/producto/${encodeURIComponent(String(producto.slug || ''))}`;
  const precio = Number(producto.precioMin) || 0;

  return el(
    'article',
    { clase: 'tarjeta-producto tarjeta-destacado' },
    el(
      'a',
      { clase: 'tarjeta-imagen', href: ruta, atributos: { 'data-ruta': '' } },
      imagenProducto(producto.imagenPrincipal, producto.nombre)
    ),
    el(
      'div',
      { clase: 'tarjeta-cuerpo' },
      el('p', { clase: 'tarjeta-marca', texto: producto.marca || 'Nuba Beauty' }),
      el(
        'h3',
        { clase: 'tarjeta-titulo' },
        el('a', { href: ruta, atributos: { 'data-ruta': '' }, texto: producto.nombre || 'Producto Nuba Beauty' })
      ),
      el('p', {
        clase: 'tarjeta-precio',
        texto: precio > 0 ? `Desde ${formatearBs(precio)}` : 'Precio por confirmar'
      }),
      valoracion(producto),
      enlaceInterno(ruta, 'Ver producto', {
        clase: 'btn btn-outline btn-pequeno tarjeta-boton',
        nombreIcono: 'flecha'
      })
    )
  );
}

function crearSeccionDestacados(productos, fallo) {
  let contenido;

  if (fallo) {
    contenido = estadoSeccion(
      'No pudimos cargar los productos destacados. Recarga la página para intentarlo de nuevo.'
    );
  } else if (productos.length === 0) {
    contenido = estadoSeccion('Todavía no hay productos destacados en la tienda.', {
      ruta: '/catalogo',
      etiqueta: 'Explorar catálogo'
    });
  } else {
    contenido = el(
      'div',
      { clase: 'grilla-destacados' },
      ...productos.map((producto) => crearTarjetaProducto(producto))
    );
  }

  return el(
    'section',
    { clase: 'seccion-inicio', atributos: { 'aria-labelledby': 'titulo-destacados' } },
    el(
      'header',
      { clase: 'seccion-cabecera' },
      el(
        'div',
        { clase: 'seccion-cabecera-texto' },
        el('p', { clase: 'seccion-etiqueta', texto: 'Recién llegados' }),
        el('h2', { clase: 'seccion-titulo', atributos: { id: 'titulo-destacados' }, texto: 'Productos destacados' })
      ),
      enlaceInterno('/catalogo', 'Ver todo el catálogo', {
        clase: 'enlace-ver',
        nombreIcono: 'flecha'
      })
    ),
    contenido
  );
}

function crearConfianza() {
  const pilares = [
    {
      icono: 'pago',
      titulo: 'Pago contra entrega',
      texto: 'Paga al recibir tu pedido y coordina la entrega con el equipo de Nuba Beauty.'
    },
    {
      icono: 'pedido',
      titulo: 'Rastreo con código',
      texto: 'Cada pedido recibe un código único para consultar su estado en línea.'
    },
    {
      icono: 'whatsapp',
      titulo: 'Atención por WhatsApp',
      texto: 'Resolvemos tus dudas y coordinamos la entrega por WhatsApp.'
    }
  ];

  return el(
    'section',
    { clase: 'confianza', atributos: { 'aria-labelledby': 'titulo-confianza' } },
    el('h2', { clase: 'confianza-titulo', atributos: { id: 'titulo-confianza' }, texto: 'Compra con confianza' }),
    el(
      'div',
      { clase: 'confianza-grilla' },
      ...pilares.map((pilar) =>
        el(
          'article',
          { clase: 'confianza-item' },
          el('span', { clase: 'confianza-icono' }, icono(pilar.icono, 20)),
          el('h3', { clase: 'confianza-item-titulo', texto: pilar.titulo }),
          el('p', { clase: 'confianza-item-texto', texto: pilar.texto })
        )
      )
    )
  );
}

export const vistaInicio = {
  async render() {
    const [resultadoCategorias, resultadoProductos] = await Promise.allSettled([
      solicitar('/categorias'),
      solicitar(`/productos?limite=${TOTAL_DESTACADOS}&orden=recientes`)
    ]);

    const categorias =
      resultadoCategorias.status === 'fulfilled'
        ? resultadoCategorias.value?.datos?.categorias || []
        : [];
    const productos =
      resultadoProductos.status === 'fulfilled'
        ? resultadoProductos.value?.datos?.productos || []
        : [];

    return el(
      'div',
      { clase: 'inicio' },
      crearHero(),
      crearSeccionCategorias(categorias, resultadoCategorias.status === 'rejected'),
      crearSeccionDestacados(productos, resultadoProductos.status === 'rejected'),
      crearConfianza()
    );
  }
};
