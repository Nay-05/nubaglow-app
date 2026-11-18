/**
 * ============================================================================
 * NUBAGLOW APP - COMPONENTES COMUNES DE VISTA
 * ============================================================================
 * Todos los datos dinamicos se pintan con textContent o nodos, nunca con
 * innerHTML (CLAUDE.md Seccion 9).
 */

import { el, icono } from '../core/dom.js';
import { formatearBs } from '../core/formato.js';

export function encabezadoPagina(titulo, descripcion, extra) {
  return el(
    'header',
    { clase: 'encabezado-pagina' },
    el('h1', { texto: titulo }),
    descripcion ? el('p', { clase: 'texto-suave', texto: descripcion }) : null,
    extra || null
  );
}

export function alerta(mensaje, tipo = 'error') {
  return el('div', {
    clase: `alerta alerta-${tipo}`,
    atributos: { role: tipo === 'error' ? 'alert' : 'status' },
    texto: mensaje
  });
}

export function campo({
  etiqueta,
  nombre,
  tipo = 'text',
  placeholder,
  autocomplete,
  requerido = true,
  ayuda,
  valor
}) {
  const id = `campo-${nombre}`;
  const entrada = el('input', {
    clase: 'entrada',
    id,
    type: tipo,
    name: nombre,
    placeholder,
    required: requerido,
    value: valor,
    atributos: {
      ...(autocomplete ? { autocomplete } : {}),
      ...(ayuda ? { 'aria-describedby': `${id}-ayuda` } : {})
    }
  });

  return el(
    'div',
    { clase: 'campo' },
    el('label', { clase: 'campo-etiqueta', atributos: { for: id }, texto: etiqueta }),
    entrada,
    ayuda
      ? el('small', { clase: 'campo-ayuda', atributos: { id: `${id}-ayuda` }, texto: ayuda })
      : null
  );
}

export function areaTexto({ etiqueta, nombre, filas = 3, placeholder, requerido = false }) {
  const id = `campo-${nombre}`;
  const entrada = el('textarea', {
    clase: 'entrada entrada-area',
    id,
    name: nombre,
    placeholder,
    required: requerido,
    rows: filas
  });

  return el(
    'div',
    { clase: 'campo' },
    el('label', { clase: 'campo-etiqueta', atributos: { for: id }, texto: etiqueta }),
    entrada
  );
}

export function boton(texto, { tipo = 'submit', variante = 'primary', nombreIcono, clase } = {}) {
  return el(
    'button',
    {
      clase: `btn btn-${variante}${clase ? ` ${clase}` : ''}`,
      atributos: { type: tipo }
    },
    nombreIcono ? icono(nombreIcono, 16) : null,
    el('span', { texto })
  );
}

export function enlaceInterno(ruta, etiqueta, { clase = 'enlace', nombreIcono } = {}) {
  return el(
    'a',
    { clase, href: ruta, atributos: { 'data-ruta': '' } },
    nombreIcono ? icono(nombreIcono, 16) : null,
    el('span', { texto: etiqueta })
  );
}

export function vistaEnConstruccion({ titulo, descripcion, fase, puntos = [] }) {
  return el(
    'section',
    { clase: 'pagina' },
    encabezadoPagina(titulo, descripcion),
    el(
      'div',
      { clase: 'panel-nota' },
      el('h2', { clase: 'panel-nota-titulo', texto: 'Modulo en construccion' }),
      el('p', {
        texto: `Esta vista forma parte de la Fase ${fase} del plan del proyecto. En la Fase 4 queda habilitada la navegacion, el layout y los permisos por rol.`
      }),
      puntos.length
        ? el(
            'ul',
            { clase: 'lista-puntos' },
            ...puntos.map((punto) => el('li', { texto: punto }))
          )
        : null
    ),
    enlaceInterno('/catalogo', 'Ir al catalogo publico', { clase: 'btn btn-outline' })
  );
}

export function estadoVacio(mensaje) {
  return el('p', { clase: 'estado-vacio', texto: mensaje });
}

export function tabla(cabeceras, filas, { clase } = {}) {
  return el(
    'div',
    { clase: 'tabla-contenedor' },
    el(
      'table',
      { clase: `tabla${clase ? ` ${clase}` : ''}` },
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          ...cabeceras.map((cabecera) => el('th', { atributos: { scope: 'col' }, texto: cabecera }))
        )
      ),
      el(
        'tbody',
        {},
        ...filas.map((fila) =>
          el(
            'tr',
            {},
            ...fila.map((celda) =>
              el('td', {}, celda instanceof Node ? celda : el('span', { texto: celda }))
            )
          )
        )
      )
    )
  );
}

export function imagenProducto(url, alt) {
  const esRelativaSegura =
    typeof url === 'string' &&
    (url.startsWith('/') && !url.startsWith('//') || url.startsWith('assets/'));
  const fuente = esRelativaSegura ? url : '/assets/brand/icono1.png';

  return el('img', { clase: 'imagen-producto', src: fuente, alt: alt || 'Producto NubaGlow' });
}

export function precioRango(min, max) {
  const precioMin = Number(min) || 0;
  const precioMax = Number(max) || 0;
  if (precioMax > precioMin) {
    return `${formatearBs(precioMin)} - ${formatearBs(precioMax)}`;
  }
  return formatearBs(precioMin);
}
