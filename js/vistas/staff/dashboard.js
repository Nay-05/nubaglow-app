/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: PANEL ADMINISTRATIVO (/staff/dashboard)
 * ============================================================================
 * Bienvenida editorial con accesos a todos los módulos, KPIs, gráficos SVG,
 * ranking y tarjeta de seguridad del portal. Solo el rol admin llega aquí.
 */

import { el } from '../../core/dom.js';
import { ETIQUETA_ROL, modulosPermitidos } from '../../core/permisos.js';
import { alerta } from '../comunes.js';
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

function crearSeguridadPortal() {
  return el(
    'section',
    { clase: 'admin-panel admin-seguridad' },
    el('h2', { clase: 'admin-panel-titulo', texto: 'Seguridad del portal' }),
    el('p', {
      texto:
        'Cada módulo valida el rol en el servidor con JWT, RBAC y protección ' +
        'CSRF. Los cambios críticos de productos, pagos, envíos y usuarios ' +
        'quedan registrados en la auditoría.'
    })
  );
}

export const vistaDashboard = {
  async render({ usuario }) {
    const rol = usuario?.rol || 'admin';
    const modulos = modulosPermitidos(rol);
    const nombre = usuario?.nombre || 'administrador';
    const contenido = el('div', { clase: 'admin-contenido' });
    const bienvenida = el(
      'section',
      { clase: 'admin-bienvenida' },
      el('p', { clase: 'admin-kicker', texto: 'Panel de administración' }),
      el('h1', { clase: 'admin-bienvenida-titulo', texto: `Hola, ${nombre}` }),
      el('p', {
        clase: 'admin-bienvenida-texto',
        texto:
          `Sesión activa como ${ETIQUETA_ROL[rol] || rol}. ` +
          'Elige un módulo para trabajar.'
      }),
      crearAccesosAdmin(modulos)
    );
    const seccion = el(
      'section',
      { clase: 'pagina admin-metricas' },
      bienvenida,
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
        crearSeguridadPortal()
      );
    } catch (error) {
      contenido.replaceChildren(
        alerta(error.message || 'No se pudieron cargar las métricas.')
      );
    }

    return seccion;
  }
};
