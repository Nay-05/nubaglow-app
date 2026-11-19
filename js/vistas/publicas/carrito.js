/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: CARRITO (/carrito)
 * ============================================================================
 * Vista del carrito completo. Comparte el modulo core/carrito.js con el
 * mini-carrito lateral: cliente autenticado usa la API y visitante usa el
 * respaldo local, por lo que ambos puntos de entrada muestran lo mismo.
 */

import { el } from '../../core/dom.js';
import { formatearBs } from '../../core/formato.js';
import { cargarCarrito, estadoStock } from '../../core/carrito.js';
import {
  encabezadoPagina,
  alerta,
  enlaceInterno,
  estadoVacio,
  imagenProducto,
  tabla
} from '../comunes.js';

function celdaProducto(item) {
  const stock = estadoStock(item);
  const aviso =
    stock === 'agotado'
      ? item.noDisponible
        ? 'Esta variante ya no está disponible.'
        : 'Variante agotada.'
      : stock === 'excede'
        ? `Solo quedan ${item.stockDisponible} unidades; ajusta la cantidad.`
        : '';

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
      el('span', { clase: 'texto-suave', texto: item.varianteNombre }),
      aviso ? el('span', { clase: 'texto-error', texto: aviso }) : null
    )
  );
}

export const vistaCarrito = {
  async render(contexto = {}) {
    const { usuario } = contexto;
    const seccion = el(
      'section',
      { clase: 'pagina' },
      encabezadoPagina('Tu carrito', 'Revisa los artículos que agregaste antes de continuar.')
    );

    try {
      const carrito = await cargarCarrito(usuario);

      if (!carrito.items || carrito.items.length === 0) {
        seccion.append(
          estadoVacio('Tu carrito está vacío. Explora el catálogo para agregar productos.'),
          enlaceInterno('/catalogo', 'Ver catálogo', { clase: 'btn btn-primary' })
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
          el('p', { texto: `Artículos: ${carrito.totalArticulos}` }),
          el('p', { clase: 'resumen-total', texto: `Subtotal: ${formatearBs(carrito.subtotal)}` }),
          el('p', {
            clase: 'texto-suave',
            texto: 'El checkout, los métodos de pago y el comprobante se habilitan en la Fase 6.'
          })
        )
      );
    } catch (error) {
      seccion.appendChild(
        alerta(error.message || 'No se pudo cargar tu carrito. Vuelve a iniciar sesión.')
      );
    }

    return seccion;
  }
};
