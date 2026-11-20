/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: PUNTO DE VENTA (/staff/pos)
 * ============================================================================
 * Vendedor y admin. Carrito de mostrador con búsqueda instantánea, venta
 * atómica en el servidor, comprobante PDF e historial/cierre de caja.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs, formatearFecha } from '../../core/formato.js';
import { alerta, boton, estadoVacio } from '../comunes.js';
import {
  crearCeldaStaff,
  crearTablaStaff
} from './tablaResponsiva.js';

const METODOS = ['Efectivo', 'QR Simple'];

function hoyLocal() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function crearCampo(etiqueta, entrada) {
  return el(
    'div',
    { clase: 'campo' },
    el('label', { clase: 'campo-etiqueta', texto: etiqueta }),
    entrada
  );
}

function totalCarrito(carrito) {
  return Math.round(
    carrito.reduce((total, item) => total + item.subtotal, 0) * 100
  ) / 100;
}

function subtotalItem(item) {
  return Math.round(item.precioUnitario * item.cantidad * 100) / 100;
}

export const vistaPos = {
  async render() {
    let tab = 'venta';
    let resultados = [];
    let producto = null;
    let variantes = [];
    let carrito = [];
    let historial = [];
    let cierre = null;
    let fechaHistorial = hoyLocal();
    let timerBusqueda = null;

    const seccion = el(
      'section',
      { clase: 'pagina pos-staff' },
      el(
        'header',
        { clase: 'encabezado-pagina' },
        el('h1', { texto: 'Punto de venta' }),
        el('p', {
          clase: 'texto-suave',
          texto:
            'Ventas presenciales con búsqueda por SKU, carrito y comprobante.'
        })
      )
    );

    const mensajes = el('div', { clase: 'pos-mensajes' });
    const panelVenta = el('section', {
      clase: 'ops-panel',
      atributos: { role: 'tabpanel', 'aria-label': 'Venta' }
    });
    const panelHistorial = el('section', {
      clase: 'ops-panel',
      atributos: { role: 'tabpanel', 'aria-label': 'Historial y cierre' }
    });
    const tabs = el('div', {
      clase: 'ops-tabs',
      atributos: { role: 'tablist', 'aria-label': 'Secciones del punto de venta' }
    });

    function crearTab(etiqueta, valor) {
      const control = el(
        'button',
        {
          clase: `ops-tab${tab === valor ? ' activo' : ''}`,
          atributos: {
            type: 'button',
            role: 'tab',
            'aria-selected': tab === valor ? 'true' : 'false'
          }
        },
        el('span', { texto: etiqueta })
      );
      control.dataset.pestana = valor;
      control.addEventListener('click', () => {
        tab = valor;
        actualizarTabs();
      });
      return control;
    }

    function actualizarTabs() {
      panelVenta.hidden = tab !== 'venta';
      panelHistorial.hidden = tab !== 'historial';
      for (const control of tabs.querySelectorAll('.ops-tab')) {
        const activo = control.dataset.pestana === tab;
        control.classList.toggle('activo', activo);
        control.setAttribute('aria-selected', activo ? 'true' : 'false');
      }
    }

    function mostrarMensaje(texto, tipo = 'error') {
      mensajes.replaceChildren(alerta(texto, tipo));
    }

    tabs.append(
      crearTab('Venta', 'venta'),
      crearTab('Historial y cierre de caja', 'historial')
    );
    seccion.append(mensajes, tabs, panelVenta, panelHistorial);
    actualizarTabs();

    // ------------------------------------------------------------------------
    // Buscador y selector de variantes
    // ------------------------------------------------------------------------
    const buscador = el('input', {
      clase: 'entrada',
      type: 'search',
      placeholder: 'Buscar producto, categoría o SKU',
      atributos: { 'aria-label': 'Buscar producto para POS' }
    });
    const resultadosCont = el('div', { clase: 'pos-resultados' });
    const variantesCont = el('div', { clase: 'pos-variantes' });

    const panelBusqueda = el(
      'section',
      { clase: 'pos-panel pos-panel-busqueda' },
      el('h2', { clase: 'ops-titulo', texto: 'Buscar productos' }),
      buscador,
      resultadosCont,
      variantesCont
    );

    function renderResultados() {
      if (resultados.length === 0) {
        resultadosCont.replaceChildren(
          estadoVacio('No encontramos productos para esa búsqueda.')
        );
        return;
      }

      resultadosCont.replaceChildren(
        ...resultados.map((item) => {
          const ver = boton('Ver variantes', {
            tipo: 'button',
            variante: 'outline',
            clase: 'btn-pequeno'
          });
          ver.addEventListener('click', () => seleccionarProducto(item.slug));

          return el(
            'article',
            { clase: 'pos-producto' },
            el(
              'div',
              { clase: 'pos-producto-info' },
              el('strong', { texto: item.nombre }),
              el('span', {
                clase: 'texto-suave',
                texto:
                  `${item.categoriaNombre || 'Sin categoría'} · ` +
                  `Stock ${item.stockTotal ?? 0}`
              })
            ),
            el(
              'div',
              { clase: 'pos-producto-acciones' },
              el('strong', {
                clase: 'pos-precio',
                texto: formatearBs(item.precioMin ?? 0)
              }),
              ver
            )
          );
        })
      );
    }

    async function buscar(termino) {
      try {
        const respuesta = await api.obtener(
          `/productos?buscar=${encodeURIComponent(termino)}` +
            '&limite=20&orden=nombre_asc'
        );
        resultados = respuesta?.datos?.productos || [];
        renderResultados();
      } catch (error) {
        resultadosCont.replaceChildren(
          alerta(error.message || 'No se pudo buscar productos.')
        );
      }
    }

    function renderVariantes() {
      if (!producto) {
        variantesCont.replaceChildren();
        return;
      }

      const filas = variantes.map((variante) => {
        const enCarrito = carrito.find(
          (item) => item.varianteId === Number(variante.id)
        );
        const disponible =
          Number(variante.stock) - (enCarrito ? enCarrito.cantidad : 0);
        const agregar = boton('Agregar', {
          tipo: 'button',
          variante: 'primary',
          clase: 'btn-pequeno'
        });
        agregar.disabled = disponible <= 0;
        agregar.addEventListener('click', () => agregarVariante(variante));

        return el(
          'article',
          { clase: 'pos-variante' },
          el(
            'div',
            { clase: 'pos-variante-info' },
            el('strong', { texto: variante.nombre }),
            el('span', {
              clase: 'staff-sku',
              texto: variante.sku || 'Sin SKU'
            }),
            el('span', {
              clase: disponible <= 0 ? 'texto-error' : 'texto-suave',
              texto:
                disponible <= 0
                  ? 'Sin stock disponible'
                  : `Stock: ${disponible}`
            })
          ),
          el(
            'div',
            { clase: 'pos-variante-acciones' },
            el('strong', {
              clase: 'pos-precio',
              texto: formatearBs(variante.precio)
            }),
            agregar
          )
        );
      });

      variantesCont.replaceChildren(
        el(
          'section',
          { clase: 'pos-panel pos-variantes-panel' },
          el('h3', { clase: 'pos-subtitulo', texto: producto.nombre }),
          el('p', {
            clase: 'texto-suave',
            texto: 'Selecciona la variante que se llevará el cliente.'
          }),
          el('div', { clase: 'pos-variantes-lista' }, ...filas)
        )
      );
    }

    async function seleccionarProducto(slug) {
      variantesCont.replaceChildren(
        el('p', { clase: 'cargando', texto: 'Cargando variantes...' })
      );

      try {
        const respuesta = await api.obtener(
          `/productos/${encodeURIComponent(slug)}`
        );
        producto = respuesta?.datos?.producto || null;
        variantes = producto?.variantes || [];
        renderVariantes();
      } catch (error) {
        variantesCont.replaceChildren(
          alerta(error.message || 'No se pudieron cargar las variantes.')
        );
      }
    }

    // ------------------------------------------------------------------------
    // Carrito de mostrador
    // ------------------------------------------------------------------------
    const lineasCarrito = el('div', { clase: 'pos-lineas' });
    const subtotalValor = el('span', { texto: formatearBs(0) });
    const totalValor = el('strong', { texto: formatearBs(0) });
    const mensajesVenta = el('div', { clase: 'pos-mensajes-venta' });
    const resultadoVenta = el('div', { clase: 'pos-resultado-venta' });

    const clienteNombre = el('input', {
      clase: 'entrada',
      type: 'text',
      placeholder: 'Opcional'
    });
    const clienteNit = el('input', {
      clase: 'entrada',
      type: 'text',
      placeholder: 'Opcional'
    });
    const clienteCorreo = el('input', {
      clase: 'entrada',
      type: 'email',
      placeholder: 'Opcional'
    });
    const metodoPago = el(
      'select',
      { clase: 'entrada', atributos: { 'aria-label': 'Método de pago' } },
      ...METODOS.map((metodo) =>
        el('option', { value: metodo, texto: metodo })
      )
    );
    const montoRecibido = el('input', {
      clase: 'entrada',
      type: 'number',
      min: '0',
      step: '0.01',
      value: '0'
    });
    const grupoMonto = crearCampo('Monto recibido', montoRecibido);
    grupoMonto.hidden = false;

    const botonVenta = boton('Registrar venta', {
      tipo: 'submit',
      variante: 'primary',
      nombreIcono: 'pos'
    });
    const botonVentaTexto = botonVenta.querySelector('span');

    const formularioVenta = el(
      'form',
      { clase: 'pos-form-venta' },
      el(
        'div',
        { clase: 'pos-panel pos-panel-cliente' },
        el('h3', { clase: 'pos-subtitulo', texto: 'Datos de la venta' }),
        el(
          'div',
          { clase: 'pos-form-campos' },
          crearCampo('Nombre del cliente', clienteNombre),
          crearCampo('NIT / CI', clienteNit),
          crearCampo('Correo electrónico', clienteCorreo),
          crearCampo('Método de pago', metodoPago),
          grupoMonto
        )
      ),
      mensajesVenta,
      botonVenta
    );

    const panelCarrito = el(
      'aside',
      { clase: 'pos-panel pos-panel-carrito' },
      el('h2', { clase: 'ops-titulo', texto: 'Carrito de mostrador' }),
      lineasCarrito,
      el(
        'div',
        { clase: 'pos-resumen' },
        el(
          'div',
          { clase: 'pos-resumen-linea' },
          el('span', { texto: 'Subtotal' }),
          subtotalValor
        ),
        el(
          'div',
          { clase: 'pos-resumen-total' },
          el('span', { texto: 'Total' }),
          totalValor
        )
      ),
      formularioVenta,
      resultadoVenta
    );

    panelVenta.append(
      el(
        'div',
        { clase: 'pos-grid' },
        panelBusqueda,
        panelCarrito
      )
    );

    function actualizarBotonVenta() {
      botonVenta.disabled = carrito.length === 0;
    }

    function renderCarrito() {
      if (carrito.length === 0) {
        lineasCarrito.replaceChildren(
          estadoVacio('El carrito está vacío. Agrega una variante para vender.')
        );
      } else {
        lineasCarrito.replaceChildren(
          ...carrito.map((item) => {
            const restar = el(
              'button',
              {
                clase: 'carrito-cantidad-boton',
                atributos: {
                  type: 'button',
                  'aria-label': `Reducir ${item.productoNombre}`
                },
                disabled: item.cantidad <= 1
              },
              icono('menos', 14)
            );
            const sumar = el(
              'button',
              {
                clase: 'carrito-cantidad-boton',
                atributos: {
                  type: 'button',
                  'aria-label': `Aumentar ${item.productoNombre}`
                },
                disabled: item.cantidad >= item.stock
              },
              icono('mas', 14)
            );
            restar.addEventListener('click', () =>
              cambiarCantidad(item, item.cantidad - 1)
            );
            sumar.addEventListener('click', () =>
              cambiarCantidad(item, item.cantidad + 1)
            );

            const quitar = el(
              'button',
              {
                clase: 'pos-linea-quitar',
                atributos: {
                  type: 'button',
                  'aria-label': `Quitar ${item.productoNombre}`
                }
              },
              icono('papelera', 16)
            );
            quitar.addEventListener('click', () => quitarLinea(item));

            return el(
              'article',
              { clase: 'pos-linea' },
              el(
                'div',
                { clase: 'pos-linea-info' },
                el('strong', { texto: item.productoNombre }),
                el('span', { clase: 'texto-suave', texto: item.varianteNombre }),
                el('span', { clase: 'staff-sku', texto: item.sku || 'Sin SKU' }),
                el('span', {
                  clase: 'texto-suave',
                  texto: `${formatearBs(item.precioUnitario)} c/u`
                })
              ),
              el(
                'div',
                { clase: 'pos-linea-controles' },
                el('div', { clase: 'carrito-cantidad' }, restar,
                  el('output', {
                    clase: 'carrito-cantidad-valor',
                    texto: String(item.cantidad)
                  }),
                  sumar
                ),
                el('strong', {
                  clase: 'pos-linea-subtotal',
                  texto: formatearBs(item.subtotal)
                }),
                quitar
              )
            );
          })
        );
      }

      const subtotal = totalCarrito(carrito);
      subtotalValor.textContent = formatearBs(subtotal);
      totalValor.textContent = formatearBs(subtotal);
      actualizarBotonVenta();
    }

    function actualizarBotonVariantes() {
      if (producto) renderVariantes();
    }

    function agregarVariante(variante) {
      const varianteId = Number(variante.id);
      const stock = Number(variante.stock);
      const existente = carrito.find((item) => item.varianteId === varianteId);
      const cantidadActual = existente ? existente.cantidad : 0;

      if (cantidadActual >= stock) {
        mostrarMensaje(
          `No hay más stock disponible de ${variante.nombre}.`
        );
        return;
      }

      if (existente) {
        existente.cantidad += 1;
        existente.subtotal = subtotalItem(existente);
      } else {
        carrito.push({
          varianteId,
          productoNombre: producto?.nombre || 'Producto',
          varianteNombre: variante.nombre,
          sku: variante.sku,
          precioUnitario: Number(variante.precio),
          stock,
          cantidad: 1,
          subtotal: Number(variante.precio)
        });
      }

      renderCarrito();
      actualizarBotonVariantes();
    }

    function cambiarCantidad(item, cantidad) {
      if (cantidad < 1) return;
      if (cantidad > item.stock) {
        mostrarMensaje(`Stock disponible: ${item.stock}.`);
        return;
      }
      item.cantidad = cantidad;
      item.subtotal = subtotalItem(item);
      renderCarrito();
      actualizarBotonVariantes();
    }

    function quitarLinea(item) {
      carrito = carrito.filter((actual) => actual.varianteId !== item.varianteId);
      renderCarrito();
      actualizarBotonVariantes();
    }

    metodoPago.addEventListener('change', () => {
      grupoMonto.hidden = metodoPago.value !== 'Efectivo';
    });

    function renderComprobante(venta) {
      const codigo = String(venta.numeroTicket || '');
      const pdfUrl =
        `/api/pos/ventas/${encodeURIComponent(String(venta.id))}` +
        '/comprobante-pdf';
      const enlace = el(
        'a',
        {
          clase: 'btn btn-primary',
          href: pdfUrl,
          atributos: {
            download: '',
            'aria-label': 'Descargar comprobante PDF'
          }
        },
        icono('descargar', 16),
        el('span', { texto: 'Descargar comprobante' })
      );
      const nuevo = boton('Nueva venta', {
        tipo: 'button',
        variante: 'outline'
      });
      nuevo.addEventListener('click', () => {
        resultadoVenta.replaceChildren();
      });

      resultadoVenta.replaceChildren(
        el(
          'section',
          { clase: 'pos-exito' },
          el('h3', { texto: 'Venta registrada' }),
          el('p', {
            clase: 'texto-suave',
            texto:
              `Ticket ${codigo} · ` +
              `Factura ${venta.factura?.numeroFactura || 'Sin factura'}`
          }),
          el('p', {
            clase: 'pos-exito-total',
            texto: `Total: ${formatearBs(venta.total)}`
          }),
          el('p', {
            clase: 'pago-aviso',
            texto:
              'Comprobante académico de simulación — Sin valor fiscal.'
          }),
          venta.clienteCorreo
            ? el('p', {
                clase: 'pago-aviso',
                texto:
                  'Se solicitó el envío del comprobante al correo ingresado.'
              })
            : null,
          el('div', { clase: 'pos-exito-acciones' }, enlace, nuevo)
        )
      );
    }

    formularioVenta.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      mensajesVenta.replaceChildren();

      const subtotal = totalCarrito(carrito);
      if (carrito.length === 0) {
        mensajesVenta.replaceChildren(alerta('Agrega al menos una variante.'));
        return;
      }

      const metodo = metodoPago.value;
      const recibido = Number(montoRecibido.value) || 0;

      if (metodo === 'Efectivo' && recibido < subtotal) {
        mensajesVenta.replaceChildren(
          alerta(
            `El monto recibido debe cubrir el total de ` +
              `${formatearBs(subtotal)}.`
          )
        );
        montoRecibido.focus();
        return;
      }

      const correo = clienteCorreo.value.trim();
      if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        mensajesVenta.replaceChildren(
          alerta('El correo electrónico no tiene un formato válido.')
        );
        clienteCorreo.focus();
        return;
      }

      botonVenta.disabled = true;
      botonVentaTexto.textContent = 'Procesando...';

      try {
        const respuesta = await api.crear('/pos', {
          items: carrito.map((item) => ({
            variante_id: item.varianteId,
            cantidad: item.cantidad
          })),
          metodo_pago: metodo,
          monto_recibido: metodo === 'Efectivo' ? recibido : subtotal,
          cliente_nombre: clienteNombre.value.trim() || undefined,
          cliente_nit_ci: clienteNit.value.trim() || undefined,
          cliente_correo: correo || undefined
        });
        const venta = respuesta?.datos?.venta;
        if (!venta) throw new Error('La venta no devolvió comprobante.');

        carrito = [];
        formularioVenta.reset();
        metodoPago.value = 'Efectivo';
        grupoMonto.hidden = false;
        producto = null;
        variantes = [];
        variantesCont.replaceChildren();
        renderCarrito();
        renderComprobante(venta);
        botonVentaTexto.textContent = 'Registrar venta';
        await buscar(buscador.value.trim());
        await cargarHistorial();
      } catch (error) {
        mensajesVenta.replaceChildren(
          alerta(error.message || 'No se pudo registrar la venta.')
        );
      } finally {
        botonVenta.disabled = carrito.length === 0;
        botonVentaTexto.textContent = 'Registrar venta';
      }
    });

    renderCarrito();

    buscador.addEventListener('input', () => {
      if (timerBusqueda) clearTimeout(timerBusqueda);
      timerBusqueda = setTimeout(() => {
        buscar(buscador.value.trim());
      }, 250);
    });

    await buscar('');

    // ------------------------------------------------------------------------
    // Historial y cierre de caja
    // ------------------------------------------------------------------------
    const fechaInput = el('input', {
      clase: 'entrada',
      type: 'date',
      value: fechaHistorial,
      atributos: { 'aria-label': 'Fecha del historial' }
    });
    const actualizarHistorial = boton('Actualizar', {
      tipo: 'button',
      variante: 'outline',
      clase: 'btn-pequeno',
      nombreIcono: 'reportes'
    });
    const resumenCierre = el('div', { clase: 'pos-cierre' });
    const tablaHistorial = el('div', { clase: 'pos-historial' });

    panelHistorial.append(
      el(
        'div',
        { clase: 'ops-panel-cabecera' },
        el(
          'div',
          {},
          el('h2', {
            clase: 'ops-titulo',
            texto: 'Historial y cierre de caja'
          }),
          el('p', {
            clase: 'texto-suave',
            texto: 'Ventas del día y totales por método de pago.'
          })
        ),
        el(
          'div',
          { clase: 'pos-filtro-fecha' },
          fechaInput,
          actualizarHistorial
        )
      ),
      resumenCierre,
      tablaHistorial
    );

    const COLUMNAS_HISTORIAL = [
      { etiqueta: 'Ticket', clase: 'staff-col-codigo' },
      { etiqueta: 'Factura' },
      { etiqueta: 'Fecha' },
      { etiqueta: 'Vendedor' },
      { etiqueta: 'Método' },
      { etiqueta: 'Total', clase: 'staff-numero' },
      { etiqueta: 'Cliente' },
      { etiqueta: 'Comprobante', clase: 'staff-col-acciones' }
    ];

    function renderCierre() {
      if (!cierre) {
        resumenCierre.replaceChildren();
        return;
      }

      const datos = [
        ['Tickets', String(cierre.totalTickets ?? 0)],
        ['Total recaudado', formatearBs(cierre.totalRecaudado ?? 0)],
        ['Efectivo', formatearBs(cierre.totalEfectivo ?? 0)],
        ['QR Simple', formatearBs(cierre.totalQR ?? 0)]
      ];

      resumenCierre.replaceChildren(
        ...datos.map(([etiqueta, valor]) =>
          el(
            'article',
            { clase: 'pos-cierre-tarjeta' },
            el('span', { texto: etiqueta }),
            el('strong', { texto: valor })
          )
        )
      );
    }

    function renderHistorial() {
      if (historial.length === 0) {
        tablaHistorial.replaceChildren(
          estadoVacio('No hay ventas registradas para esta fecha.')
        );
        return;
      }

      const filas = historial.map((venta) => {
        const pdfUrl =
          `/api/pos/ventas/${encodeURIComponent(String(venta.id))}` +
          '/comprobante-pdf';
        const enlace = el(
          'a',
          {
            clase: 'btn btn-outline btn-pequeno',
            href: pdfUrl,
            atributos: {
              download: '',
              'aria-label': 'Descargar comprobante PDF'
            }
          },
          icono('descargar', 14),
          el('span', { texto: 'PDF' })
        );

        return el(
          'tr',
          {},
          crearCeldaStaff(
            'Ticket',
            el('strong', { texto: venta.numeroTicket }),
            'staff-col-codigo'
          ),
          crearCeldaStaff(
            'Factura',
            el('span', { texto: venta.numeroFactura || 'Sin factura' })
          ),
          crearCeldaStaff(
            'Fecha',
            el('span', { texto: formatearFecha(venta.creadoEn) })
          ),
          crearCeldaStaff(
            'Vendedor',
            el('span', { texto: venta.vendedorNombre || 'Sin vendedor' })
          ),
          crearCeldaStaff(
            'Método',
            el('span', { texto: venta.metodoPago })
          ),
          crearCeldaStaff(
            'Total',
            el('span', { texto: formatearBs(venta.total) }),
            'staff-numero'
          ),
          crearCeldaStaff(
            'Cliente',
            el('span', { texto: venta.clienteNombre || 'Ocasional' })
          ),
          crearCeldaStaff('Comprobante', enlace, 'staff-col-acciones')
        );
      });

      tablaHistorial.replaceChildren(
        crearTablaStaff(COLUMNAS_HISTORIAL, filas)
      );
    }

    async function cargarHistorial() {
      fechaHistorial = fechaInput.value || hoyLocal();
      tablaHistorial.replaceChildren(
        el('p', { clase: 'cargando', texto: 'Cargando historial...' })
      );

      try {
        const [resHistorial, resCierre] = await Promise.all([
          api.obtener(
            `/pos/historial?fecha=${encodeURIComponent(fechaHistorial)}`
          ),
          api.obtener(
            `/pos/cierre-caja?fecha=${encodeURIComponent(fechaHistorial)}`
          )
        ]);
        historial = resHistorial?.datos?.ventas || [];
        cierre = resCierre?.datos?.cierre || null;
        renderCierre();
        renderHistorial();
      } catch (error) {
        tablaHistorial.replaceChildren(
          alerta(error.message || 'No se pudo cargar el historial.')
        );
      }
    }

    fechaInput.addEventListener('change', () => cargarHistorial());
    actualizarHistorial.addEventListener('click', () => cargarHistorial());

    await cargarHistorial();
    return seccion;
  }
};
