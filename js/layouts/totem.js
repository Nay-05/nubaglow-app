/**
 * ============================================================================
 * NUBAGLOW APP - LAYOUT DEL TOTEM DE AUTOSERVICIO
 * ============================================================================
 * Pantalla completa, sin barra de navegacion publica ni sidebar del personal.
 * La vista del totem controla todo el flujo de compra y la impresion del ticket.
 */

import { el } from '../core/dom.js';

export function crearLayoutTotem() {
  const raiz = el('div', { clase: 'app-totem' });
  const contenido = el('main', {
    clase: 'totem-contenido',
    atributos: { id: 'contenido' }
  });

  raiz.appendChild(contenido);

  return { raiz, contenido };
}
