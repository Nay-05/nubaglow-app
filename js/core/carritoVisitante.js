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

function normalizarItem(item) {
  if (!item || typeof item !== 'object') return null;
  const varianteId = Number(item.varianteId);
  const cantidad = Number(item.cantidad);
  if (!Number.isInteger(varianteId) || varianteId <= 0) return null;
  if (!Number.isInteger(cantidad) || cantidad <= 0) return null;

  return {
    varianteId,
    productoId: Number(item.productoId) || 0,
    productoSlug: String(item.productoSlug || ''),
    productoNombre: String(item.productoNombre || ''),
    varianteNombre: String(item.varianteNombre || ''),
    precio: Number(item.precio) || 0,
    imagen: String(item.imagen || ''),
    cantidad
  };
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
    } else {
      items.push(nuevo);
    }

    window.localStorage.setItem(CLAVE_CARRITO_VISITANTE, JSON.stringify(items));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
