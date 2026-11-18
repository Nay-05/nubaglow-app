/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: 404
 * ============================================================================
 */

import { el } from '../../core/dom.js';
import { enlaceInterno } from '../comunes.js';

export const vistaNoEncontrada = {
  async render() {
    return el(
      'section',
      { clase: 'pagina pagina-404' },
      el('p', { clase: 'hero-etiqueta', texto: 'Error 404' }),
      el('h1', { texto: 'No encontramos esta pagina' }),
      el('p', {
        clase: 'texto-suave',
        texto: 'La direccion que abriste no existe o fue movida. Puedes volver al inicio.'
      }),
      enlaceInterno('/', 'Volver al inicio', { clase: 'btn btn-primary', nombreIcono: 'inicio' })
    );
  }
};
