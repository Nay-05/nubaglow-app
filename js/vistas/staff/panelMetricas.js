/**
 * ============================================================================
 * NUBAGLOW APP - COMPONENTES COMPARTIDOS DEL PANEL ADMINISTRATIVO
 * ============================================================================
 * Resume metricas web/POS y construye tarjetas, ranking y accesos rapidos.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs } from '../../core/formato.js';
import {
  crearCeldaStaff,
  crearTablaStaff
} from './tablaResponsiva.js';

export async function cargarMetricas({ desde, hasta } = {}) {
  const consulta = new URLSearchParams();
  if (desde) consulta.set('desde', desde);
  if (hasta) consulta.set('hasta', hasta);
  const sufijo = consulta.toString() ? `?${consulta.toString()}` : '';

  const [resumen, ingresos, ranking] = await Promise.all([
    api.obtener('/reportes/web-vs-pos'),
    api.obtener(`/reportes/ingresos-diarios${sufijo}`),
    api.obtener('/reportes/ranking?limite=10')
  ]);

  return {
    resumen: resumen?.datos || {},
    ingresos: ingresos?.datos || { dias: [], rango: {} },
    ranking: ranking?.datos?.ranking || []
  };
}

function tarjeta(etiqueta, valor, detalle, clase = '') {
  return el(
    'article',
    { clase: `admin-kpi ${clase}`.trim() },
    el('span', { clase: 'admin-kpi-etiqueta', texto: etiqueta }),
    el('strong', { clase: 'admin-kpi-valor', texto: valor }),
    el('span', { clase: 'admin-kpi-detalle', texto: detalle })
  );
}

export function crearTarjetasMetricas(resumen) {
  const web = resumen?.web || {};
  const pos = resumen?.pos || {};
  const total = Number(resumen?.granTotal) || 0;

  return el(
    'div',
    { clase: 'admin-kpis' },
    tarjeta(
      'Ingresos totales',
      formatearBs(total),
      'Tienda web + punto de venta',
      'destacada'
    ),
    tarjeta(
      'Tienda web',
      formatearBs(web.montoTotal),
      `${Number(web.totalPedidos) || 0} pedidos · ${web.porcentaje || 0}%`,
      'web'
    ),
    tarjeta(
      'Punto de venta',
      formatearBs(pos.montoTotal),
      `${Number(pos.totalTickets) || 0} tickets · ${pos.porcentaje || 0}%`,
      'pos'
    ),
    tarjeta(
      'Ticket promedio',
      formatearBs(
        Number(pos.totalTickets) > 0
          ? Number(pos.montoTotal) / Number(pos.totalTickets)
          : 0
      ),
      'Promedio por venta de mostrador',
      'promedio'
    )
  );
}

const COLUMNAS_RANKING = [
  { etiqueta: 'Puesto', clase: 'staff-col-codigo' },
  { etiqueta: 'Producto' },
  { etiqueta: 'Categoría' },
  { etiqueta: 'Unidades', clase: 'staff-numero' },
  { etiqueta: 'Ingresos', clase: 'staff-numero' }
];

export function crearTablaRanking(ranking) {
  const filas = (ranking || []).map((fila) =>
    el(
      'tr',
      {},
      crearCeldaStaff(
        'Puesto',
        el('strong', { texto: String(fila.puesto) }),
        'staff-col-codigo'
      ),
      crearCeldaStaff('Producto', el('span', { texto: fila.nombre })),
      crearCeldaStaff(
        'Categoría',
        el('span', { texto: fila.categoria || 'Sin categoría' })
      ),
      crearCeldaStaff(
        'Unidades',
        el('span', { texto: String(fila.unidadesVendidas) }),
        'staff-numero'
      ),
      crearCeldaStaff(
        'Ingresos',
        el('span', { texto: formatearBs(fila.ingresosGenerados) }),
        'staff-numero'
      )
    )
  );

  return el(
    'section',
    { clase: 'admin-panel' },
    el('h2', { clase: 'admin-panel-titulo', texto: 'Ranking de productos' }),
    el('p', {
      clase: 'texto-suave',
      texto: 'Unidades vendidas e ingresos combinados de web y POS.'
    }),
    crearTablaStaff(COLUMNAS_RANKING, filas)
  );
}

export function crearAccesosAdmin(modulos = []) {
  return el(
    'div',
    { clase: 'admin-accesos' },
    ...modulos.map((modulo) =>
      el(
        'a',
        {
          clase: 'admin-acceso',
          href: modulo.ruta,
          atributos: { 'data-ruta': '' }
        },
        el('span', { clase: 'admin-acceso-icono' }, icono(modulo.icono, 20)),
        el(
          'span',
          { clase: 'admin-acceso-texto' },
          el('strong', { texto: modulo.etiqueta }),
          el('span', { clase: 'texto-suave', texto: modulo.descripcion })
        )
      )
    )
  );
}
