/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: CARRITO (/carrito)
 * ============================================================================
 * Lectura del carrito persistente del cliente autenticado. La edicion de
 * cantidades y el checkout se completan en la Fase 6.
 */

import { el } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs } from '../../core/formato.js';
import {
  encabezadoPagina,
  alerta,
  enlaceInterno,
  estadoVacio,
  imagenProducto,
  tabla
} from '../comunes.js';

function celdaProducto(item) {
  return el(
    'div',
    { clase: 'celda-producto' },
    imagenProducto(item.imagen, item.productoNombre),
    el(
      'div',
      {},
      el('a', {
        clase: 'celda-producto-nombre',
        href: `/producto/${encodeURIComponent(item.productoSlug)}`,
        atributos: { 'data-ruta': '' },
        texto: item.productoNombre
      }),
      el('span', { clase: 'texto-suave', texto: item.varianteNombre })
    )
  );
}

export const vistaCarrito = {
  async render() {
    const seccion = el(
      'section',
      { clase: 'pagina' },
      encabezadoPagina('Tu carrito', 'Articulos guardados en tu cuenta.')
    );

    try {
      const respuesta = await api.obtener('/carrito');
      const carrito = respuesta.datos.carrito;

      if (!carrito.items || carrito.items.length === 0) {
        seccion.append(
          estadoVacio('Tu carrito esta vacio. Explora el catalogo para agregar productos.'),
          enlaceInterno('/catalogo', 'Ver catalogo', { clase: 'btn btn-primary' })
        );
        return seccion;
      }

      seccion.appendChild(
        tabla(
          ['Producto', 'Cantidad', 'Precio unitario', 'Subtotal'],
          carrito.items.map((item) => [
            celdaProducto(item),
            String(item.cantidad),
            formatearBs(item.precioUnitario),
            formatearBs(item.subtotal)
          ])
        )
      );

      seccion.appendChild(
        el(
          'div',
          { clase: 'resumen-carrito' },
          el('p', { texto: `Articulos: ${carrito.totalArticulos}` }),
          el('p', { clase: 'resumen-total', texto: `Subtotal: ${formatearBs(carrito.subtotal)}` }),
          el('p', {
            clase: 'texto-suave',
            texto: 'El checkout, los metodos de pago y el comprobante se habilitan en la Fase 6.'
          })
        )
      );
    } catch (error) {
      seccion.appendChild(
        alerta(error.message || 'No se pudo cargar tu carrito. Vuelve a iniciar sesion.')
      );
    }

    return seccion;
  }
};
