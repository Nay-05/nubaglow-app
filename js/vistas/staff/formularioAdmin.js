/**
 * ============================================================================
 * NUBAGLOW APP - CAMPOS REUTILIZABLES DE FORMULARIOS ADMINISTRATIVOS
 * ============================================================================
 * Los labels envuelven al control, por lo que no hacen falta ids duplicados.
 */

import { el } from '../../core/dom.js';

export function campoAdmin(etiqueta, control, clase = '') {
  return el(
    'label',
    { clase: `campo ${clase}`.trim() },
    el('span', { clase: 'campo-etiqueta', texto: etiqueta }),
    control
  );
}

export function campoAreaAdmin(etiqueta, control, clase = '') {
  return el(
    'label',
    { clase: `campo ${clase}`.trim() },
    el('span', { clase: 'campo-etiqueta', texto: etiqueta }),
    control
  );
}

export function campoCheckAdmin(etiqueta, control, clase = '') {
  return el(
    'label',
    { clase: `admin-check ${clase}`.trim() },
    control,
    el('span', { texto: etiqueta })
  );
}
