/**
 * ============================================================================
 * NUBAGLOW APP - GRAFICOS SVG PARA EL PANEL ADMINISTRATIVO
 * ============================================================================
 * Sin librerias externas ni innerHTML. Todo se construye con createElementNS
 * y atributos SVG; los colores se definen en CSS con la paleta de NubaGlow.
 */

import { el } from '../../core/dom.js';
import { formatearBs } from '../../core/formato.js';
import { estadoVacio } from '../comunes.js';

const NS_SVG = 'http://www.w3.org/2000/svg';

function svgNodo(etiqueta, atributos = {}, texto = null) {
  const nodo = document.createElementNS(NS_SVG, etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === null) continue;
    nodo.setAttribute(nombre, String(valor));
  }
  if (texto !== null) nodo.textContent = String(texto);
  return nodo;
}

function montoEje(valor) {
  const numero = Number(valor) || 0;
  if (Math.abs(numero) >= 1000) {
    return `Bs. ${(numero / 1000).toFixed(1)}k`;
  }
  return `Bs. ${Math.round(numero)}`;
}

function fechaCorta(fecha) {
  const texto = String(fecha || '');
  if (texto.length < 10) return texto;
  return `${texto.slice(8, 10)}/${texto.slice(5, 7)}`;
}

function recortar(texto, maximo) {
  const valor = String(texto || '');
  if (valor.length <= maximo) return valor;
  return `${valor.slice(0, maximo - 1)}...`;
}

export function crearComparativoWebPos(resumen) {
  const web = Number(resumen?.web?.montoTotal) || 0;
  const pos = Number(resumen?.pos?.montoTotal) || 0;
  const total = web + pos;
  const ancho = 640;
  const alto = 86;
  const barra = svgNodo('rect', {
    x: 20,
    y: 18,
    width: ancho - 40,
    height: 30,
    rx: 8,
    class: 'admin-grafico-fondo'
  });
  const partes = [];

  if (total > 0) {
    const anchoUtil = ancho - 40;
    const anchoWeb = (web / total) * anchoUtil;
    const anchoPos = (pos / total) * anchoUtil;
    if (web > 0) {
      partes.push(
        svgNodo('rect', {
          x: 20,
          y: 18,
          width: Math.max(2, anchoWeb),
          height: 30,
          rx: 8,
          class: 'admin-grafico-barra-web'
        })
      );
    }
    if (pos > 0) {
      partes.push(
        svgNodo('rect', {
          x: 20 + anchoWeb,
          y: 18,
          width: Math.max(2, anchoPos),
          height: 30,
          rx: 8,
          class: 'admin-grafico-barra-pos'
        })
      );
    }
  }

  const etiquetaWeb = `Web: ${formatearBs(web)}`;
  const etiquetaPos = `POS: ${formatearBs(pos)}`;
  const totalTexto = `Total: ${formatearBs(total)}`;

  const svg = svgNodo(
    'svg',
    {
      viewBox: `0 0 ${ancho} ${alto}`,
      class: 'admin-grafico-svg',
      role: 'img',
      'aria-label': `Ventas web ${etiquetaWeb}, POS ${etiquetaPos}`
    },
    null
  );
  svg.append(
    svgNodo('title', {}, 'Comparativo de ventas web y POS'),
    barra,
    ...partes,
    svgNodo(
      'text',
      { x: 20, y: 70, class: 'admin-grafico-leyenda' },
      etiquetaWeb
    ),
    svgNodo(
      'text',
      { x: ancho - 20, y: 70, class: 'admin-grafico-leyenda', 'text-anchor': 'end' },
      etiquetaPos
    )
  );

  return el(
    'section',
    { clase: 'admin-panel admin-grafico' },
    el('h2', { clase: 'admin-panel-titulo', texto: 'Ventas web vs. POS' }),
    el('p', { clase: 'texto-suave', texto: totalTexto }),
    svg,
    el(
      'div',
      { clase: 'admin-leyenda' },
      el('span', { clase: 'admin-leyenda-item' },
        el('i', { clase: 'admin-leyenda-color web' }),
        el('span', { texto: 'Tienda web' })
      ),
      el('span', { clase: 'admin-leyenda-item' },
        el('i', { clase: 'admin-leyenda-color pos' }),
        el('span', { texto: 'Punto de venta' })
      )
    )
  );
}

export function crearGraficoIngresos(dias, titulo = 'Ingresos por día') {
  const datos = Array.isArray(dias) ? dias.slice(0, 30).reverse() : [];
  if (datos.length === 0) {
    return el(
      'section',
      { clase: 'admin-panel admin-grafico' },
      el('h2', { clase: 'admin-panel-titulo', texto: titulo }),
      estadoVacio('Todavía no hay ingresos registrados.')
    );
  }

  const ancho = 720;
  const alto = 280;
  const margenIzq = 58;
  const margenDer = 18;
  const margenSup = 20;
  const margenInf = 44;
  const anchoUtil = ancho - margenIzq - margenDer;
  const altoUtil = alto - margenSup - margenInf;
  const maximo = Math.max(
    1,
    ...datos.map((d) => Number(d.totalDia) || 0)
  );
  const paso = anchoUtil / datos.length;
  const anchoBarra = Math.min(16, paso * 0.26);
  const svg = svgNodo('svg', {
    viewBox: `0 0 ${ancho} ${alto}`,
    class: 'admin-grafico-svg',
    role: 'img',
    'aria-label': `${titulo}: ${datos.length} días`
  });

  svg.appendChild(svgNodo('title', {}, titulo));
  for (let i = 0; i <= 4; i += 1) {
    const valor = (maximo / 4) * i;
    const y = margenSup + altoUtil - (valor / maximo) * altoUtil;
    svg.appendChild(
      svgNodo('line', {
        x1: margenIzq,
        y1: y,
        x2: ancho - margenDer,
        y2: y,
        class: 'admin-grafico-grid'
      })
    );
    svg.appendChild(
      svgNodo(
        'text',
        {
          x: margenIzq - 8,
          y: y + 3,
          class: 'admin-grafico-eje',
          'text-anchor': 'end'
        },
        montoEje(valor)
      )
    );
  }

  const cadaEtiqueta = Math.max(1, Math.ceil(datos.length / 8));
  datos.forEach((dia, indice) => {
    const centro = margenIzq + paso * indice + paso / 2;
    const valorWeb = Number(dia.ingresosWeb) || 0;
    const valorPos = Number(dia.ingresosPos) || 0;
    const altoWeb = (valorWeb / maximo) * altoUtil;
    const altoPos = (valorPos / maximo) * altoUtil;
    const xWeb = centro - anchoBarra - 2;
    const xPos = centro + 2;
    const base = margenSup + altoUtil;

    svg.appendChild(
      svgNodo('rect', {
        x: xWeb,
        y: base - altoWeb,
        width: anchoBarra,
        height: altoWeb,
        rx: 3,
        class: 'admin-grafico-barra-web'
      })
    );
    svg.appendChild(
      svgNodo('rect', {
        x: xPos,
        y: base - altoPos,
        width: anchoBarra,
        height: altoPos,
        rx: 3,
        class: 'admin-grafico-barra-pos'
      })
    );

    if (indice % cadaEtiqueta === 0) {
      svg.appendChild(
        svgNodo(
          'text',
          {
            x: centro,
            y: alto - 16,
            class: 'admin-grafico-eje',
            'text-anchor': 'middle'
          },
          fechaCorta(dia.fecha)
        )
      );
    }
  });

  return el(
    'section',
    { clase: 'admin-panel admin-grafico' },
    el('h2', { clase: 'admin-panel-titulo', texto: titulo }),
    el('p', {
      clase: 'texto-suave',
      texto: 'Últimos días con movimiento, calculados en hora de Bolivia.'
    }),
    svg,
    el(
      'div',
      { clase: 'admin-leyenda' },
      el('span', { clase: 'admin-leyenda-item' },
        el('i', { clase: 'admin-leyenda-color web' }),
        el('span', { texto: 'Web' })
      ),
      el('span', { clase: 'admin-leyenda-item' },
        el('i', { clase: 'admin-leyenda-color pos' }),
        el('span', { texto: 'POS' })
      )
    )
  );
}

export function crearRankingBarras(ranking, titulo = 'Más vendidos') {
  const filas = Array.isArray(ranking) ? ranking.slice(0, 5) : [];
  if (filas.length === 0) {
    return el(
      'section',
      { clase: 'admin-panel admin-grafico' },
      el('h2', { clase: 'admin-panel-titulo', texto: titulo }),
      estadoVacio('Sin ventas registradas.')
    );
  }

  const ancho = 640;
  const altoFila = 42;
  const alto = filas.length * altoFila + 16;
  const labelAncho = 210;
  const barraMax = ancho - labelAncho - 84;
  const maximo = Math.max(
    1,
    ...filas.map((fila) => Number(fila.unidadesVendidas) || 0)
  );
  const svg = svgNodo('svg', {
    viewBox: `0 0 ${ancho} ${alto}`,
    class: 'admin-grafico-svg',
    role: 'img',
    'aria-label': titulo
  });

  svg.appendChild(svgNodo('title', {}, titulo));
  filas.forEach((fila, indice) => {
    const y = 10 + indice * altoFila;
    const unidades = Number(fila.unidadesVendidas) || 0;
    const largo = Math.max(3, (unidades / maximo) * barraMax);
    svg.appendChild(
      svgNodo(
        'text',
        { x: 0, y: y + 18, class: 'admin-grafico-etiqueta' },
        recortar(fila.nombre, 28)
      )
    );
    svg.appendChild(
      svgNodo('rect', {
        x: labelAncho,
        y: y + 4,
        width: barraMax,
        height: 16,
        rx: 5,
        class: 'admin-grafico-fondo'
      })
    );
    svg.appendChild(
      svgNodo('rect', {
        x: labelAncho,
        y: y + 4,
        width: largo,
        height: 16,
        rx: 5,
        class: 'admin-grafico-barra-ranking'
      })
    );
    svg.appendChild(
      svgNodo(
        'text',
        { x: ancho - 4, y: y + 18, class: 'admin-grafico-valor', 'text-anchor': 'end' },
        `${unidades} ${unidades === 1 ? 'ud.' : 'uds.'}`
      )
    );
  });

  return el(
    'section',
    { clase: 'admin-panel admin-grafico' },
    el('h2', { clase: 'admin-panel-titulo', texto: titulo }),
    svg
  );
}
