/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: REPORTES GERENCIALES (/staff/reportes)
 * ============================================================================
 * Metricas completas de ventas, ingresos por dia, ranking de productos y
 * visor de auditoria filtrable. Exclusivo del rol administrador.
 */

import { el } from '../../core/dom.js';
import { alerta, encabezadoPagina } from '../comunes.js';
import {
  cargarMetricas,
  crearTablaRanking,
  crearTarjetasMetricas
} from './panelMetricas.js';
import {
  crearComparativoWebPos,
  crearGraficoIngresos
} from './graficos.js';
import { crearVisorAuditoria } from './auditoria.js';

export const vistaReportes = {
  async render() {
    const contenido = el('div', { clase: 'admin-contenido' });
    const seccion = el(
      'section',
      { clase: 'pagina admin-metricas' },
      encabezadoPagina(
        'Reportes gerenciales',
        'Ventas web frente a POS, ingresos diarios, ranking y auditoría.'
      ),
      contenido
    );

    try {
      const metricas = await cargarMetricas();
      const rango = metricas.ingresos.rango || {};
      contenido.append(
        crearTarjetasMetricas(metricas.resumen),
        el(
          'div',
          { clase: 'admin-grid-graficos' },
          crearComparativoWebPos(metricas.resumen),
          crearGraficoIngresos(metricas.ingresos.dias, 'Ingresos por día')
        ),
        el('p', {
          clase: 'texto-suave admin-rango',
          texto:
            'Rango consultado: ' +
            `${rango.desde || 'sin fecha'} al ${rango.hasta || 'sin fecha'}.`
        }),
        crearTablaRanking(metricas.ranking)
      );
    } catch (error) {
      contenido.append(
        alerta(error.message || 'No se pudieron cargar las métricas.')
      );
    }

    contenido.append(crearVisorAuditoria({ limite: 20 }));
    return seccion;
  }
};
