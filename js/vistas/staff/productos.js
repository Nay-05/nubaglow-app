/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: PRODUCTOS (/staff/productos)
 * ============================================================================
 */

import { vistaEnConstruccion } from '../comunes.js';

export const vistaProductos = {
  async render() {
    return vistaEnConstruccion({
      titulo: 'Gestión de productos',
      descripcion:
        'CRUD del catálogo con variantes, precios e imágenes. Exclusivo del rol administrador.',
      fase: 10,
      puntos: [
        'Alta, edición y desactivación de productos, categorías y variantes.',
        'Cambios de precio registrados en la tabla de auditoría.',
        'Control de imágenes y stock por cada variante.'
      ]
    });
  }
};
