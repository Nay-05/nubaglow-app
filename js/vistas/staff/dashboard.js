/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: PANEL ADMINISTRATIVO (/staff/dashboard)
 * ============================================================================
 * Panel ejecutivo con ventas web vs POS, ingresos diarios y ranking. Los
 * permisos reales se validan otra vez en el backend con requerirRol('admin').
 */

import { el } from '../../core/dom.js';
import { alerta, encabezadoPagina } from '../comunes.js';
import {
  cargarMetricas,
  crearAccesosAdmin,
  crearTarjetasMetricas
} from './panelMetricas.js';
import {
  crearComparativoWebPos,
  crearGraficoIngresos,
  crearRankingBarras
} from './graficos.js';

export const vistaDashboard = {
  async render({ usuario }) {
    const contenido = el('div', { clase: 'admin-contenido' });
    const seccion = el(
      'section',
      { clase: 'pagina admin-metricas' },
      encabezadoPagina(
        `Hola, ${usuario?.nombre || 'administrador'}`,
        'Resumen ejecutivo de ventas, ingresos y productos destacados.'
      ),
      contenido
    );

    try {
      const metricas = await cargarMetricas();
      contenido.append(
        crearTarjetasMetricas(metricas.resumen),
        el(
          'div',
          { clase: 'admin-grid-graficos' },
          crearComparativoWebPos(metricas.resumen),
          crearGraficoIngresos(
            metricas.ingresos.dias.slice(0, 14),
            'Ingresos de los últimos 14 días'
          )
        ),
        crearRankingBarras(metricas.ranking, 'Productos más vendidos'),
        crearAccesosAdmin()
      );
    } catch (error) {
      contenido.replaceChildren(
        alerta(error.message || 'No se pudieron cargar las métricas.')
      );
    }

    return seccion;
  }
};
