/**
 * ============================================================================
 * NUBAGLOW APP - SELECTOR DE DISENOS
 * ============================================================================
 * El router recibe esta funcion para envolver cada vista en el layout correcto:
 * publico (tienda), auth (login centrado) o staff (sidebar por rol).
 */

import { crearLayoutPublico } from './publico.js';
import { crearLayoutAutenticacion } from './auth.js';
import { crearLayoutStaff } from './staff.js';

export function crearDiseno(diseno, contexto) {
  if (diseno === 'staff') return crearLayoutStaff(contexto);
  if (diseno === 'auth') {
    return crearLayoutAutenticacion({ titulo: contexto.titulo || 'Acceso al sistema' });
  }
  return crearLayoutPublico(contexto);
}
