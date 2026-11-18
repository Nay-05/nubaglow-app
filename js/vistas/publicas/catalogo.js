/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: CATALOGO
 * ============================================================================
 * Consume /api/categorias y /api/productos. Los filtros viven en la URL
 * (?categoria=...&buscar=...) para que Atras/Adelante y F5 funcionen.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import {
  encabezadoPagina,
  alerta,
  estadoVacio,
  imagenProducto,
  precioRango
} from '../comunes.js';

function chipFiltro(etiqueta, activo, alHacerClic) {
  return el(
    'button',
    {
      clase: `chip${activo ? ' activo' : ''}`,
      atributos: { type: 'button', 'aria-pressed': activo ? 'true' : 'false' },
      on: { click: alHacerClic }
    },
    el('span', { texto: etiqueta })
  );
}

function tarjetaProducto(producto) {
  const ruta = `/producto/${encodeURIComponent(producto.slug)}`;
  const stock = Number(producto.stockTotal) || 0;
  const resenas = Number(producto.totalResenas) || 0;
  const promedio = Number(producto.promedioCalificacion) || 0;

  return el(
    'article',
    { clase: 'tarjeta-producto' },
    el(
      'a',
      { clase: 'tarjeta-imagen', href: ruta, atributos: { 'data-ruta': '' } },
      imagenProducto(producto.imagenPrincipal, producto.nombre)
    ),
    el(
      'div',
      { clase: 'tarjeta-cuerpo' },
      el('span', { clase: 'tarjeta-marca', texto: producto.marca || 'Nuba Beauty' }),
      el(
        'h2',
        { clase: 'tarjeta-titulo' },
        el('a', { href: ruta, atributos: { 'data-ruta': '' }, texto: producto.nombre })
      ),
      el('p', { clase: 'tarjeta-precio', texto: precioRango(producto.precioMin, producto.precioMax) }),
      el(
        'div',
        { clase: 'tarjeta-meta' },
        el('span', {
          clase: stock > 0 ? 'etiqueta-disponible' : 'etiqueta-agotado',
          texto: stock > 0 ? `Stock: ${stock}` : 'Agotado'
        }),
        el('span', {
          clase: 'tarjeta-resenas',
          texto: resenas > 0 ? `${promedio} / 5 (${resenas})` : 'Sin reseñas'
        })
      )
    )
  );
}

export const vistaCatalogo = {
  async render({ consulta, router }) {
    const categoriaActual = consulta.get('categoria') || '';
    const busquedaActual = consulta.get('buscar') || '';

    const seccion = el('section', { clase: 'pagina' });
    seccion.appendChild(
      encabezadoPagina(
        'Catálogo',
        'Skincare y maquillaje con información clara de variantes, precios y disponibilidad.'
      )
    );

    const entradaBusqueda = el('input', {
      clase: 'entrada',
      type: 'search',
      name: 'buscar',
      value: busquedaActual,
      placeholder: 'Buscar por nombre o marca',
      atributos: { 'aria-label': 'Buscar productos', minlength: '2', autocomplete: 'off' }
    });

    const formulario = el(
      'form',
      { clase: 'buscador', atributos: { role: 'search' } },
      entradaBusqueda,
      el(
        'button',
        { clase: 'btn btn-primary', atributos: { type: 'submit' } },
        icono('buscar', 16),
        el('span', { texto: 'Buscar' })
      )
    );

    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const parametros = new URLSearchParams();
      if (categoriaActual) parametros.set('categoria', categoriaActual);
      const termino = entradaBusqueda.value.trim();
      if (termino) parametros.set('buscar', termino);
      const sufijo = parametros.toString();
      router.navegar(`/catalogo${sufijo ? `?${sufijo}` : ''}`);
    });

    const filtros = el('div', { clase: 'chips', atributos: { 'aria-label': 'Filtros por categoría' } });
    const mensajes = el('div', { clase: 'mensajes' });
    const grilla = el('div', { clase: 'grilla-productos' });

    seccion.append(formulario, filtros, mensajes, grilla);

    const irAFiltro = (slug) => {
      const parametros = new URLSearchParams();
      if (slug) parametros.set('categoria', slug);
      if (busquedaActual) parametros.set('buscar', busquedaActual);
      const sufijo = parametros.toString();
      router.navegar(`/catalogo${sufijo ? `?${sufijo}` : ''}`);
    };

    try {
      const parametrosProductos = new URLSearchParams({ limite: '24', orden: 'nombre_asc' });
      if (categoriaActual) parametrosProductos.set('categoria', categoriaActual);
      if (busquedaActual) parametrosProductos.set('buscar', busquedaActual);

      const [respuestaCategorias, respuestaProductos] = await Promise.all([
        api.obtener('/categorias'),
        api.obtener(`/productos?${parametrosProductos.toString()}`)
      ]);

      const categorias = respuestaCategorias.datos.categorias || [];
      const productos = respuestaProductos.datos.productos || [];

      filtros.append(
        chipFiltro('Todas', !categoriaActual, () => irAFiltro('')),
        ...categorias.map((categoria) =>
          chipFiltro(categoria.nombre, categoria.slug === categoriaActual, () =>
            irAFiltro(categoria.slug)
          )
        )
      );

      if (productos.length === 0) {
        grilla.appendChild(
          estadoVacio('No encontramos productos con esos criterios. Prueba otra búsqueda.')
        );
      } else {
        grilla.append(...productos.map(tarjetaProducto));
      }
    } catch (error) {
      mensajes.appendChild(
        alerta(error.message || 'No se pudo cargar el catálogo. Intenta nuevamente.')
      );
    }

    return seccion;
  }
};
