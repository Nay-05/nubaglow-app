/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: DETALLE DEL PEDIDO (/pedido/:codigo)
 * ============================================================================
 * Confirmacion de compra e instrucciones de pago. Solo un cliente autenticado
 * puede ver su propio pedido: el backend valida la propiedad y esta vista
 * muestra un mensaje de acceso denegado cuando el pedido no le pertenece.
 *
 * - Sin innerHTML: todo el contenido dinamico se crea con helpers de DOM.
 * - Sin estilos inline ni emojis; mobile-first y compatible con la CSP.
 * - Reutiliza los servicios existentes de pedidos, pagos y comprobantes.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import {
  formatearBs,
  formatearFecha,
  formatearUsd
} from '../../core/formato.js';
import {
  encabezadoPagina,
  alerta,
  enlaceInterno,
  imagenProducto
} from '../comunes.js';

const RUTA_CUENTA = '/cuenta';
const RUTA_CATALOGO = '/catalogo';
const ESTADOS_ENVIO = [
  'Pendiente',
  'En preparación',
  'Empacado',
  'En tránsito',
  'Entregado'
];
const TAMANO_MAXIMO_COMPROBANTE = 2 * 1024 * 1024;
const TIPOS_COMPROBANTE = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf'
]);

const CLASES_ESTADO_PAGO = {
  Pendiente: 'estado-pendiente',
  'En verificación': 'estado-verificacion',
  Aprobado: 'estado-aprobado',
  Rechazado: 'estado-rechazado'
};

const ETIQUETAS_METODO_PAGO = {
  qr_simple: 'QR simple',
  qr: 'QR simple',
  deposito_bancario: 'Depósito bancario',
  paypal: 'PayPal',
  contra_entrega: 'Contra entrega'
};

function etiquetaMetodoPago(metodo) {
  return ETIQUETAS_METODO_PAGO[metodo] || metodo || 'Sin pago registrado';
}

function claseEstadoPago(estado) {
  return CLASES_ESTADO_PAGO[estado] || 'estado-pendiente';
}

function claseEstadoEnvio(estado) {
  if (estado === 'Entregado') return 'estado-entregado';
  if (estado === 'En tránsito') return 'estado-transito';
  if (estado === 'Empacado') return 'estado-empacado';
  if (estado === 'En preparación') return 'estado-preparacion';
  return 'estado-pendiente';
}

function fechaLocalHoy() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function inferirMime(archivo) {
  if (archivo.type) return archivo.type;
  const nombre = String(archivo.name || '').toLowerCase();
  if (nombre.endsWith('.pdf')) return 'application/pdf';
  if (nombre.endsWith('.png')) return 'image/png';
  if (nombre.endsWith('.jpg') || nombre.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return '';
}

function leerArchivoBase64(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result || ''));
    lector.onerror = () =>
      rechazar(new Error('No se pudo leer el archivo seleccionado.'));
    lector.readAsDataURL(archivo);
  });
}

function crearBotonCopiar(codigo) {
  const aviso = el('span', {
    clase: 'pedido-copiar-aviso',
    atributos: { role: 'status', 'aria-live': 'polite' }
  });

  const boton = el(
    'button',
    {
      clase: 'btn btn-secondary btn-pequeno',
      atributos: { type: 'button', 'aria-label': 'Copiar código de rastreo' }
    },
    icono('copiar', 15),
    el('span', { texto: 'Copiar código' })
  );

  boton.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error('Clipboard no disponible');
      }
      await navigator.clipboard.writeText(codigo);
      aviso.textContent = 'Código copiado.';
    } catch {
      aviso.textContent =
        'No se pudo copiar automáticamente. Selecciona el código manualmente.';
    }
  });

  return el('div', { clase: 'pedido-copiar' }, boton, aviso);
}

function crearBotonWhatsApp(pedido, numero) {
  const digitos = String(numero || '').replace(/[^\d]/g, '');
  if (!digitos) return null;

  const codigo = String(pedido.codigoRastreo || '');
  const items = Array.isArray(pedido.items) ? pedido.items : [];
  const enlace =
    `${window.location.origin}/pedidos?codigo=` +
    encodeURIComponent(codigo);
  const lineas = ['*NubaGlow*', `*Pedido ${codigo}*`, ''];

  if (items.length > 0) {
    lineas.push('*Artículos:*');
    for (const item of items) {
      const variante = item.varianteNombre
        ? ` (${item.varianteNombre})`
        : '';
      lineas.push(
        `- ${item.cantidad} x ${item.productoNombre}${variante}: ` +
          formatearBs(item.subtotal)
      );
    }
    lineas.push('');
  }

  lineas.push(
    `*Total: ${formatearBs(pedido.total)}*`,
    `Método de pago: ${etiquetaMetodoPago(pedido.pago?.metodo)}`,
    `Estado del pago: ${pedido.pago?.estado || 'Sin pago registrado'}`,
    '',
    `Rastrea tu pedido: ${enlace}`
  );

  const texto = encodeURIComponent(lineas.join('\n'));
  const url = `https://wa.me/${digitos}?text=${texto}`;

  return el(
    'a',
    {
      clase: 'btn btn-outline',
      href: url,
      atributos: {
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': 'Enviar resumen del pedido por WhatsApp'
      }
    },
    icono('whatsapp', 16),
    el('span', { texto: 'Enviar resumen por WhatsApp' })
  );
}

function crearBadgesEstado(pedido) {
  const pago = pedido.pago;
  const envio = pedido.envio;
  const badges = [];

  badges.push(
    pago
      ? el('span', {
          clase: `estado-badge ${claseEstadoPago(pago.estado)}`,
          texto: `Pago: ${pago.estado}`
        })
      : el('span', {
          clase: 'estado-badge estado-pendiente',
          texto: 'Pago: sin registrar'
        })
  );

  badges.push(
    envio
      ? el('span', {
          clase: `estado-badge ${claseEstadoEnvio(envio.estado)}`,
          texto: `Envío: ${envio.estado}`
        })
      : el('span', {
          clase: 'estado-badge estado-pendiente',
          texto: 'Envío: pendiente'
        })
  );

  return el('div', { clase: 'pedido-badges' }, ...badges);
}

function crearBotonComprobantePdf(pedido) {
  const codigo = encodeURIComponent(String(pedido.codigoRastreo || ''));
  return el(
    'a',
    {
      clase: 'btn btn-primary',
      href: `/api/pedidos/${codigo}/comprobante-pdf`,
      atributos: {
        download: '',
        'aria-label': 'Descargar comprobante PDF'
      }
    },
    icono('descargar', 16),
    el('span', { texto: 'Descargar comprobante' })
  );
}

function crearCabeceraPedido(pedido, configuracion) {
  const numeroWhatsApp = configuracion?.whatsappNumero;
  const acciones = el(
    'div',
    { clase: 'pedido-acciones pedido-cabecera-acciones' },
    crearBotonComprobantePdf(pedido),
    crearBotonWhatsApp(pedido, numeroWhatsApp),
    enlaceInterno(RUTA_CUENTA, 'Volver a mi cuenta', {
      clase: 'btn btn-secondary'
    })
  );

  return el(
    'header',
    { clase: 'pedido-cabecera' },
    el(
      'div',
      { clase: 'pedido-cabecera-principal' },
      el('p', { clase: 'rastreo-etiqueta', texto: 'Código de rastreo' }),
      el(
        'div',
        { clase: 'pedido-codigo-bloque' },
        el('h2', { clase: 'pedido-codigo', texto: pedido.codigoRastreo }),
        crearBotonCopiar(pedido.codigoRastreo)
      ),
      el('p', {
        clase: 'texto-suave',
        texto: `Pedido realizado el ${formatearFecha(pedido.creadoEn)}`
      }),
      crearBadgesEstado(pedido)
    ),
    acciones
  );
}

function crearResumenItems(pedido) {
  const items = Array.isArray(pedido.items) ? pedido.items : [];
  const lista = items.length
    ? el(
        'ul',
        { clase: 'pedido-items' },
        ...items.map((item) =>
          el(
            'li',
            { clase: 'pedido-item' },
            imagenProducto(item.imagen, item.productoNombre || 'Producto NubaGlow'),
            el(
              'div',
              { clase: 'pedido-item-info' },
              el('strong', { texto: item.productoNombre || 'Producto' }),
              el('span', {
                clase: 'texto-suave',
                texto: item.varianteNombre || 'Variante única'
              }),
              el('span', {
                clase: 'texto-suave',
                texto:
                  `SKU ${item.sku || 'sin SKU'} - ` +
                  `${item.cantidad} x ${formatearBs(item.precioUnitario)}`
              })
            ),
            el('span', {
              clase: 'pedido-item-subtotal',
              texto: formatearBs(item.subtotal)
            })
          )
        )
      )
    : el('p', {
        clase: 'texto-suave',
        texto: 'Este pedido no tiene artículos registrados.'
      });

  return el(
    'section',
    { clase: 'pedido-panel pedido-panel--resumen' },
    el('h2', { clase: 'pedido-panel-titulo', texto: 'Resumen del pedido' }),
    lista,
    el(
      'div',
      { clase: 'pedido-totales' },
      el(
        'div',
        { clase: 'pedido-total-linea' },
        el('span', { texto: 'Subtotal' }),
        el('span', { texto: formatearBs(pedido.subtotal) })
      ),
      el(
        'div',
        { clase: 'pedido-total-linea' },
        el('span', { texto: 'Envío' }),
        el('span', { texto: formatearBs(pedido.costoEnvio) })
      ),
      el(
        'div',
        { clase: 'pedido-total' },
        el('span', { texto: 'Total' }),
        el('span', { texto: formatearBs(pedido.total) })
      )
    )
  );
}

function crearPanelEntrega(pedido) {
  const filas = [
    ['Nombre', pedido.nombreCliente],
    ['Celular', pedido.celularCliente],
    ['Correo', pedido.correoCliente],
    ['Ciudad', pedido.ciudad],
    ['Dirección', pedido.direccion]
  ];

  if (pedido.notas) filas.push(['Notas', pedido.notas]);

  return el(
    'section',
    { clase: 'pedido-panel pedido-panel--entrega' },
    el('h2', { clase: 'pedido-panel-titulo', texto: 'Datos de entrega' }),
    el(
      'dl',
      { clase: 'pedido-datos' },
      ...filas.map(([etiqueta, valor]) =>
        el(
          'div',
          {},
          el('dt', { texto: etiqueta }),
          el('dd', { texto: valor || 'No registrado' })
        )
      )
    )
  );
}

function crearLineaTiempo(envio) {
  const eventos = Array.isArray(envio?.eventos) ? envio.eventos : [];
  const estadoActual = envio?.estado || '';
  const indiceActual = envio
    ? Math.max(0, ESTADOS_ENVIO.indexOf(estadoActual))
    : -1;

  const badge = envio
    ? el('span', {
        clase: `estado-badge ${claseEstadoEnvio(envio.estado)}`,
        texto: envio.estado
      })
    : null;

  const pasos = ESTADOS_ENVIO.map((estado, indice) => {
    const evento = eventos.find((actual) => actual.estado === estado);
    let modificador = 'pedido-etapa--pendiente';

    if (indice < indiceActual) {
      modificador = 'pedido-etapa--completada';
    } else if (indice === indiceActual) {
      modificador = 'pedido-etapa--actual';
    }

    return el(
      'li',
      {
        clase: `pedido-etapa ${modificador}`,
        atributos:
          indice === indiceActual ? { 'aria-current': 'step' } : {}
      },
      el('span', {
        clase: 'pedido-etapa-punto',
        atributos: { 'aria-hidden': 'true' }
      }),
      el(
        'div',
        { clase: 'pedido-etapa-contenido' },
        el('strong', { texto: estado }),
        evento
          ? el('span', {
              clase: 'linea-fecha',
              texto: formatearFecha(evento.creadoEn)
            })
          : null,
        evento?.descripcion
          ? el('p', {
              clase: 'texto-suave',
              texto: evento.descripcion
            })
          : null
      )
    );
  });

  return el(
    'section',
    { clase: 'pedido-panel pedido-panel--ancho pedido-panel--seguimiento' },
    el(
      'div',
      { clase: 'pago-cabecera' },
      el('h2', {
        clase: 'pedido-panel-titulo',
        texto: 'Estado del envío'
      }),
      badge
    ),
    el('ol', { clase: 'pedido-etapas' }, ...pasos)
  );
}

function crearFormularioComprobante(pedido, pago, alRecargar) {
  const mensajes = el('div', { clase: 'pago-form-mensajes' });

  const referencia = el('input', {
    clase: 'entrada',
    id: 'comprobante-referencia',
    name: 'referencia',
    type: 'text',
    placeholder: 'Número de operación o referencia',
    required: true,
    atributos: {
      minlength: '3',
      maxlength: '150',
      autocomplete: 'off'
    }
  });

  const fecha = el('input', {
    clase: 'entrada',
    id: 'comprobante-fecha',
    name: 'fecha_deposito',
    type: 'date',
    required: true,
    max: fechaLocalHoy(),
    value: fechaLocalHoy()
  });

  const monto = el('input', {
    clase: 'entrada',
    id: 'comprobante-monto',
    name: 'monto_pagado',
    type: 'number',
    required: true,
    min: '0.01',
    step: '0.01',
    value: String(pago?.monto ?? pedido.total ?? '')
  });

  const archivo = el('input', {
    clase: 'comprobante-archivo',
    id: 'comprobante-archivo',
    name: 'archivo',
    type: 'file',
    required: true,
    accept: '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf'
  });

  const nombreArchivo = el('span', {
    clase: 'comprobante-archivo-nombre',
    atributos: { 'aria-live': 'polite' },
    texto: 'Ningún archivo seleccionado'
  });

  const boton = el(
    'button',
    {
      clase: 'btn btn-primary',
      atributos: { type: 'submit' }
    },
    el('span', { texto: 'Enviar comprobante' })
  );

  const formulario = el(
    'form',
    { clase: 'pago-form' },
    mensajes,
    el(
      'div',
      { clase: 'pago-form-grilla' },
      el(
        'div',
        { clase: 'campo' },
        el('label', {
          clase: 'campo-etiqueta',
          atributos: { for: 'comprobante-referencia' },
          texto: 'Referencia del pago'
        }),
        referencia
      ),
      el(
        'div',
        { clase: 'campo' },
        el('label', {
          clase: 'campo-etiqueta',
          atributos: { for: 'comprobante-fecha' },
          texto: 'Fecha del depósito'
        }),
        fecha
      ),
      el(
        'div',
        { clase: 'campo' },
        el('label', {
          clase: 'campo-etiqueta',
          atributos: { for: 'comprobante-monto' },
          texto: 'Monto pagado (Bs.)'
        }),
        monto
      ),
      el(
        'div',
        { clase: 'campo campo--archivo' },
        el('label', {
          clase: 'campo-etiqueta',
          atributos: { for: 'comprobante-archivo' },
          texto: 'Archivo del comprobante'
        }),
        el(
          'label',
          {
            clase: 'comprobante-zona',
            atributos: { for: 'comprobante-archivo' }
          },
          el(
            'span',
            { clase: 'comprobante-zona-icono', atributos: { 'aria-hidden': 'true' } },
            icono('subir', 22)
          ),
          el('span', {
            clase: 'comprobante-zona-titulo',
            texto: 'Selecciona tu comprobante'
          }),
          el('span', {
            clase: 'comprobante-zona-ayuda',
            texto: 'JPG, PNG o PDF. Tamaño máximo 2 MB.'
          }),
          archivo
        ),
        nombreArchivo
      )
    ),
    el('div', { clase: 'pago-acciones' }, boton)
  );

  archivo.addEventListener('change', () => {
    const seleccionado = archivo.files && archivo.files[0];
    nombreArchivo.textContent = seleccionado
      ? seleccionado.name
      : 'Ningún archivo seleccionado';
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mensajes.replaceChildren();

    if (!formulario.checkValidity()) {
      formulario.reportValidity();
      return;
    }

    const seleccionado = archivo.files && archivo.files[0];
    if (!seleccionado) {
      mensajes.appendChild(
        alerta('Selecciona el archivo del comprobante.')
      );
      return;
    }

    const mime = inferirMime(seleccionado);
    if (!TIPOS_COMPROBANTE.has(mime)) {
      mensajes.appendChild(
        alerta('El archivo debe ser JPG, PNG o PDF.')
      );
      return;
    }

    if (seleccionado.size > TAMANO_MAXIMO_COMPROBANTE) {
      mensajes.appendChild(
        alerta('El archivo supera el tamaño máximo de 2 MB.')
      );
      return;
    }

    if (fecha.value > fechaLocalHoy()) {
      mensajes.appendChild(
        alerta('La fecha del depósito no puede ser futura.')
      );
      return;
    }

    const montoNumero = Number(monto.value);
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      mensajes.appendChild(
        alerta('El monto pagado debe ser mayor a cero.')
      );
      return;
    }

    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    boton.textContent = 'Enviando...';

    try {
      const contenidoBase64 = await leerArchivoBase64(seleccionado);
      await api.crear(
        `/pedidos/${pedido.id}/comprobante`,
        {
          nombre_archivo: seleccionado.name,
          mime_type: mime,
          referencia: referencia.value.trim(),
          fecha_deposito: fecha.value,
          monto_pagado: montoNumero,
          contenido_base64: contenidoBase64
        }
      );

      await alRecargar(
        'Comprobante recibido. Tu pago quedó En verificación para revisión manual.'
      );
    } catch (error) {
      mensajes.appendChild(
        alerta(
          error instanceof Error
            ? error.message
            : 'No se pudo enviar el comprobante.'
        )
      );
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
      boton.textContent = 'Enviar comprobante';
    }
  });

  return formulario;
}

function crearAccionPaypal(pedido, pago, configuracion) {
  const tipoCambio =
    Number(pago.tipoCambioBobUsd) ||
    Number(configuracion?.tipoCambioBobUsd) ||
    null;
  const montoUsd =
    pago.montoUsd !== null && pago.montoUsd !== undefined
      ? Number(pago.montoUsd)
      : tipoCambio
        ? Math.round((Number(pago.monto) / tipoCambio) * 100) / 100
        : null;

  const mensajes = el('div', { clase: 'pago-form-mensajes' });
  const etiqueta = el('span', { texto: 'Pagar con PayPal' });
  const boton = el(
    'button',
    {
      clase: 'btn btn-primary',
      atributos: { type: 'button' }
    },
    icono('tarjeta', 16),
    etiqueta
  );

  boton.addEventListener('click', async () => {
    boton.disabled = true;
    etiqueta.textContent = 'Redirigiendo...';
    mensajes.replaceChildren();

    try {
      const respuesta = await api.crear('/pagos/paypal/crear', {
        pedido_id: pedido.id
      });
      const url = respuesta?.datos?.orden?.urlAprobacion;

      if (typeof url !== 'string' || !url) {
        throw new Error('PayPal no devolvió una URL de aprobación.');
      }

      window.location.assign(url);
    } catch (error) {
      mensajes.replaceChildren(
        alerta(
          error instanceof Error && error.message
            ? error.message
            : 'No se pudo iniciar el pago con PayPal.'
        )
      );
      boton.disabled = false;
      etiqueta.textContent = 'Pagar con PayPal';
    }
  });

  const filas = [
    ['Total en bolivianos', formatearBs(pago.monto)],
    [
      'Monto a cobrar en PayPal',
      montoUsd === null
        ? 'Se calcula al crear la orden'
        : formatearUsd(montoUsd)
    ],
    [
      'Tipo de cambio usado',
      tipoCambio === null
        ? 'No disponible'
        : `${formatearBs(tipoCambio)} por USD`
    ]
  ];

  return el(
    'div',
    { clase: 'pago-paypal' },
    el(
      'div',
      { clase: 'pago-paypal-montos' },
      ...filas.map(([etiquetaFila, valor]) =>
        el(
          'div',
          { clase: 'pago-paypal-linea' },
          el('span', { texto: etiquetaFila }),
          el('strong', { texto: valor })
        )
      )
    ),
    el('p', {
      clase: 'pago-aviso',
      texto: configuracion?.simulado
        ? 'Modo simulación académica: serás redirigido a una página interna de PayPal simulada.'
        : 'Serás redirigido a PayPal para completar el pago de forma segura.'
    }),
    mensajes,
    boton
  );
}

function crearPanelPago(pedido, datosCobro, configuracion) {
  const pago = pedido.pago;
  const metodo = pago?.metodo || '';
  const panel = el('section', {
    clase: 'pedido-panel pedido-panel--pago'
  });

  panel.appendChild(
    el(
      'div',
      { clase: 'pago-cabecera' },
      el('h2', {
        clase: 'pedido-panel-titulo',
        texto: 'Instrucciones de pago'
      }),
      pago
        ? el('span', {
            clase: `estado-badge ${claseEstadoPago(pago.estado)}`,
            texto: pago.estado
          })
        : el('span', {
            clase: 'estado-badge estado-pendiente',
            texto: 'Sin pago'
          })
    )
  );

  if (!pago) {
    panel.appendChild(
      el('p', {
        clase: 'texto-suave',
        texto: 'Este pedido no tiene un pago asociado.'
      })
    );
    return panel;
  }

  if (pago.estado === 'Rechazado') {
    const motivo = pago.motivoRechazo
      ? ` Motivo: ${pago.motivoRechazo}`
      : '';
    panel.appendChild(
      alerta(`El pago fue rechazado.${motivo}`, 'error')
    );
  }

  if (pago.estado === 'Aprobado') {
    panel.appendChild(
      alerta('Pago aprobado. El pedido continúa con la preparación del envío.', 'exito')
    );
  }

  if (metodo === 'qr_simple' || metodo === 'qr') {
    const urlQr = datosCobro?.qrImagenUrl || pago.qrDataUrl;
    if (urlQr) {
      panel.appendChild(
        el(
          'div',
          { clase: 'pago-qr' },
          el('img', {
            clase: 'pago-qr-imagen',
            src: urlQr,
            alt: 'Código QR de pago simulado'
          }),
          el('p', {
            clase: 'pago-aviso',
            texto: 'Escanea este QR para simular el pago del pedido.'
          })
        )
      );
    } else {
      panel.appendChild(
        alerta('No se pudo cargar la imagen del QR. Intenta recargar la página.')
      );
    }

    panel.appendChild(
      el('p', {
        clase: 'pedido-total-linea',
        texto: `Monto exacto: ${formatearBs(pago.monto)}`
      })
    );
    panel.appendChild(
      el('p', {
        clase: 'pago-aviso',
        texto: 'Simulación académica. No realices pagos reales.'
      })
    );
  } else if (metodo === 'deposito_bancario') {
    panel.appendChild(
      el(
        'dl',
        { clase: 'pago-datos' },
        el(
          'div',
          { clase: 'pago-dato' },
          el('strong', { texto: 'Banco:' }),
          el('span', { texto: datosCobro?.banco || 'No disponible' })
        ),
        el(
          'div',
          { clase: 'pago-dato' },
          el('strong', { texto: 'Titular:' }),
          el('span', { texto: datosCobro?.titular || 'No disponible' })
        ),
        el(
          'div',
          { clase: 'pago-dato' },
          el('strong', { texto: 'Cuenta:' }),
          el('span', { texto: datosCobro?.cuenta || 'No disponible' })
        )
      )
    );
    panel.appendChild(
      el('p', {
        clase: 'pedido-total-linea',
        texto: `Monto exacto: ${formatearBs(pago.monto)}`
      })
    );
    panel.appendChild(
      el('p', {
        clase: 'pago-aviso',
        texto: 'Simulación académica. No realices transferencias reales.'
      })
    );
  } else if (metodo === 'contra_entrega') {
    panel.appendChild(
      el('p', {
        texto: 'El pago se cobra al recibir el pedido en la dirección indicada.'
      })
    );
  } else if (metodo === 'paypal') {
    if (pago.estado === 'Pendiente') {
      panel.appendChild(crearAccionPaypal(pedido, pago, configuracion));
    } else if (pago.estado === 'Aprobado') {
      panel.appendChild(
        el('p', {
          clase: 'pago-aviso',
          texto: 'El pago con PayPal ya fue aprobado.'
        })
      );
    }
  }

  if (pago.fechaVencimiento && pago.estado !== 'Aprobado') {
    panel.appendChild(
      el('p', {
        clase: 'pago-aviso',
        texto: `Fecha límite para acreditar el pago: ${formatearFecha(pago.fechaVencimiento)}`
      })
    );
  }

  return panel;
}

function crearPanelComprobante(pedido, pago, alRecargar) {
  const panel = el('section', {
    clase: 'pedido-panel pedido-panel--comprobante'
  });

  panel.appendChild(
    el('h2', {
      clase: 'pedido-panel-titulo',
      texto: 'Comprobante de pago'
    })
  );

  panel.appendChild(
    el('p', {
      clase: 'texto-suave',
      texto:
        'Adjunta el comprobante de tu QR o depósito para que el equipo ' +
        'pueda verificarlo.'
    })
  );

  if (pago.estado === 'En verificación') {
    panel.appendChild(
      el('p', {
        clase: 'pago-aviso',
        texto:
          'Tu comprobante está en revisión. Puedes reemplazarlo si ' +
          'necesitas corregirlo.'
      })
    );
  }

  panel.appendChild(crearFormularioComprobante(pedido, pago, alRecargar));
  return panel;
}

function crearErrorPedido(error, codigo) {
  const estado = error && error.estado;
  const seccion = el('section', { clase: 'pagina' });

  if (estado === 403) {
    seccion.append(
      encabezadoPagina(
        'Acceso denegado',
        'Este pedido no pertenece a tu cuenta.'
      ),
      alerta('No tienes autorización para ver el contenido de este pedido.'),
      el(
        'div',
        { clase: 'pedido-acciones' },
        enlaceInterno(RUTA_CUENTA, 'Ir a mi cuenta', {
          clase: 'btn btn-primary'
        }),
        enlaceInterno(RUTA_CATALOGO, 'Ir al catálogo', {
          clase: 'btn btn-secondary'
        })
      )
    );
    return seccion;
  }

  if (estado === 404) {
    seccion.append(
      encabezadoPagina(
        'Pedido no encontrado',
        `No encontramos un pedido con el código ${codigo}.`
      ),
      el(
        'div',
        { clase: 'pedido-acciones' },
        enlaceInterno(RUTA_CUENTA, 'Ir a mi cuenta', {
          clase: 'btn btn-primary'
        })
      )
    );
    return seccion;
  }

  seccion.append(
    encabezadoPagina(
      'No se pudo cargar el pedido',
      'Intenta nuevamente en unos instantes.'
    ),
    alerta(
      error instanceof Error && error.message
        ? error.message
        : 'No se pudo consultar el pedido.'
    )
  );
  return seccion;
}

async function cargarDatosCobro(pedido) {
  const metodo = pedido.pago?.metodo;
  const requiereDatos =
    metodo === 'qr_simple' ||
    metodo === 'qr' ||
    metodo === 'deposito_bancario';

  if (!requiereDatos) return null;

  try {
    const respuesta = await api.obtener('/pagos/datos-cobro');
    return respuesta?.datos || null;
  } catch {
    return null;
  }
}

async function cargarConfiguracion() {
  try {
    const respuesta = await api.obtener('/config', { sinRenovacion: true });
    return respuesta?.datos || null;
  } catch {
    return null;
  }
}

export const vistaPedidoDetalle = {
  async render({ params, usuario, consulta }) {
    const codigo = String(params?.codigo || '').trim().toUpperCase();
    const seccion = el('section', { clase: 'pagina pedido-detalle' });
    const contenido = el('div', { clase: 'pedido-contenido' });
    seccion.appendChild(contenido);

    if (!usuario || usuario.rol !== 'cliente') {
      contenido.appendChild(
        crearErrorPedido(
          { estado: 403, message: 'Sesión de cliente requerida' },
          codigo
        )
      );
      return seccion;
    }

    const cargar = async (mensajeExito) => {
      contenido.replaceChildren(
        el('p', { clase: 'cargando', texto: 'Cargando pedido...' })
      );

      let pedido;
      try {
        const respuesta = await api.obtener(
          `/pedidos/codigo/${encodeURIComponent(codigo)}`
        );
        pedido = respuesta?.datos?.pedido;
        if (!pedido) throw new Error('Pedido no encontrado');
      } catch (error) {
        contenido.replaceChildren(crearErrorPedido(error, codigo));
        return;
      }

      const [datosCobro, configuracion] = await Promise.all([
        cargarDatosCobro(pedido),
        cargarConfiguracion()
      ]);

      const recargar = async (mensaje) => {
        await cargar(mensaje);
      };

      const bloques = [
        encabezadoPagina(
          'Pedido confirmado',
          'Guarda tu código de rastreo y completa el pago según el método elegido.'
        )
      ];

      if (mensajeExito) {
        bloques.push(alerta(mensajeExito, 'exito'));
      }

      if (consulta?.get('paypal') === 'cancelado') {
        bloques.push(
          alerta(
            'Pago con PayPal cancelado. El pago sigue Pendiente; ' +
              'puedes reintentar cuando quieras.',
            'info'
          )
        );
      }

      const pago = pedido.pago;
      const metodo = pago?.metodo;
      const aceptaComprobante =
        Boolean(pago) &&
        (metodo === 'qr_simple' ||
          metodo === 'qr' ||
          metodo === 'deposito_bancario') &&
        (pago.estado === 'Pendiente' || pago.estado === 'En verificación');

      const paneles = [
        crearResumenItems(pedido),
        crearPanelPago(pedido, datosCobro, configuracion)
      ];

      if (aceptaComprobante) {
        paneles.push(crearPanelComprobante(pedido, pago, recargar));
      }

      paneles.push(crearPanelEntrega(pedido));
      paneles.push(crearLineaTiempo(pedido.envio));

      bloques.push(crearCabeceraPedido(pedido, configuracion));
      bloques.push(el('div', { clase: 'pedido-grid' }, ...paneles));

      contenido.replaceChildren(...bloques);
    };

    await cargar();
    return seccion;
  }
};
