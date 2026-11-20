/**
 * ============================================================================
 * NUBAGLOW APP - TABLA RESPONSIVA DEL PORTAL INTERNO
 * ============================================================================
 * En escritorio renderiza una tabla HTML real. En móvil, el CSS oculta el
 * thead y convierte cada tr en una tarjeta usando el atributo data-label.
 */

import { el } from '../../core/dom.js';

export function crearTablaStaff(columnas, filas) {
  const cabeceras = columnas.map((columna) =>
    el('th', {
      clase: columna.clase || '',
      atributos: { scope: 'col' },
      texto: columna.etiqueta
    })
  );

  return el(
    'div',
    { clase: 'staff-tabla-contenedor' },
    el(
      'table',
      { clase: 'staff-tabla' },
      el('thead', {}, el('tr', {}, ...cabeceras)),
      el('tbody', {}, ...filas)
    )
  );
}

export function crearCeldaStaff(etiqueta, contenido, clase = '') {
  return el(
    'td',
    { clase, atributos: { 'data-label': etiqueta } },
    contenido
  );
}
