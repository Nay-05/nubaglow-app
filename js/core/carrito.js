/**
 * ============================================================================
 * NUBAGLOW APP - MODULO COMPARTIDO DE CARRITO
 * ============================================================================
 * Centraliza la lectura y mutacion del carrito para la pagina /carrito, el
 * mini-carrito lateral y el contador de la cabecera:
 * - Cliente autenticado: usa /api/carrito (subtotal y stock calculados por el
 *   servidor).
 * - Visitante: usa el respaldo de localStorage con try/catch y refresca el
 *   stock real consultando la ficha publica de cada producto.
 * No se duplica la logica de negocio: todas las vistas consumen este modulo.
 */

import { api } from './api.js';
import {
  EVENTO_CARRITO,
  notificarCarritoActualizado,
  leerCarritoVisitante,
  cambiarCantidadVisitante,
  eliminarItemVisitante
} from './carritoVisitante.js';

export { EVENTO_CARRITO, notificarCarritoActualizado };

function esCliente(usuario) {
  return Boolean(usuario && usuario.rol === 'cliente');
}

function numeroSeguro(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function stockSeguro(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function calcularTotales(items) {
  let totalArticulos = 0;
  let subtotal = 0;

  for (const item of items) {
    totalArticulos += item.cantidad;
    subtotal += item.subtotal;
  }

  return {
    totalArticulos,
    subtotal: Math.round(subtotal * 100) / 100
  };
}

function normalizarItemCliente(item) {
  const id = Number(item.id);
  const cantidad = Math.max(1, Number(item.cantidad) || 1);
  const precioUnitario = numeroSeguro(item.precioUnitario);

  return {
    clave: `cliente-${id}`,
    id,
    origen: 'cliente',
    varianteId: Number(item.varianteId),
    productoId: Number(item.productoId),
    productoNombre: String(item.productoNombre || 'Producto Nuba Beauty'),
    productoSlug: String(item.productoSlug || ''),
    varianteNombre: String(item.varianteNombre || ''),
    sku: String(item.sku || ''),
    precioUnitario,
    cantidad,
    subtotal: numeroSeguro(item.subtotal),
    stockDisponible: stockSeguro(item.stockDisponible),
    imagen: String(item.imagen || ''),
    noDisponible: false
  };
}

function normalizarItemVisitante(item) {
  const cantidad = Math.max(1, Number(item.cantidad) || 1);
  const precioUnitario = numeroSeguro(item.precio);

  return {
    clave: `visitante-${item.varianteId}`,
    id: null,
    origen: 'visitante',
    varianteId: Number(item.varianteId),
    productoId: Number(item.productoId),
    productoNombre: String(item.productoNombre || 'Producto Nuba Beauty'),
    productoSlug: String(item.productoSlug || ''),
    varianteNombre: String(item.varianteNombre || ''),
    sku: '',
    precioUnitario,
    cantidad,
    subtotal: precioUnitario * cantidad,
    stockDisponible: stockSeguro(item.stockDisponible),
    imagen: String(item.imagen || ''),
    noDisponible: false
  };
}

/**
 * Para visitantes, contrasta el stock guardado con la ficha publica actual.
 * Si el producto o la variante ya no existen, la linea se marca como no
 * disponible (stock 0) para que la interfaz lo advierta.
 */
async function refrescarStockVisitante(items) {
  if (items.length === 0) return items;

  const slugs = Array.from(
    new Set(items.map((item) => item.productoSlug).filter(Boolean))
  );
  const detalles = new Map();

  await Promise.all(
    slugs.map(async (slug) => {
      try {
        const respuesta = await api.obtener(`/productos/${encodeURIComponent(slug)}`);
        detalles.set(slug, {
          producto: respuesta?.datos?.producto || null,
          estado: 200
        });
      } catch (error) {
        detalles.set(slug, {
          producto: null,
          estado: Number(error && error.estado) || 0
        });
      }
    })
  );

  return items.map((item) => {
    const detalle = detalles.get(item.productoSlug);
    if (!detalle) return item;

    if (!detalle.producto) {
      if (detalle.estado === 404 || detalle.estado === 403) {
        return { ...item, stockDisponible: 0, noDisponible: true };
      }
      return item;
    }

    const variante = (detalle.producto.variantes || []).find(
      (actual) => Number(actual.id) === Number(item.varianteId)
    );

    if (!variante) {
      return { ...item, stockDisponible: 0, noDisponible: true };
    }

    const precioUnitario = numeroSeguro(variante.precio) || item.precioUnitario;

    return {
      ...item,
      productoNombre: detalle.producto.nombre || item.productoNombre,
      varianteNombre: variante.nombre || item.varianteNombre,
      imagen: item.imagen || detalle.producto.imagenPrincipal || '',
      precioUnitario,
      subtotal: precioUnitario * item.cantidad,
      stockDisponible: numeroSeguro(variante.stock),
      noDisponible: false
    };
  });
}

async function cargarCarritoVisitante() {
  const base = leerCarritoVisitante().map(normalizarItemVisitante);
  const items = await refrescarStockVisitante(base);
  const totales = calcularTotales(items);

  return {
    origen: 'visitante',
    items,
    ...totales
  };
}

/**
 * Devuelve el carrito del usuario actual con la forma normalizada.
 * @param {Object|null} usuario perfil publico de la sesion
 */
export async function cargarCarrito(usuario) {
  if (esCliente(usuario)) {
    try {
      const respuesta = await api.obtener('/carrito');
      const carrito = respuesta?.datos?.carrito || {};
      const items = (carrito.items || []).map(normalizarItemCliente);
      const totales = calcularTotales(items);

      return {
        origen: 'cliente',
        items,
        totalArticulos: Number(carrito.totalArticulos) || totales.totalArticulos,
        subtotal:
          carrito.subtotal !== undefined
            ? numeroSeguro(carrito.subtotal)
            : totales.subtotal
      };
    } catch (error) {
      if (!error || error.estado !== 401) throw error;
    }
  }

  return cargarCarritoVisitante();
}

/**
 * Cambia la cantidad de una linea respetando el stock disponible.
 */
export async function cambiarCantidad(usuario, item, cantidad) {
  const nuevaCantidad = Math.max(1, Math.floor(Number(cantidad) || 1));
  const stock = stockSeguro(item.stockDisponible);

  if (stock !== null && nuevaCantidad > stock) {
    throw new Error(
      stock <= 0
        ? 'Esta variante se agotó. Quítala del carrito para continuar.'
        : `Solo quedan ${stock} unidades de esta variante.`
    );
  }

  if (item.origen === 'cliente') {
    const respuesta = await api.parchear(`/carrito/items/${item.id}`, {
      cantidad: nuevaCantidad
    });
    const carrito = respuesta?.datos?.carrito || {};
    const items = (carrito.items || []).map(normalizarItemCliente);
    const totales = calcularTotales(items);

    return {
      origen: 'cliente',
      items,
      totalArticulos: Number(carrito.totalArticulos) || totales.totalArticulos,
      subtotal:
        carrito.subtotal !== undefined ? numeroSeguro(carrito.subtotal) : totales.subtotal
    };
  }

  const resultado = cambiarCantidadVisitante(item.varianteId, nuevaCantidad);
  if (!resultado.ok) {
    throw new Error('No se pudo actualizar el carrito en este navegador.');
  }

  return cargarCarritoVisitante();
}

/**
 * Quita una linea del carrito.
 */
export async function quitarItem(usuario, item) {
  if (item.origen === 'cliente') {
    const respuesta = await api.eliminar(`/carrito/items/${item.id}`);
    const carrito = respuesta?.datos?.carrito || {};
    const items = (carrito.items || []).map(normalizarItemCliente);
    const totales = calcularTotales(items);

    return {
      origen: 'cliente',
      items,
      totalArticulos: Number(carrito.totalArticulos) || totales.totalArticulos,
      subtotal:
        carrito.subtotal !== undefined ? numeroSeguro(carrito.subtotal) : totales.subtotal
    };
  }

  const resultado = eliminarItemVisitante(item.varianteId);
  if (!resultado.ok) {
    throw new Error('No se pudo quitar el producto del carrito en este navegador.');
  }

  return cargarCarritoVisitante();
}

/**
 * Clasifica el estado de stock de una linea para la interfaz.
 * - agotado: stock 0 o variante/producto ya no disponible.
 * - excede: la cantidad guardada supera el stock actual.
 */
export function estadoStock(item) {
  const stock = stockSeguro(item.stockDisponible);

  if (item.noDisponible || (stock !== null && stock <= 0)) return 'agotado';
  if (stock !== null && item.cantidad > stock) return 'excede';
  return 'ok';
}
