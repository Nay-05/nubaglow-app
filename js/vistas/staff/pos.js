/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: POS (/staff/pos)
 * ============================================================================
 */

import { vistaEnConstruccion } from '../comunes.js';

export const vistaPos = {
  async render() {
    return vistaEnConstruccion({
      titulo: 'Punto de venta',
      descripcion:
        'Cobro presencial y por WhatsApp con búsqueda por SKU, carrito de mostrador y recibo académico en PDF.',
      fase: 8,
      puntos: [
        'Búsqueda instantánea de productos y variantes por nombre, categoría o SKU.',
        'Cálculo de totales y cambio en el servidor; el vendedor se toma del token.',
        'Historial de ventas del turno y cierre de caja.'
      ]
    });
  }
};
