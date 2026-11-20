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
import { formatearBs, formatearFecha } from '../../core/formato.js';
import {
  encabezadoPagina,
  alerta,
  enlaceInterno,
  imagenProducto
} from '../comunes.js';

const RUTA_CUENTA = '/cuenta';
const RUTA_CATALOGO = '/catalogo';
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

  const lineas = [
    `Hola NubaGlow, consulto por mi pedido ${pedido.codigoRastreo}.`,
    `Total: ${formatearBs(pedido.total)}`,
    `Estado del pago: ${pedido.pago?.estado || 'Sin pago registrado'}`,
    `Entrega: ${pedido.ciudad}, ${pedido.direccion}`
  ];
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

function crearCabeceraPedido(pedido, configuracion) {
  const numeroWhatsApp = configuracion?.whatsappNumero;
  const acciones = el(
    'div',
    { clase: 'pedido-acciones' },
    crearBotonWhatsApp(pedido, numeroWhatsApp),
    enlaceInterno(RUTA_CUENTA, 'Volver a mi cuenta', {
      clase: 'btn btn-secondary'
    })
  );

  return el(
    'div',
    { clase: 'pedido-cabecera' },
    el(
      'div',
      { clase: 'pedido-codigo-bloque' },
      el(
        'div',
        {},
        el('p', { clase: 'rastreo-etiqueta', texto: 'Código de rastreo' }),
        el('h2', { clase: 'pedido-codigo', texto: pedido.codigoRastreo })
      ),
      crearBotonCopiar(pedido.codigoRastreo)
    ),
    el('p', {
      clase: 'texto-suave',
      texto: `Pedido realizado el ${formatearFecha(pedido.creadoEn)}`
    }),
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
    { clase: 'pedido-panel' },
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
    { clase: 'pedido-panel' },
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
  const badge = envio
    ? el('span', {
        clase: `estado-badge ${claseEstadoEnvio(envio.estado)}`,
        texto: envio.estado
      })
    : null;

  const contenido = eventos.length
    ? el(
        'ol',
        { clase: 'linea-tiempo' },
        ...eventos.map((evento) =>
          el(
            'li',
            { clase: 'linea-evento' },
            el('span', {
              clase: 'linea-punto',
              atributos: { 'aria-hidden': 'true' }
            }),
            el(
              'div',
              { clase: 'linea-contenido' },
              el('strong', { texto: evento.estado }),
              el('span', {
                clase: 'linea-fecha',
                texto: formatearFecha(evento.creadoEn)
              }),
              evento.descripcion
                ? el('p', {
                    clase: 'texto-suave',
                    texto: evento.descripcion
                  })
                : null
            )
          )
        )
      )
    : el('p', {
        clase: 'texto-suave',
        texto: 'Todavía no hay eventos registrados para este envío.'
      });

  return el(
    'section',
    { clase: 'pedido-panel pedido-panel--ancho' },
    el(
      'div',
      { clase: 'pago-cabecera' },
      el('h2', {
        clase: 'pedido-panel-titulo',
        texto: 'Línea de tiempo del envío'
      }),
      badge
    ),
    contenido
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
    clase: 'entrada',
    id: 'comprobante-archivo',
    name: 'archivo',
    type: 'file',
    required: true,
    accept: '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf'
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
        { clase: 'campo' },
        el('label', {
          clase: 'campo-etiqueta',
          atributos: { for: 'comprobante-archivo' },
          texto: 'Archivo del comprobante'
        }),
        archivo,
        el('small', {
          clase: 'campo-ayuda',
          texto: 'Formatos JPG, PNG o PDF. Tamaño máximo 2 MB.'
        })
      )
    ),
    el('div', { clase: 'pago-acciones' }, boton)
  );

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

function crearPanelPago(pedido, datosCobro, alRecargar) {
  const pago = pedido.pago;
  const metodo = pago?.metodo || '';
  const panel = el('section', { clase: 'pedido-panel' });

  panel.appendChild(
    el(
      'div',
      { clase: 'pago-cabecera' },
      el('h2', { clase: 'pedido-panel-titulo', texto: 'Pago' }),
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
    panel.appendChild(
      el('p', {
        clase: 'texto-suave',
        texto: 'El pago con PayPal estará disponible en el siguiente paso.'
      })
    );
    panel.appendChild(
      el(
        'div',
        { clase: 'pago-deshabilitado' },
        el(
          'button',
          {
            clase: 'btn btn-secondary',
            disabled: true,
            atributos: { type: 'button', 'aria-disabled': 'true' }
          },
          el('span', { texto: 'Disponible próximamente' })
        )
      )
    );
  }

  const aceptaComprobante =
    (metodo === 'qr_simple' || metodo === 'qr' || metodo === 'deposito_bancario') &&
    (pago.estado === 'Pendiente' || pago.estado === 'En verificación');

  if (aceptaComprobante) {
    if (pago.estado === 'En verificación') {
      panel.appendChild(
        el('p', {
          clase: 'texto-suave',
          texto:
            'Tu comprobante está en revisión. Puedes reemplazarlo si necesitas corregirlo.'
        })
      );
    }
    panel.appendChild(crearFormularioComprobante(pedido, pago, alRecargar));
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
  async render({ params, usuario }) {
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

      bloques.push(crearCabeceraPedido(pedido, configuracion));
      bloques.push(
        el(
          'div',
          { clase: 'pedido-grid' },
          crearResumenItems(pedido),
          crearPanelPago(pedido, datosCobro, recargar),
          crearPanelEntrega(pedido),
          crearLineaTiempo(pedido.envio)
        )
      );

      contenido.replaceChildren(...bloques);
    };

    await cargar();
    return seccion;
  }
};
