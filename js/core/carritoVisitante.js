/**
 * ============================================================================
 * NUBAGLOW APP - CARRITO TEMPORAL DE VISITANTE
 * ============================================================================
 * Respaldo en localStorage para usuarios sin sesion (CLAUDE.md Seccion 7A).
 * Nunca guarda tokens ni datos sensibles: solo la variante y su cantidad.
 * Todo acceso a localStorage esta protegido con try/catch porque puede estar
 * deshabilitado por el navegador o lanzar errores de cuota.
 */

export const CLAVE_CARRITO_VISITANTE = 'nubaglow:carrito-visitante';
export const EVENTO_CARRITO = 'nubaglow:carrito-actualizado';

/**
 * Avisa a la cabecera y al mini-carrito que el carrito cambio.
 * Nunca transporta datos sensibles: solo indicadores de interfaz.
 */
export function notificarCarritoActualizado(opciones = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent(EVENTO_CARRITO, {
        detail: {
          abrir: Boolean(opciones.abrir),
          origen: opciones.origen || ''
        }
      })
    );
  } catch {
    /* Entornos sin CustomEvent (pruebas) no requieren el aviso. */
  }
}

function normalizarItem(item) {
  if (!item || typeof item !== 'object') return null;
  const varianteId = Number(item.varianteId);
  const cantidad = Number(item.cantidad);
  if (!Number.isInteger(varianteId) || varianteId <= 0) return null;
  if (!Number.isInteger(cantidad) || cantidad <= 0) return null;

  const stockCrudo = item.stockDisponible;
  const stock =
    stockCrudo === null || stockCrudo === undefined || stockCrudo === ''
      ? null
      : Number(stockCrudo);

  return {
    varianteId,
    productoId: Number(item.productoId) || 0,
    productoSlug: String(item.productoSlug || ''),
    productoNombre: String(item.productoNombre || ''),
    varianteNombre: String(item.varianteNombre || ''),
    precio: Number(item.precio) || 0,
    imagen: String(item.imagen || ''),
    cantidad,
    stockDisponible: Number.isFinite(stock) ? stock : null
  };
}

function guardarCarritoVisitante(items) {
  try {
    const normalizados = items.map(normalizarItem).filter(Boolean);
    window.localStorage.setItem(CLAVE_CARRITO_VISITANTE, JSON.stringify(normalizados));
    return true;
  } catch {
    return false;
  }
}

export function leerCarritoVisitante() {
  try {
    const crudo = window.localStorage.getItem(CLAVE_CARRITO_VISITANTE);
    if (!crudo) return [];
    const datos = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos.map(normalizarItem).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Agrega una variante o incrementa su cantidad si ya existe.
 * Devuelve { ok: true } o { ok: false } para que la vista muestre un aviso.
 */
export function agregarAlCarritoVisitante(item) {
  const nuevo = normalizarItem(item);
  if (!nuevo) return { ok: false };

  try {
    const items = leerCarritoVisitante();
    const existente = items.find((actual) => actual.varianteId === nuevo.varianteId);

    if (existente) {
      existente.cantidad += nuevo.cantidad;
      if (nuevo.stockDisponible !== null) existente.stockDisponible = nuevo.stockDisponible;
    } else {
      items.push(nuevo);
    }

    if (!guardarCarritoVisitante(items)) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Cambia la cantidad de una variante del carrito de visitante.
 */
export function cambiarCantidadVisitante(varianteId, cantidad) {
  const id = Number(varianteId);
  const nuevaCantidad = Number(cantidad);
  if (!Number.isInteger(id) || id <= 0) return { ok: false };
  if (!Number.isInteger(nuevaCantidad) || nuevaCantidad <= 0) return { ok: false };

  try {
    const items = leerCarritoVisitante();
    const item = items.find((actual) => actual.varianteId === id);
    if (!item) return { ok: false };

    item.cantidad = nuevaCantidad;
    if (!guardarCarritoVisitante(items)) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Elimina una variante del carrito de visitante.
 */
export function eliminarItemVisitante(varianteId) {
  const id = Number(varianteId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false };

  try {
    const items = leerCarritoVisitante().filter((item) => item.varianteId !== id);
    if (!guardarCarritoVisitante(items)) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Vacia el respaldo local una vez fusionado con la cuenta del cliente.
 */
export function vaciarCarritoVisitante() {
  return guardarCarritoVisitante([]);
}
