/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: PRODUCTOS (/staff/productos)
 * ============================================================================
 */

import { vistaEnConstruccion } from '../comunes.js';

export const vistaProductos = {
  async render() {
    return vistaEnConstruccion({
      titulo: 'Gestion de productos',
      descripcion:
        'CRUD del catalogo con variantes, precios e imagenes. Exclusivo del rol administrador.',
      fase: 10,
      puntos: [
        'Alta, edicion y desactivacion de productos, categorias y variantes.',
        'Cambios de precio registrados en la tabla de auditoria.',
        'Control de imagenes y stock por cada variante.'
      ]
    });
  }
};
