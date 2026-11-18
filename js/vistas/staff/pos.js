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
        'Cobro presencial y por WhatsApp con busqueda por SKU, carrito de mostrador y recibo academico en PDF.',
      fase: 8,
      puntos: [
        'Busqueda instantanea de productos y variantes por nombre, categoria o SKU.',
        'Calculo de totales y cambio en el servidor; el vendedor se toma del token.',
        'Historial de ventas del turno y cierre de caja.'
      ]
    });
  }
};
