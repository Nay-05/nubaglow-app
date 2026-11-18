/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: REPORTES (/staff/reportes)
 * ============================================================================
 */

import { vistaEnConstruccion } from '../comunes.js';

export const vistaReportes = {
  async render() {
    return vistaEnConstruccion({
      titulo: 'Reportes gerenciales',
      descripcion:
        'Ventas web frente a POS, ingresos por dia y ranking de productos mas vendidos.',
      fase: 10,
      puntos: [
        'Comparativa de ingresos entre tienda web y punto de venta.',
        'Evolucion diaria de ventas y ticket promedio.',
        'Ranking de productos y visor de auditoria de acciones criticas.'
      ]
    });
  }
};
