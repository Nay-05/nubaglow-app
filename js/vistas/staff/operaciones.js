/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: OPERACIONES (/staff/operaciones)
 * ============================================================================
 */

import { vistaEnConstruccion } from '../comunes.js';

export const vistaOperaciones = {
  async render() {
    return vistaEnConstruccion({
      titulo: 'Operaciones',
      descripcion:
        'Modulo unificado de almacen y logistica: inventario por variante y cola de despachos con seguimiento.',
      fase: 9,
      puntos: [
        'Alertas de stock bajo y registro de ingresos o ajustes con motivo y responsable.',
        'Cola de pedidos pendientes de despacho y cambios de estado paso a paso.',
        'Cada movimiento y cambio de estado queda auditado con fecha y usuario.'
      ]
    });
  }
};
