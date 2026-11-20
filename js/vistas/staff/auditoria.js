/**
 * ============================================================================
 * NUBAGLOW APP - VISOR DE AUDITORIA DEL PORTAL ADMIN
 * ============================================================================
 * Consulta de solo lectura con filtros por usuario, accion y fecha local.
 * Los detalles JSON se muestran como texto seguro dentro de un <pre>.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearFecha } from '../../core/formato.js';
import { alerta, boton, estadoVacio } from '../comunes.js';
import {
  crearCeldaStaff,
  crearTablaStaff
} from './tablaResponsiva.js';

const COLUMNAS = [
  { etiqueta: 'Fecha' },
  { etiqueta: 'Usuario' },
  { etiqueta: 'Acción' },
  { etiqueta: 'Registro' },
  { etiqueta: 'Detalle' }
];

function textoDetalle(detalles) {
  if (detalles === null || detalles === undefined) return 'Sin detalle';
  let valor = detalles;
  if (typeof detalles === 'string') {
    try {
      valor = JSON.parse(detalles);
    } catch {
      return detalles;
    }
  }
  try {
    return JSON.stringify(valor, null, 2);
  } catch {
    return String(detalles);
  }
}

function crearFilaAuditoria(registro) {
  const detalle = el(
    'details',
    { clase: 'auditoria-detalle' },
    el('summary', { texto: 'Ver detalle' }),
    el('pre', {
      clase: 'auditoria-json',
      texto: textoDetalle(registro.detalles)
    })
  );
  const registroTexto = registro.tablaAfectada
    ? `${registro.tablaAfectada} #${registro.registroId ?? '-'}`
    : 'Sin registro';

  return el(
    'tr',
    {},
    crearCeldaStaff(
      'Fecha',
      el('span', { texto: formatearFecha(registro.creadoEn) })
    ),
    crearCeldaStaff(
      'Usuario',
      el(
        'div',
        { clase: 'auditoria-usuario' },
        el('strong', { texto: registro.usuarioNombre || 'Sistema' }),
        registro.usuarioEmail
          ? el('span', { texto: registro.usuarioEmail })
          : null
      )
    ),
    crearCeldaStaff(
      'Acción',
      el('span', { clase: 'auditoria-accion', texto: registro.accion })
    ),
    crearCeldaStaff('Registro', el('span', { texto: registroTexto })),
    crearCeldaStaff('Detalle', detalle)
  );
}

export function crearVisorAuditoria({ limite = 20 } = {}) {
  const seccion = el('section', {
    clase: 'admin-panel auditoria-panel'
  });
  const encabezado = el(
    'div',
    { clase: 'admin-panel-cabecera' },
    el(
      'div',
      {},
      el('h2', { clase: 'admin-panel-titulo', texto: 'Visor de auditoría' }),
      el('p', {
        clase: 'texto-suave',
        texto:
          'Registro inmutable de acciones críticas con usuario y fecha.'
      })
    )
  );

  const selectUsuario = el(
    'select',
    { clase: 'entrada', atributos: { 'aria-label': 'Filtrar por usuario' } },
    el('option', { value: '', texto: 'Todos los usuarios' })
  );
  const selectAccion = el(
    'select',
    { clase: 'entrada', atributos: { 'aria-label': 'Filtrar por acción' } },
    el('option', { value: '', texto: 'Todas las acciones' })
  );
  const fecha = el('input', {
    clase: 'entrada',
    type: 'date',
    atributos: { 'aria-label': 'Filtrar por fecha' }
  });
  const filtrar = boton('Filtrar', {
    tipo: 'submit',
    variante: 'primary',
    clase: 'btn-pequeno',
    nombreIcono: 'buscar'
  });
  const limpiar = boton('Limpiar', {
    tipo: 'button',
    variante: 'outline',
    clase: 'btn-pequeno'
  });
  const formulario = el(
    'form',
    { clase: 'auditoria-filtros' },
    el(
      'label',
      { clase: 'campo' },
      el('span', { clase: 'campo-etiqueta', texto: 'Usuario' }),
      selectUsuario
    ),
    el(
      'label',
      { clase: 'campo' },
      el('span', { clase: 'campo-etiqueta', texto: 'Acción' }),
      selectAccion
    ),
    el(
      'label',
      { clase: 'campo' },
      el('span', { clase: 'campo-etiqueta', texto: 'Fecha' }),
      fecha
    ),
    el('div', { clase: 'auditoria-filtros-acciones' }, filtrar, limpiar)
  );
  const mensajes = el('div', { clase: 'admin-mensajes' });
  const tabla = el('div', { clase: 'auditoria-tabla' });
  const paginacion = el('div', { clase: 'auditoria-paginacion' });

  let paginaActual = 1;
  let totalPaginas = 1;
  const anterior = el(
    'button',
    {
      clase: 'btn btn-outline btn-pequeno',
      atributos: { type: 'button' }
    },
    icono('flechaIzquierda', 14),
    el('span', { texto: 'Anterior' })
  );
  const siguiente = el(
    'button',
    {
      clase: 'btn btn-outline btn-pequeno',
      atributos: { type: 'button' }
    },
    el('span', { texto: 'Siguiente' }),
    icono('flecha', 14)
  );
  const indicador = el('span', { clase: 'texto-suave' });

  async function cargarOpciones() {
    const respuesta = await api.obtener('/reportes/auditoria/opciones');
    const datos = respuesta?.datos || {};
    for (const accion of datos.acciones || []) {
      selectAccion.appendChild(
        el('option', { value: accion, texto: accion })
      );
    }
    for (const usuario of datos.usuarios || []) {
      selectUsuario.appendChild(
        el('option', {
          value: String(usuario.id),
          texto: `${usuario.nombre} · ${usuario.email}`
        })
      );
    }
  }

  function actualizarPaginacion(datos) {
    totalPaginas = Number(datos?.paginacion?.totalPaginas) || 1;
    const total = Number(datos?.paginacion?.total) || 0;
    anterior.disabled = paginaActual <= 1;
    siguiente.disabled = paginaActual >= totalPaginas;
    indicador.textContent =
      `Pagina ${paginaActual} de ${totalPaginas} · ${total} registros`;
  }

  async function cargar(pagina = 1) {
    paginaActual = pagina;
    mensajes.replaceChildren();
    tabla.replaceChildren(
      el('p', { clase: 'cargando', texto: 'Cargando auditoría...' })
    );

    const consulta = new URLSearchParams();
    consulta.set('pagina', String(pagina));
    consulta.set('limite', String(limite));
    if (selectUsuario.value) {
      consulta.set('usuario_id', selectUsuario.value);
    }
    if (selectAccion.value) {
      consulta.set('accion', selectAccion.value);
    }
    if (fecha.value) consulta.set('fecha', fecha.value);

    try {
      const respuesta = await api.obtener(
        `/reportes/auditoria?${consulta.toString()}`
      );
      const datos = respuesta?.datos || {};
      const registros = datos.registros || [];
      if (registros.length === 0) {
        tabla.replaceChildren(
          estadoVacio('No hay registros de auditoría para esos filtros.')
        );
      } else {
        tabla.replaceChildren(
          crearTablaStaff(COLUMNAS, registros.map(crearFilaAuditoria))
        );
      }
      actualizarPaginacion(datos);
    } catch (error) {
      tabla.replaceChildren();
      mensajes.replaceChildren(
        alerta(error.message || 'No se pudo cargar la auditoría.')
      );
    }
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    cargar(1);
  });
  limpiar.addEventListener('click', () => {
    selectUsuario.value = '';
    selectAccion.value = '';
    fecha.value = '';
    cargar(1);
  });
  anterior.addEventListener('click', () => {
    if (paginaActual > 1) cargar(paginaActual - 1);
  });
  siguiente.addEventListener('click', () => {
    if (paginaActual < totalPaginas) cargar(paginaActual + 1);
  });

  paginacion.append(anterior, indicador, siguiente);
  seccion.append(encabezado, formulario, mensajes, tabla, paginacion);

  (async () => {
    try {
      await cargarOpciones();
      await cargar(1);
    } catch (error) {
      mensajes.replaceChildren(
        alerta(error.message || 'No se pudieron cargar las opciones.')
      );
    }
  })();

  return seccion;
}
