/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: FICHA DE PRODUCTO (/producto/:slug)
 * ============================================================================
 * Demuestra el uso de parametros dinamicos del router y lectura publica de la
 * ficha completa (variantes, imagenes, resenas) sin exponer HTML de la BD.
 */

import { el } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs } from '../../core/formato.js';
import {
  alerta,
  enlaceInterno,
  imagenProducto,
  precioRango,
  tabla
} from '../comunes.js';

function bloqueDetalle(titulo, contenido) {
  if (!contenido) return null;
  return el(
    'section',
    { clase: 'bloque-detalle' },
    el('h2', { clase: 'bloque-detalle-titulo', texto: titulo }),
    el('p', { clase: 'texto-suave', texto: contenido })
  );
}

export const vistaProducto = {
  async render({ params }) {
    const seccion = el('section', { clase: 'pagina' });
    seccion.appendChild(enlaceInterno('/catalogo', 'Volver al catalogo', { nombreIcono: 'flecha' }));

    try {
      const respuesta = await api.obtener(`/productos/${encodeURIComponent(params.slug || '')}`);
      const producto = respuesta.datos.producto;
      const imagenes = producto.imagenes && producto.imagenes.length
        ? producto.imagenes
        : [{ url: producto.imagenPrincipal, esPrincipal: true }];
      const variantes = producto.variantes || [];
      const resenas = Number(producto.totalResenas) || 0;
      const promedio = Number(producto.promedioCalificacion) || 0;

      const galeria = el(
        'div',
        { clase: 'ficha-galeria' },
        ...imagenes.map((imagen, indice) =>
          el(
            'div',
            { clase: `ficha-imagen${indice === 0 ? ' principal' : ''}` },
            imagenProducto(imagen.url, producto.nombre)
          )
        )
      );

      const informacion = el(
        'div',
        { clase: 'ficha-info' },
        el('span', { clase: 'tarjeta-marca', texto: producto.marca || 'Nuba Beauty' }),
        el('h1', { clase: 'ficha-titulo', texto: producto.nombre }),
        el('p', { clase: 'ficha-categoria', texto: producto.categoriaNombre || '' }),
        el(
          'div',
          { clase: 'ficha-meta' },
          el('span', {
            clase: 'ficha-precio',
            texto: precioRango(producto.precioMin, producto.precioMax)
          }),
          el('span', {
            clase: resenas > 0 ? 'tarjeta-resenas' : 'etiqueta-agotado',
            texto: resenas > 0 ? `${promedio} / 5 (${resenas} resenas)` : 'Sin resenas verificadas'
          })
        ),
        el('p', {
          clase: producto.stockTotal > 0 ? 'etiqueta-disponible' : 'etiqueta-agotado',
          texto:
            producto.stockTotal > 0
              ? `Disponibilidad total: ${producto.stockTotal} unidades`
              : 'Producto agotado por el momento'
        }),
        bloqueDetalle('Descripcion', producto.descripcion),
        bloqueDetalle('Ingredientes clave', producto.ingredientes),
        bloqueDetalle('Modo de uso', producto.modoUso)
      );

      seccion.appendChild(el('div', { clase: 'ficha-producto' }, galeria, informacion));

      seccion.appendChild(
        el(
          'section',
          { clase: 'bloque-detalle' },
          el('h2', { clase: 'bloque-detalle-titulo', texto: 'Variantes disponibles' }),
          variantes.length
            ? tabla(
                ['Presentacion', 'SKU', 'Precio', 'Stock'],
                variantes.map((variante) => [
                  variante.nombre,
                  variante.sku,
                  formatearBs(variante.precio),
                  variante.stock > 0 ? String(variante.stock) : 'Agotado'
                ])
              )
            : el('p', { clase: 'texto-suave', texto: 'Este producto no tiene variantes activas.' })
        )
      );
    } catch (error) {
      seccion.appendChild(
        alerta(
          error.estado === 404
            ? 'El producto solicitado no existe o ya no esta disponible.'
            : error.message || 'No se pudo cargar la ficha del producto.'
        )
      );
      seccion.appendChild(enlaceInterno('/catalogo', 'Ir al catalogo', { clase: 'btn btn-outline' }));
    }

    return seccion;
  }
};
