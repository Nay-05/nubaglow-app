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
  eliminarItemVisitante,
  vaciarCarritoVisitante
} from './carritoVisitante.js';

export { EVENTO_CARRITO, notificarCarritoActualizado };

const CLAVE_AVISO_FUSION = 'nubaglow:aviso-fusion-carrito';

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
    productoNombre: String(item.productoNombre || 'Producto NubaGlow'),
    productoSlug: String(item.productoSlug || ''),
    varianteNombre: String(item.varianteNombre || ''),
    sku: String(item.sku || ''),
    precioUnitario,
    cantidad,
    subtotal: numeroSeguro(item.subtotal),
    stockDisponible: stockSeguro(item.stockDisponible),
    imagen: String(item.imagen || ''),
    noDisponible: Boolean(item.noDisponible)
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
    productoNombre: String(item.productoNombre || 'Producto NubaGlow'),
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

    if (detalle.producto.activo === false) {
      return { ...item, stockDisponible: 0, noDisponible: true };
    }

    const variante = (detalle.producto.variantes || []).find(
      (actual) => Number(actual.id) === Number(item.varianteId)
    );

    if (!variante || variante.activo === false) {
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
 * Une el carrito local de visitante con el carrito persistente del cliente.
 * Suma cantidades sin superar el stock actual, informa los ajustes y vacia el
 * respaldo local solo cuando la fusion termino correctamente.
 */
export async function fusionarCarritoVisitante(usuario) {
  const visitante = leerCarritoVisitante();
  const resultado = {
    agregados: 0,
    ajustados: 0,
    noDisponibles: 0,
    totalArticulos: 0,
    vaciado: true
  };

  if (!esCliente(usuario) || visitante.length === 0) return resultado;

  const carritoCuenta = await cargarCarrito(usuario);
  if (carritoCuenta.origen !== 'cliente') {
    throw new Error('No se pudo leer el carrito de tu cuenta.');
  }

  const slugs = Array.from(
    new Set(visitante.map((item) => item.productoSlug).filter(Boolean))
  );
  const detalles = new Map();

  await Promise.all(
    slugs.map(async (slug) => {
      try {
        const respuesta = await api.obtener(`/productos/${encodeURIComponent(slug)}`);
        detalles.set(slug, respuesta?.datos?.producto || null);
      } catch (error) {
        if (error && error.estado === 404) {
          detalles.set(slug, null);
          return;
        }
        throw error;
      }
    })
  );

  const cantidadesEnCuenta = new Map(
    carritoCuenta.items.map((item) => [item.varianteId, item.cantidad])
  );

  for (const item of visitante) {
    const detalle = detalles.get(item.productoSlug);
    const variante = (detalle?.variantes || []).find(
      (actual) => Number(actual.id) === Number(item.varianteId)
    );

    if (
      !detalle ||
      detalle.activo === false ||
      !variante ||
      variante.activo === false
    ) {
      resultado.noDisponibles += 1;
      continue;
    }

    const stock = stockSeguro(variante.stock);
    const cantidadEnCuenta = cantidadesEnCuenta.get(item.varianteId) || 0;
    const disponible = stock === null ? 0 : Math.max(0, stock - cantidadEnCuenta);

    if (disponible <= 0) {
      resultado.noDisponibles += 1;
      continue;
    }

    const cantidad = Math.min(item.cantidad, disponible);

    try {
      await api.crear('/carrito/items', {
        variante_id: item.varianteId,
        cantidad
      });
    } catch (error) {
      if (error && (error.estado === 400 || error.estado === 404)) {
        resultado.noDisponibles += 1;
        continue;
      }
      throw error;
    }

    cantidadesEnCuenta.set(item.varianteId, cantidadEnCuenta + cantidad);
    resultado.agregados += 1;
    resultado.totalArticulos += cantidad;
    if (cantidad < item.cantidad) resultado.ajustados += 1;
  }

  resultado.vaciado = vaciarCarritoVisitante();
  notificarCarritoActualizado();

  return resultado;
}

/**
 * Guarda el resumen de la fusion para mostrarlo al volver al carrito.
 */
export function guardarAvisoFusion(resumen) {
  try {
    window.sessionStorage.setItem(CLAVE_AVISO_FUSION, JSON.stringify(resumen));
  } catch {
    /* sessionStorage puede estar deshabilitado: el login continua igual. */
  }
}

/**
 * Lee y elimina el aviso pendiente de fusion, para mostrarlo una sola vez.
 */
export function consumirAvisoFusion() {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_AVISO_FUSION);
    if (!crudo) return null;
    window.sessionStorage.removeItem(CLAVE_AVISO_FUSION);
    const datos = JSON.parse(crudo);
    if (!datos || typeof datos !== 'object') return null;
    return datos;
  } catch {
    return null;
  }
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
