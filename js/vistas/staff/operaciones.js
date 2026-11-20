/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: OPERACIONES (/staff/operaciones)
 * ============================================================================
 * Pantalla unificada para almacén, logística y admin. Reutiliza los endpoints
 * existentes de inventario y envíos. El backend vuelve a validar cada permiso.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs, formatearFecha } from '../../core/formato.js';
import { alerta, boton, estadoVacio } from '../comunes.js';

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

function fechaHoy() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function horaAhora() {
  const ahora = new Date();
  const horas = String(ahora.getHours()).padStart(2, '0');
  const minutos = String(ahora.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

function celda(etiqueta, contenido, claseExtra = '') {
  return el(
    'div',
    { clase: `ops-celda${claseExtra ? ` ${claseExtra}` : ''}` },
    el('span', { clase: 'ops-celda-etiqueta', texto: etiqueta }),
    contenido
  );
}

function crearFormularioAjuste(inventario, alRegistrar, alNotificar) {
  const selector = el(
    'select',
    { clase: 'entrada', atributos: { 'aria-label': 'Variante a ajustar' } },
    el('option', { value: '', texto: 'Selecciona una variante' }),
    ...inventario.map((item) =>
      el('option', {
        value: String(item.varianteId),
        texto:
          `${item.productoNombre} · ${item.nombreVariante} ` +
          `(${item.sku}) · Stock ${item.stock}`
      })
    )
  );

  const tipo = el(
    'select',
    { clase: 'entrada', atributos: { 'aria-label': 'Tipo de movimiento' } },
    el('option', { value: 'entrada', texto: 'Entrada de mercadería' }),
    el('option', { value: 'ajuste', texto: 'Ajuste manual' })
  );

  const cantidad = el('input', {
    clase: 'entrada',
    type: 'number',
    step: '1',
    value: '1',
    atributos: { 'aria-label': 'Cantidad del movimiento' }
  });

  const motivo = el('textarea', {
    clase: 'entrada entrada-area',
    atributos: {
      rows: '3',
      placeholder: 'Motivo del ingreso o ajuste'
    }
  });

  const error = el('div', { clase: 'ops-form-error' });
  const formularioMensajes = el('div', { clase: 'ops-mensajes' });
  const registrar = boton('Registrar movimiento', {
    tipo: 'submit',
    variante: 'primary',
    nombreIcono: 'operaciones'
  });

  const formulario = el(
    'form',
    { clase: 'ops-form' },
    el(
      'div',
      { clase: 'ops-form-campos' },
      el('div', { clase: 'campo' }, el('label', {
        clase: 'campo-etiqueta',
        texto: 'Variante'
      }), selector),
      el('div', { clase: 'campo' }, el('label', {
        clase: 'campo-etiqueta',
        texto: 'Tipo de movimiento'
      }), tipo),
      el('div', { clase: 'campo' }, el('label', {
        clase: 'campo-etiqueta',
        texto: 'Cantidad'
      }), cantidad),
      el('div', { clase: 'campo' }, el('label', {
        clase: 'campo-etiqueta',
        texto: 'Motivo'
      }), motivo)
    ),
    error,
    formularioMensajes,
    registrar
  );

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    error.textContent = '';
    formularioMensajes.replaceChildren();

    const varianteId = Number(selector.value);
    const cantidadNumero = Number(cantidad.value);
    const motivoTexto = motivo.value.trim();

    if (!varianteId) {
      error.textContent = 'Selecciona una variante.';
      selector.focus();
      return;
    }
    if (!Number.isInteger(cantidadNumero) || cantidadNumero === 0) {
      error.textContent = 'Ingresa una cantidad entera distinta de cero.';
      cantidad.focus();
      return;
    }
    if (tipo.value === 'entrada' && cantidadNumero < 1) {
      error.textContent = 'La entrada de mercadería debe ser mayor a cero.';
      cantidad.focus();
      return;
    }
    if (motivoTexto.length < 3) {
      error.textContent = 'El motivo debe tener al menos 3 caracteres.';
      motivo.focus();
      return;
    }

    registrar.disabled = true;

    try {
      const respuesta = await api.crear(
        `/inventario/ajustes/${varianteId}`,
        {
          tipo: tipo.value,
          cantidad: cantidadNumero,
          motivo: motivoTexto
        }
      );
      const datos = respuesta?.datos;
      alNotificar(
        `Movimiento registrado. Stock de ${datos?.sku || 'la variante'} ` +
          `de ${datos?.stockAnterior} a ${datos?.stockNuevo}.`,
        'exito'
      );
      formulario.reset();
      tipo.value = 'entrada';
      cantidad.value = '1';
      await alRegistrar();
    } catch (errorApi) {
      formularioMensajes.replaceChildren(
        alerta(errorApi.message || 'No se pudo registrar el movimiento.')
      );
    } finally {
      registrar.disabled = false;
    }
  });

  return formulario;
}

function crearFilaInventario(item) {
  return el(
    'article',
    { clase: 'ops-fila' },
    celda(
      'Producto',
      el('strong', { texto: item.productoNombre })
    ),
    celda('Variante', el('span', { texto: item.nombreVariante })),
    celda('SKU', el('span', { texto: item.sku })),
    celda('Stock', el('strong', { texto: String(item.stock) })),
    celda('Reorden', el('span', { texto: String(item.puntoReorden) })),
    el(
      'div',
      { clase: 'ops-celda ops-celda--acciones' },
      item.alertaStockBajo
        ? crearBadge('Stock bajo', 'stock-bajo')
        : crearBadge('Stock normal', 'stock-ok')
    )
  );
}

function crearCabeceraInventario() {
  return el(
    'div',
    { clase: 'ops-tabla-cabecera', atributos: { 'aria-hidden': 'true' } },
    el('span', { texto: 'Producto' }),
    el('span', { texto: 'Variante' }),
    el('span', { texto: 'SKU' }),
    el('span', { texto: 'Stock' }),
    el('span', { texto: 'Reorden' }),
    el('span', { texto: 'Estado' })
  );
}

function siguienteAccion(envio, puedePreparar, puedeDespachar) {
  if (envio.estadoEnvio === 'Pendiente' && puedePreparar) {
    return { tipo: 'estado', estado: 'En preparación', texto: 'Preparar pedido' };
  }
  if (envio.estadoEnvio === 'En preparación' && puedePreparar) {
    return { tipo: 'estado', estado: 'Empacado', texto: 'Marcar empacado' };
  }
  if (envio.estadoEnvio === 'Empacado' && puedeDespachar) {
    return { tipo: 'estado', estado: 'En tránsito', texto: 'Despachar envío' };
  }
  if (envio.estadoEnvio === 'En tránsito' && puedeDespachar) {
    return { tipo: 'entrega', texto: 'Cerrar entrega' };
  }
  return null;
}

function crearFormularioEntrega(envio, alCerrar, alConfirmar) {
  const receptor = el('input', {
    clase: 'entrada',
    type: 'text',
    placeholder: 'Nombre del receptor'
  });
  const fecha = el('input', {
    clase: 'entrada',
    type: 'date',
    value: fechaHoy()
  });
  const hora = el('input', {
    clase: 'entrada',
    type: 'time',
    value: horaAhora()
  });
  const nota = el('textarea', {
    clase: 'entrada entrada-area',
    atributos: { rows: '2', placeholder: 'Nota de entrega' }
  });
  const error = el('div', { clase: 'ops-form-error' });
  const confirmar = boton('Confirmar entrega', {
    tipo: 'button',
    variante: 'primary'
  });
  const cancelar = boton('Cancelar', {
    tipo: 'button',
    variante: 'secondary'
  });

  cancelar.addEventListener('click', alCerrar);
  confirmar.addEventListener('click', async () => {
    error.textContent = '';
    const receptorTexto = receptor.value.trim();
    const notaTexto = nota.value.trim();

    if (receptorTexto.length < 3) {
      error.textContent = 'El receptor debe tener al menos 3 caracteres.';
      receptor.focus();
      return;
    }
    if (notaTexto.length < 3) {
      error.textContent = 'La nota debe tener al menos 3 caracteres.';
      nota.focus();
      return;
    }

    confirmar.disabled = true;

    try {
      await api.crear(`/staff/logistica/envios/${envio.envioId}/entrega`, {
        receptor: receptorTexto,
        fecha_entrega: fecha.value,
        hora_entrega: hora.value,
        nota: notaTexto
      });
      await alConfirmar(envio);
    } catch (errorApi) {
      error.textContent = errorApi.message || 'No se pudo cerrar la entrega.';
      confirmar.disabled = false;
    }
  });

  return el(
    'div',
    { clase: 'ops-entrega-form' },
    el(
      'div',
      { clase: 'ops-form-campos' },
      el('div', { clase: 'campo' }, el('label', {
        clase: 'campo-etiqueta',
        texto: 'Receptor'
      }), receptor),
      el('div', { clase: 'campo' }, el('label', {
        clase: 'campo-etiqueta',
        texto: 'Fecha de entrega'
      }), fecha),
      el('div', { clase: 'campo' }, el('label', {
        clase: 'campo-etiqueta',
        texto: 'Hora de entrega'
      }), hora),
      el('div', { clase: 'campo' }, el('label', {
        clase: 'campo-etiqueta',
        texto: 'Nota'
      }), nota)
    ),
    error,
    el('div', { clase: 'ops-entrega-acciones' }, confirmar, cancelar)
  );
}

function crearTarjetaDespacho(
  envio,
  estadoEntregaAbierta,
  acciones
) {
  const accion = siguienteAccion(
    envio,
    acciones.puedePreparar,
    acciones.puedeDespachar
  );
  const items = Array.isArray(envio.items) ? envio.items : [];
  const resumenItems = items.length
    ? el(
        'ul',
        { clase: 'ops-items' },
        ...items.map((item) =>
          el('li', {
            texto: `${item.producto} · ${item.variante} x${item.cantidad}`
          })
        )
      )
    : el('span', { clase: 'texto-suave', texto: 'Sin artículos registrados.' });

  const tarjeta = el(
    'article',
    { clase: 'ops-despacho' },
    el(
      'header',
      { clase: 'ops-despacho-cabecera' },
      el(
        'div',
        {},
        el('p', { clase: 'rastreo-etiqueta', texto: 'Pedido' }),
        el('h3', { clase: 'ops-despacho-codigo', texto: envio.codigoRastreo })
      ),
      crearBadge(envio.estadoEnvio, claseEstadoEnvio(envio.estadoEnvio))
    ),
    el(
      'dl',
      { clase: 'ops-datos' },
      el('div', {}, el('dt', { texto: 'Cliente' }), el('dd', {
        texto: envio.nombreCliente
      })),
      el('div', {}, el('dt', { texto: 'Ciudad' }), el('dd', {
        texto: envio.ciudad
      })),
      el('div', {}, el('dt', { texto: 'Total' }), el('dd', {
        texto: formatearBs(envio.total)
      })),
      el('div', {}, el('dt', { texto: 'Pago' }), el('dd', {
        texto:
          `${etiquetaMetodo(envio.metodoPago)} · ` +
          `${envio.estadoPago || 'Sin estado'}`
      })),
      el('div', {}, el('dt', { texto: 'Fecha del pedido' }), el('dd', {
        texto: formatearFecha(envio.fechaPedido)
      }))
    ),
    el(
      'div',
      { clase: 'ops-despacho-items' },
      el('h4', { clase: 'ops-subtitulo', texto: 'Artículos' }),
      resumenItems
    )
  );

  if (envio.metodoPago === 'contra_entrega') {
    tarjeta.appendChild(
      el('p', {
        clase: 'pago-aviso',
        texto:
          'Pago contra entrega: al cerrar la entrega quedará ' +
          'Aprobado y Cobrado automáticamente.'
      })
    );
  }

  if (accion) {
    const accionContenedor = el('div', { clase: 'ops-despacho-acciones' });
    const botonAccion = boton(accion.texto, {
      tipo: 'button',
      variante: accion.tipo === 'entrega' ? 'primary' : 'secondary'
    });

    botonAccion.addEventListener('click', () => {
      if (accion.tipo === 'entrega') {
        acciones.alternarEntrega(envio.envioId);
        return;
      }
      acciones.avanzarEstado(envio, accion.estado, botonAccion);
    });

    accionContenedor.appendChild(botonAccion);
    tarjeta.appendChild(accionContenedor);

    if (estadoEntregaAbierta === envio.envioId) {
      tarjeta.appendChild(
        crearFormularioEntrega(
          envio,
          () => acciones.alternarEntrega(null),
          acciones.confirmarEntrega
        )
      );
    }
  } else {
    tarjeta.appendChild(
      el('p', {
        clase: 'pago-aviso',
        texto:
          'Este envío no tiene una acción disponible para tu rol en este momento.'
      })
    );
  }

  return tarjeta;
}

export const vistaOperaciones = {
  async render({ usuario }) {
    const rol = usuario?.rol || '';
    const puedeInventario = ['almacen', 'admin'].includes(rol);
    const puedePreparar = ['almacen', 'admin'].includes(rol);
    const puedeDespachar = ['logistica', 'admin'].includes(rol);

    let inventario = [];
    let despachos = [];
    let cargandoInventario = true;
    let cargandoDespachos = true;
    let errorInventario = '';
    let errorDespachos = '';
    let entregaAbierta = null;
    let pestana = puedeInventario ? 'inventario' : 'despachos';

    const seccion = el(
      'section',
      { clase: 'pagina operaciones-staff' },
      el(
        'header',
        { clase: 'encabezado-pagina' },
        el('h1', { texto: 'Operaciones' }),
        el('p', {
          clase: 'texto-suave',
          texto:
            'Inventario, preparación de pedidos y despacho con trazabilidad completa.'
        })
      )
    );

    const mensajes = el('div', { clase: 'ops-mensajes' });
    const panelInventario = el('section', {
      clase: 'ops-panel',
      atributos: { role: 'tabpanel', 'aria-label': 'Inventario' }
    });
    const panelDespachos = el('section', {
      clase: 'ops-panel',
      atributos: { role: 'tabpanel', 'aria-label': 'Despachos y envíos' }
    });

    const tabs = el('div', {
      clase: 'ops-tabs',
      atributos: { role: 'tablist', 'aria-label': 'Secciones de operaciones' }
    });

    function mostrarMensaje(texto, tipo) {
      mensajes.replaceChildren(alerta(texto, tipo));
    }

    function actualizarTabs() {
      if (!puedeInventario) return;
      panelInventario.hidden = pestana !== 'inventario';
      panelDespachos.hidden = pestana !== 'despachos';
      for (const botonTab of tabs.querySelectorAll('.ops-tab')) {
        const activo = botonTab.dataset.pestana === pestana;
        botonTab.classList.toggle('activo', activo);
        botonTab.setAttribute('aria-selected', activo ? 'true' : 'false');
      }
    }

    function crearTab(etiqueta, valor) {
      const botonTab = el(
        'button',
        {
          clase: `ops-tab${pestana === valor ? ' activo' : ''}`,
          atributos: {
            type: 'button',
            role: 'tab',
            'aria-selected': pestana === valor ? 'true' : 'false'
          }
        },
        el('span', { texto: etiqueta })
      );
      botonTab.dataset.pestana = valor;
      botonTab.addEventListener('click', () => {
        pestana = valor;
        actualizarTabs();
      });
      return botonTab;
    }

    if (puedeInventario) {
      tabs.append(
        crearTab('Inventario', 'inventario'),
        crearTab('Despachos y envíos', 'despachos')
      );
      seccion.append(mensajes, tabs, panelInventario, panelDespachos);
      actualizarTabs();
    } else {
      seccion.append(mensajes, panelDespachos);
      panelInventario.hidden = true;
    }

    function renderInventario() {
      panelInventario.replaceChildren();

      const cabecera = el(
        'div',
        { clase: 'ops-panel-cabecera' },
        el(
          'div',
          {},
          el('h2', { clase: 'ops-titulo', texto: 'Inventario' }),
          el('p', {
            clase: 'texto-suave',
            texto: 'Stock por variante, alertas de reorden y movimientos manuales.'
          })
        )
      );
      panelInventario.appendChild(cabecera);

      if (cargandoInventario) {
        panelInventario.appendChild(
          el('p', { clase: 'cargando', texto: 'Cargando inventario...' })
        );
        return;
      }

      if (errorInventario) {
        panelInventario.appendChild(alerta(errorInventario));
        return;
      }

      const alertas = inventario.filter((item) => item.alertaStockBajo).length;
      panelInventario.appendChild(
        el('p', {
          clase: 'texto-suave',
          texto:
            `${inventario.length} variantes registradas · ` +
            `${alertas} con stock bajo.`
        })
      );

      panelInventario.appendChild(
        crearFormularioAjuste(
          inventario,
          cargarInventario,
          mostrarMensaje
        )
      );

      if (inventario.length === 0) {
        panelInventario.appendChild(
          estadoVacio('No hay variantes de inventario registradas.')
        );
        return;
      }

      panelInventario.appendChild(
        el(
          'div',
          { clase: 'ops-tabla' },
          crearCabeceraInventario(),
          ...inventario.map((item) => crearFilaInventario(item))
        )
      );
    }

    async function cargarInventario() {
      if (!puedeInventario) return;
      cargandoInventario = true;
      errorInventario = '';
      renderInventario();

      try {
        const respuesta = await api.obtener('/inventario');
        inventario = respuesta?.datos?.inventario || [];
      } catch (error) {
        errorInventario =
          error.message || 'No se pudo cargar el inventario.';
      } finally {
        cargandoInventario = false;
        renderInventario();
      }
    }

    function renderDespachos() {
      panelDespachos.replaceChildren();

      panelDespachos.appendChild(
        el(
          'div',
          { clase: 'ops-panel-cabecera' },
          el(
            'div',
            {},
            el('h2', {
              clase: 'ops-titulo',
              texto: 'Despachos y envíos'
            }),
            el('p', {
              clase: 'texto-suave',
              texto:
                'Avanza el envío paso a paso; no se permiten saltos ni retrocesos.'
            })
          ),
          boton('Actualizar cola', {
            tipo: 'button',
            variante: 'outline',
            clase: 'btn-pequeno',
            nombreIcono: 'operaciones'
          })
        )
      );

      const actualizar = panelDespachos.querySelector('button');
      if (actualizar) {
        actualizar.addEventListener('click', () => cargarDespachos());
        actualizar.removeAttribute('id');
      }

      if (cargandoDespachos) {
        panelDespachos.appendChild(
          el('p', { clase: 'cargando', texto: 'Cargando despachos...' })
        );
        return;
      }

      if (errorDespachos) {
        panelDespachos.appendChild(alerta(errorDespachos));
        return;
      }

      if (despachos.length === 0) {
        panelDespachos.appendChild(
          estadoVacio('No hay envíos pendientes para tu rol.')
        );
        return;
      }

      panelDespachos.appendChild(
        el(
          'div',
          { clase: 'ops-despachos-lista' },
          ...despachos.map((envio) =>
            crearTarjetaDespacho(envio, entregaAbierta, {
              puedePreparar,
              puedeDespachar,
              alternarEntrega: (envioId) => {
                entregaAbierta = envioId;
                renderDespachos();
              },
              avanzarEstado: async (envio, estado, botonAccion) => {
                botonAccion.disabled = true;
                try {
                  const segmento = estado === 'En tránsito'
                    ? 'logistica'
                    : 'almacen';
                  await api.parchear(
                    `/staff/${segmento}/envios/${envio.envioId}/estado`,
                    { estado }
                  );
                  mostrarMensaje(
                    `Envío ${envio.codigoRastreo} actualizado a '${estado}'.`,
                    'exito'
                  );
                  await cargarDespachos();
                } catch (error) {
                  mostrarMensaje(
                    error.message || 'No se pudo avanzar el envío.'
                  );
                  botonAccion.disabled = false;
                }
              },
              confirmarEntrega: async (envio) => {
                entregaAbierta = null;
                mostrarMensaje(
                  `Entrega de ${envio.codigoRastreo} registrada. ` +
                    'Si era contra entrega, el pago quedó Aprobado/Cobrado.',
                  'exito'
                );
                await cargarDespachos();
              }
            })
          )
        )
      );
    }

    async function cargarDespachos() {
      cargandoDespachos = true;
      errorDespachos = '';
      entregaAbierta = entregaAbierta;
      renderDespachos();

      try {
        const rutas = [];
        if (puedePreparar) rutas.push('/staff/almacen/despachos');
        if (puedeDespachar) rutas.push('/staff/logistica/despachos');
        const respuestas = await Promise.all(
          rutas.map((ruta) => api.obtener(ruta))
        );
        const mapa = new Map();
        for (const respuesta of respuestas) {
          for (const envio of respuesta?.datos?.pedidos || []) {
            mapa.set(envio.envioId, envio);
          }
        }
        despachos = Array.from(mapa.values());
      } catch (error) {
        errorDespachos =
          error.message || 'No se pudo cargar la cola de despachos.';
      } finally {
        cargandoDespachos = false;
        renderDespachos();
      }
    }

    await Promise.all([
      puedeInventario ? cargarInventario() : Promise.resolve(),
      cargarDespachos()
    ]);

    return seccion;
  }
};
