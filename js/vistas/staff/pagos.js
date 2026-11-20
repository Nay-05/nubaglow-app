/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: VERIFICACION DE PAGOS (/staff/pagos)
 * ============================================================================
 * Solo vendedor y admin. El backend vuelve a validar permisos en cada llamada.
 * Todo el DOM se crea con helpers seguros, sin innerHTML.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs, formatearFecha } from '../../core/formato.js';
import { alerta, boton, estadoVacio } from '../comunes.js';
import {
  crearCeldaStaff,
  crearTablaStaff
} from './tablaResponsiva.js';

const ESTADOS = ['En verificación', 'Aprobado', 'Rechazado'];

const ETIQUETAS_METODO = {
  qr_simple: 'QR simple',
  qr: 'QR simple',
  deposito_bancario: 'Depósito bancario',
  paypal: 'PayPal',
  contra_entrega: 'Contra entrega'
};

function etiquetaMetodo(metodo) {
  return ETIQUETAS_METODO[metodo] || metodo || 'Sin método';
}

function claseEstadoPago(estado) {
  if (estado === 'Aprobado') return 'estado-aprobado';
  if (estado === 'Rechazado') return 'estado-rechazado';
  if (estado === 'En verificación') return 'estado-verificacion';
  return 'estado-pendiente';
}

function crearBadge(estado) {
  return el('span', {
    clase: `estado-badge ${claseEstadoPago(estado)}`,
    texto: estado || 'Sin estado'
  });
}

const COLUMNAS_PAGOS = [
  { etiqueta: 'Pedido', clase: 'staff-col-codigo' },
  { etiqueta: 'Cliente' },
  { etiqueta: 'Método' },
  { etiqueta: 'Monto del pedido', clase: 'staff-numero' },
  { etiqueta: 'Monto declarado', clase: 'staff-numero' },
  { etiqueta: 'Fecha' },
  { etiqueta: 'Estado' },
  { etiqueta: 'Acciones', clase: 'staff-col-acciones' }
];

function crearFilaPago(pago, alRevisar, activo) {
  const montoDeclarado =
    pago.montoPagado === null
      ? 'Sin monto declarado'
      : formatearBs(pago.montoPagado);
  const fecha = pago.fechaDeposito || pago.creadoEn;
  const revisar = boton('Revisar', {
    tipo: 'button',
    variante: 'outline',
    clase: 'btn-pequeno'
  });
  revisar.addEventListener('click', () => alRevisar(pago.id));

  return el(
    'tr',
    { clase: activo ? 'staff-fila-activa' : '' },
    crearCeldaStaff(
      'Pedido',
      el('strong', { texto: pago.codigoRastreo }),
      'staff-col-codigo'
    ),
    crearCeldaStaff('Cliente', el('span', { texto: pago.nombreCliente })),
    crearCeldaStaff(
      'Método',
      el('span', { texto: etiquetaMetodo(pago.metodo) })
    ),
    crearCeldaStaff(
      'Monto del pedido',
      el('span', { texto: formatearBs(pago.totalPedido) }),
      'staff-numero'
    ),
    crearCeldaStaff(
      'Monto declarado',
      el('span', { texto: montoDeclarado }),
      'staff-numero'
    ),
    crearCeldaStaff('Fecha', el('span', { texto: formatearFecha(fecha) })),
    crearCeldaStaff('Estado', crearBadge(pago.estado)),
    crearCeldaStaff('Acciones', revisar, 'staff-col-acciones')
  );
}

function crearComprobante(comprobante) {
  const url = `/api/comprobantes/${comprobante.id}`;
  const mime = String(comprobante.mimeType || '');
  const esImagen = mime.startsWith('image/');
  const esPdf = mime === 'application/pdf';
  const enlace = el(
    'a',
    {
      clase: 'btn btn-outline btn-pequeno',
      href: url,
      atributos: {
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': `Abrir comprobante ${comprobante.nombreArchivo}`
      }
    },
    icono('pago', 14),
    el('span', { texto: 'Abrir comprobante' })
  );

  let vista = null;

  if (esImagen) {
    vista = el('img', {
      clase: 'pago-comprobante-imagen',
      src: url,
      alt: `Comprobante ${comprobante.nombreArchivo}`,
      atributos: { loading: 'lazy' }
    });
  } else if (esPdf) {
    vista = enlace;
  } else {
    vista = enlace;
  }

  return el(
    'div',
    { clase: 'pago-comprobante' },
    el(
      'header',
      { clase: 'pago-comprobante-cabecera' },
      el('strong', { texto: comprobante.nombreArchivo }),
      el('span', {
        clase: 'texto-suave',
        texto: `${mime || 'Tipo desconocido'} · ${formatearFecha(
          comprobante.creadoEn
        )}`
      })
    ),
    vista,
    esImagen ? enlace : null
  );
}

function crearDato(etiqueta, valor) {
  return el(
    'div',
    { clase: 'pago-dato' },
    el('dt', { texto: etiqueta }),
    el('dd', { texto: valor || 'No registrado' })
  );
}

function crearDetallePago(pago, alCerrar, alActualizar, alNotificar) {
  const panel = el('section', { clase: 'pago-detalle' });
  const mensajes = el('div', { clase: 'pagos-mensajes' });

  const cerrar = el(
    'button',
    {
      clase: 'btn btn-secondary btn-pequeno',
      atributos: { type: 'button', 'aria-label': 'Cerrar detalle' }
    },
    icono('cerrar', 14),
    el('span', { texto: 'Cerrar' })
  );
  cerrar.addEventListener('click', alCerrar);

  panel.appendChild(
    el(
      'div',
      { clase: 'pago-detalle-cabecera' },
      el(
        'div',
        {},
        el('p', { clase: 'rastreo-etiqueta', texto: 'Pedido' }),
        el('h2', { clase: 'pago-detalle-titulo', texto: pago.codigoRastreo })
      ),
      el('div', { clase: 'pago-detalle-cabecera-acciones' }, crearBadge(pago.estado), cerrar)
    )
  );

  panel.appendChild(
    el(
      'dl',
      { clase: 'pago-detalle-datos' },
      crearDato('Cliente', pago.nombreCliente),
      crearDato('Método', etiquetaMetodo(pago.metodo)),
      crearDato('Monto del pedido', formatearBs(pago.totalPedido)),
      crearDato(
        'Monto declarado',
        pago.montoPagado === null
          ? 'Sin monto declarado'
          : formatearBs(pago.montoPagado)
      ),
      crearDato('Referencia declarada', pago.referenciaDeclarada),
      crearDato('Fecha del depósito', pago.fechaDeposito ? formatearFecha(pago.fechaDeposito) : null),
      crearDato('Fecha del pago', formatearFecha(pago.creadoEn)),
      crearDato('Estado', pago.estado)
    )
  );

  const advertencias = [];
  if (pago.advertenciaMonto) advertencias.push(pago.advertenciaMonto);
  if (pago.montoPagado !== null && pago.montoCoincide === false) {
    advertencias.push(
      'El monto declarado no coincide con el total del pedido.'
    );
  }
  for (const comprobante of pago.comprobantes || []) {
    if (comprobante.hashDuplicado) {
      advertencias.push(
        comprobante.advertenciaHash ||
          'El archivo ya fue subido en otro pedido.'
      );
    }
  }

  if (advertencias.length > 0) {
    panel.appendChild(
      el(
        'div',
        { clase: 'pago-advertencias' },
        ...advertencias.map((texto) => alerta(texto, 'error'))
      )
    );
  }

  const comprobantes = pago.comprobantes || [];
  panel.appendChild(
    el(
      'section',
      { clase: 'pago-comprobantes' },
      el('h3', { clase: 'pago-detalle-subtitulo', texto: 'Comprobante' }),
      comprobantes.length
        ? el(
            'div',
            { clase: 'pago-comprobantes-lista' },
            ...comprobantes.map((comprobante) => crearComprobante(comprobante))
          )
        : estadoVacio('Este pago no tiene comprobante adjunto.')
    )
  );

  if (pago.estado === 'En verificación') {
    const motivo = el('textarea', {
      clase: 'entrada entrada-area',
      atributos: {
        rows: '3',
        placeholder: 'Motivo del rechazo (obligatorio)'
      }
    });
    const errorMotivo = el('small', { clase: 'campo-error' });
    const aprobar = boton('Aprobar pago', {
      tipo: 'button',
      variante: 'primary',
      nombreIcono: 'pago'
    });
    const rechazar = boton('Rechazar pago', {
      tipo: 'button',
      variante: 'secondary'
    });

    aprobar.addEventListener('click', async () => {
      if (!window.confirm('¿Confirmas la aprobación de este pago?')) return;
      aprobar.disabled = true;
      rechazar.disabled = true;

      try {
        await api.parchear(`/staff/pagos/${pago.id}/aprobar`, {});
        alNotificar(
          'Pago aprobado. El pedido queda listo para operaciones/almacén.',
          'exito'
        );
        await alActualizar();
        alCerrar();
      } catch (error) {
        mensajes.replaceChildren(
          alerta(error.message || 'No se pudo aprobar el pago.')
        );
        aprobar.disabled = false;
        rechazar.disabled = false;
      }
    });

    rechazar.addEventListener('click', async () => {
      const texto = motivo.value.trim();
      errorMotivo.textContent = '';

      if (texto.length < 5) {
        errorMotivo.textContent =
          'Ingresa un motivo de al menos 5 caracteres.';
        motivo.focus();
        return;
      }

      aprobar.disabled = true;
      rechazar.disabled = true;

      try {
        await api.parchear(`/staff/pagos/${pago.id}/rechazar`, {
          motivo: texto
        });
        alNotificar(
          'Pago rechazado. El pedido fue cancelado y el stock repuesto.',
          'info'
        );
        await alActualizar();
        alCerrar();
      } catch (error) {
        mensajes.replaceChildren(
          alerta(error.message || 'No se pudo rechazar el pago.')
        );
        aprobar.disabled = false;
        rechazar.disabled = false;
      }
    });

    panel.appendChild(
      el(
        'div',
        { clase: 'pago-detalle-acciones' },
        aprobar,
        el(
          'div',
          { clase: 'pago-rechazo' },
          el('label', {
            clase: 'campo-etiqueta',
            texto: 'Motivo del rechazo'
          }),
          motivo,
          errorMotivo,
          rechazar
        )
      )
    );
  }

  panel.appendChild(mensajes);
  return panel;
}

export const vistaPagosStaff = {
  async render() {
    let filtro = ESTADOS[0];
    let detalleId = null;

    const seccion = el(
      'section',
      { clase: 'pagina pagos-staff' },
      el(
        'header',
        { clase: 'encabezado-pagina' },
        el('h1', { texto: 'Verificación de pagos' }),
        el('p', {
          clase: 'texto-suave',
          texto:
            'Revisa comprobantes, aprueba o rechaza pagos y deja constancia en auditoría.'
        })
      )
    );

    const mensajes = el('div', { clase: 'pagos-mensajes' });
    const filtroSelect = el(
      'select',
      {
        clase: 'entrada pago-filtro',
        atributos: { 'aria-label': 'Filtrar pagos por estado' }
      },
      ...ESTADOS.map((estado) =>
        el('option', { value: estado, texto: estado })
      )
    );

    const lista = el('div', { clase: 'pagos-lista' });
    const detalle = el('div', { clase: 'pago-detalle-contenedor' });

    const barra = el(
      'div',
      { clase: 'pagos-barra' },
      el('span', {
        clase: 'texto-suave',
        texto: 'Filtra la cola por estado del pago.'
      }),
      filtroSelect
    );

    seccion.append(mensajes, barra, lista, detalle);

    function mostrarMensaje(texto, tipo) {
      mensajes.replaceChildren(alerta(texto, tipo));
    }

    async function cargarDetalle(id) {
      detalleId = id;
      detalle.replaceChildren(
        el('p', { clase: 'cargando', texto: 'Cargando detalle del pago...' })
      );
      await cargarLista();

      try {
        const respuesta = await api.obtener(`/staff/pagos/${id}`);
        const pago = respuesta?.datos?.pago;
        if (!pago) throw new Error('No se encontró el pago.');

        detalle.replaceChildren(
          crearDetallePago(
            pago,
            () => {
              detalleId = null;
              detalle.replaceChildren();
              cargarLista();
            },
            cargarLista,
            mostrarMensaje
          )
        );
      } catch (error) {
        detalle.replaceChildren(
          alerta(error.message || 'No se pudo cargar el detalle del pago.')
        );
      }
    }

    async function cargarLista() {
      lista.replaceChildren(
        el('p', { clase: 'cargando', texto: 'Cargando pagos...' })
      );

      try {
        const respuesta = await api.obtener(
          `/staff/pagos?estado=${encodeURIComponent(filtro)}`
        );
        const pagos = respuesta?.datos?.pagos || [];

        if (pagos.length === 0) {
          lista.replaceChildren(
            estadoVacio(`No hay pagos en estado ${filtro}.`)
          );
          return;
        }

        lista.replaceChildren(
          crearTablaStaff(
            COLUMNAS_PAGOS,
            pagos.map((pago) =>
              crearFilaPago(
                pago,
                cargarDetalle,
                Number(pago.id) === Number(detalleId)
              )
            )
          )
        );
      } catch (error) {
        lista.replaceChildren(
          alerta(error.message || 'No se pudieron cargar los pagos.')
        );
      }
    }

    filtroSelect.addEventListener('change', () => {
      filtro = filtroSelect.value;
      detalleId = null;
      detalle.replaceChildren();
      mensajes.replaceChildren();
      cargarLista();
    });

    await cargarLista();
    return seccion;
  }
};
