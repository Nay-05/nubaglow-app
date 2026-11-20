/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: PEDIDOS Y RASTREO (/pedidos)
 * ============================================================================
 * Consulta publica por codigo NB-2026-XXXX con datos personales enmascarados
 * y, para clientes autenticados, historial de pedidos con detalle y PDF.
 * Todo el contenido proviene de la API; no hay pedidos de demostracion.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs, formatearFecha } from '../../core/formato.js';
import {
  alerta,
  boton,
  enlaceInterno,
  estadoVacio
} from '../comunes.js';

const ESTADOS_ENVIO = [
  'Pendiente',
  'En preparación',
  'Empacado',
  'En tránsito',
  'Entregado'
];

const ETIQUETAS_METODO = {
  qr_simple: 'QR simple',
  qr: 'QR simple',
  deposito_bancario: 'Depósito bancario',
  paypal: 'PayPal',
  contra_entrega: 'Contra entrega'
};

function etiquetaMetodo(metodo) {
  return ETIQUETAS_METODO[metodo] || metodo || 'Sin pago';
}

function claseEstadoEnvio(estado) {
  if (estado === 'En preparación') return 'estado-preparacion';
  if (estado === 'Empacado') return 'estado-empacado';
  if (estado === 'En tránsito') return 'estado-transito';
  if (estado === 'Entregado') return 'estado-entregado';
  if (estado === 'Cancelado') return 'estado-rechazado';
  return 'estado-pendiente';
}

function claseEstadoPago(estado) {
  if (estado === 'Aprobado') return 'estado-aprobado';
  if (estado === 'Rechazado') return 'estado-rechazado';
  if (estado === 'En verificación') return 'estado-verificacion';
  return 'estado-pendiente';
}

function crearBadge(texto, clase) {
  return el('span', { clase: `estado-badge ${clase}`, texto });
}

function crearLineaTiempo(rastreo) {
  const eventos = Array.isArray(rastreo.lineaDeTiempo)
    ? rastreo.lineaDeTiempo
    : [];
  const eventosPorEstado = new Map(
    eventos.map((evento) => [evento.estado, evento])
  );
  const indiceActual = Math.max(
    0,
    ESTADOS_ENVIO.indexOf(rastreo.estado)
  );

  const pasos = ESTADOS_ENVIO.map((estado, indice) => {
    const evento = eventosPorEstado.get(estado);
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
              texto: formatearFecha(evento.fechaHora)
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
    { clase: 'rastreo-linea' },
    el('h3', {
      clase: 'bloque-detalle-titulo',
      texto: 'Estado del envío'
    }),
    el('ol', { clase: 'pedido-etapas' }, ...pasos)
  );
}

function bloqueRastreo(rastreo) {
  return el(
    'article',
    { clase: 'tarjeta-rastreo' },
    el(
      'header',
      { clase: 'rastreo-cabecera' },
      el(
        'div',
        {},
        el('p', { clase: 'rastreo-etiqueta', texto: 'Código de rastreo' }),
        el('h2', { clase: 'rastreo-codigo', texto: rastreo.codigoRastreo })
      ),
      crearBadge(rastreo.estado, claseEstadoEnvio(rastreo.estado))
    ),
    el(
      'dl',
      { clase: 'rastreo-datos' },
      el('div', {}, el('dt', { texto: 'Ciudad de destino' }), el('dd', {
        texto: rastreo.ciudadDestino || 'No registrada'
      })),
      el('div', {}, el('dt', { texto: 'Transportista' }), el('dd', {
        texto: rastreo.transportista || 'Pendiente de asignación'
      })),
      el('div', {}, el('dt', { texto: 'Fecha del pedido' }), el('dd', {
        texto: formatearFecha(rastreo.fechaPedido)
      })),
      el('div', {}, el('dt', { texto: 'Destinatario' }), el('dd', {
        texto: rastreo.destinatarioProtegido?.nombre || 'Protegido'
      })),
      el('div', {}, el('dt', { texto: 'Contacto' }), el('dd', {
        texto: rastreo.destinatarioProtegido?.celular || 'Protegido'
      })),
      el('div', {}, el('dt', { texto: 'Dirección' }), el('dd', {
        texto: rastreo.destinatarioProtegido?.direccion || 'Protegida'
      }))
    ),
    el('p', {
      clase: 'pago-aviso',
      texto:
        'Por seguridad, el nombre, el teléfono y la dirección se ' +
        'muestran parcialmente en la consulta pública.'
    }),
    crearLineaTiempo(rastreo)
  );
}

function crearTarjetaHistorial(pedido) {
  const codigo = String(pedido.codigoRastreo || '');
  const ruta = `/pedido/${encodeURIComponent(codigo)}`;
  const totalArticulos = Number(pedido.totalArticulos) || 0;

  return el(
    'article',
    { clase: 'cuenta-pedido' },
    el(
      'div',
      { clase: 'cuenta-pedido-principal' },
      el(
        'div',
        { clase: 'cuenta-pedido-codigo-linea' },
        el('a', {
          clase: 'cuenta-pedido-codigo',
          href: ruta,
          atributos: { 'data-ruta': '' },
          texto: codigo
        }),
        el('span', {
          clase: 'texto-suave',
          texto:
            `${formatearFecha(pedido.creadoEn)} · ` +
            `${totalArticulos} artículo(s) · ` +
            `${etiquetaMetodo(pedido.metodoPago)}`
        })
      ),
      el(
        'div',
        { clase: 'cuenta-pedido-badges' },
        crearBadge(
          `Pago: ${pedido.estadoPago || 'Sin registrar'}`,
          claseEstadoPago(pedido.estadoPago)
        ),
        crearBadge(
          `Envío: ${pedido.estado || 'Pendiente'}`,
          claseEstadoEnvio(pedido.estado)
        )
      )
    ),
    el(
      'div',
      { clase: 'cuenta-pedido-acciones' },
      el('strong', {
        clase: 'cuenta-pedido-total',
        texto: formatearBs(pedido.total)
      }),
      el(
        'div',
        { clase: 'cuenta-pedido-botones' },
        el(
          'a',
          {
            clase: 'btn btn-outline btn-pequeno',
            href: `/api/pedidos/${encodeURIComponent(codigo)}/comprobante-pdf`,
            atributos: {
              download: '',
              'aria-label': 'Descargar comprobante PDF'
            }
          },
          icono('descargar', 14),
          el('span', { texto: 'Descargar comprobante' })
        ),
        enlaceInterno(ruta, 'Ver detalle', {
          clase: 'btn btn-outline btn-pequeno'
        })
      )
    )
  );
}

export const vistaPedidos = {
  async render({ usuario }) {
    const seccion = el(
      'section',
      { clase: 'pagina pedidos-pagina' },
      el(
        'header',
        { clase: 'encabezado-pagina' },
        el('h1', { texto: 'Pedidos y rastreo' }),
        el('p', {
          clase: 'texto-suave',
          texto:
            'Consulta un envío por su código o revisa el historial de tu cuenta.'
        })
      )
    );

    const consulta = el('section', { clase: 'pedido-panel' });
    consulta.appendChild(
      el('h2', {
        clase: 'pedido-panel-titulo',
        texto: 'Consulta pública'
      })
    );

    const entrada = el('input', {
      clase: 'entrada',
      type: 'text',
      name: 'codigo',
      id: 'campo-codigo',
      placeholder: 'NB-2026-0000',
      atributos: {
        autocomplete: 'off',
        maxlength: '20',
        spellcheck: 'false'
      }
    });

    const botonBuscar = boton('Rastrear', {
      tipo: 'submit',
      variante: 'primary',
      nombreIcono: 'buscar'
    });

    const formulario = el(
      'form',
      { clase: 'buscador' },
      el(
        'div',
        { clase: 'campo' },
        el('label', {
          clase: 'campo-etiqueta',
          atributos: { for: 'campo-codigo' },
          texto: 'Código de rastreo'
        }),
        entrada
      ),
      botonBuscar
    );

    const resultado = el('div', {
      clase: 'rastreo-resultado',
      atributos: { 'aria-live': 'polite' }
    });

    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      resultado.replaceChildren();
      const codigo = entrada.value.trim();

      if (!codigo) {
        resultado.appendChild(
          alerta('Ingresa un código de rastreo para continuar.')
        );
        return;
      }

      botonBuscar.disabled = true;

      try {
        const respuesta = await api.obtener(
          `/envios/rastreo/${encodeURIComponent(codigo)}`
        );
        resultado.appendChild(bloqueRastreo(respuesta.datos.rastreo));
      } catch (error) {
        resultado.appendChild(
          alerta(
            error.estado === 404
              ? 'No encontramos un envío con ese código. ' +
                  'Revisa el código e intenta nuevamente.'
              : error.message ||
                  'No se pudo consultar el rastreo en este momento.'
          )
        );
      } finally {
        botonBuscar.disabled = false;
      }
    });

    consulta.append(formulario, resultado);
    seccion.appendChild(consulta);

    if (usuario && usuario.rol === 'cliente') {
      const historial = el('section', { clase: 'pedidos-historial' });
      const titulo = el('h2', {
        clase: 'pedidos-historial-titulo',
        texto: 'Mis pedidos'
      });
      const lista = el('div', { clase: 'cuenta-pedidos-lista' });

      historial.append(
        titulo,
        el('p', {
          clase: 'texto-suave',
          texto: 'Historial de pedidos asociados a tu cuenta.'
        }),
        lista
      );
      seccion.appendChild(historial);

      lista.replaceChildren(
        el('p', { clase: 'cargando', texto: 'Cargando tus pedidos...' })
      );

      try {
        const respuesta = await api.obtener('/pedidos');
        const pedidos = respuesta?.datos?.pedidos || [];

        lista.replaceChildren(
          ...(pedidos.length
            ? pedidos.map((pedido) => crearTarjetaHistorial(pedido))
            : [
                estadoVacio(
                  'Todavía no tienes pedidos. Explora el catálogo para ' +
                    'iniciar tu primer ritual.'
                )
              ])
        );
      } catch (error) {
        lista.replaceChildren(
          alerta(
            error.message || 'No se pudieron cargar tus pedidos.'
          )
        );
      }
    }

    return seccion;
  }
};
