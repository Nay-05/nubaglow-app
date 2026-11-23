/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: TOTEM DE AUTOSERVICIO (/totem)
 * ============================================================================
 * Interfaz tactil para totem Android en resolucion vertical:
 * 1. Seleccion de productos por categoria con tarjetas grandes (+/- 56px).
 * 2. Datos rapidos del cliente y metodo de pago (tarjeta ATM o QR bancario).
 * 3. Pinpad POS simulado con PIN de 4 digitos y emision de ticket termico.
 *
 * Toda la validacion de precios, stock y autorizacion ocurre en el servidor.
 * Un temporizador de inactividad de 60 segundos reinicia el pedido para el
 * siguiente cliente. El ticket se imprime con @page size: 80mm auto.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs, formatearFecha } from '../../core/formato.js';

const SEGUNDOS_INACTIVIDAD = 60;
const METODO_TARJETA = 'Tarjeta Débito ATM (POS)';
const METODO_QR = 'QR Bancario';
const IMAGEN_RESPALDO = '/assets/brand/icono1.png';

function calcularTotal(carrito) {
  let total = 0;
  for (const item of carrito.values()) {
    total += item.variante.precio * item.cantidad;
  }
  return Math.round(total * 100) / 100;
}

function contarArticulos(carrito) {
  let total = 0;
  for (const item of carrito.values()) total += item.cantidad;
  return total;
}

export const vistaTotem = {
  async render() {
    const estado = {
      paso: 1,
      catalogoCargado: false,
      categorias: [],
      variantes: [],
      filtroCategoria: '',
      carrito: new Map(),
      clienteNombre: '',
      clienteNitCi: '',
      metodoPago: METODO_TARJETA,
      pin: '',
      tarjetaUltimos4: '',
      tarjetaInsertada: false,
      procesando: false,
      venta: null,
      error: ''
    };

    let restante = SEGUNDOS_INACTIVIDAD;
    let intervalo = null;

    const raiz = el('section', { clase: 'totem' });

    // ------------------------------------------------------------------
    // Cabecera con marca, temporizador y reinicio.
    // ------------------------------------------------------------------
    const timerTexto = el('span', { clase: 'totem-timer-texto', texto: '60 s' });
    const timer = el('div', {
      clase: 'totem-timer',
      atributos: { role: 'status', 'aria-label': 'Tiempo antes de reiniciar' }
    });

    timer.append(icono('reloj', 20), timerTexto);

    const botonReset = el(
      'button',
      {
        clase: 'totem-btn totem-btn-claro',
        atributos: { type: 'button' },
        on: {
          click: () =>
            reiniciarPedido('Pedido reiniciado. Puede comenzar de nuevo.')
        }
      },
      icono('reiniciar', 22),
      el('span', { texto: 'Reiniciar / Cancelar' })
    );

    const cabecera = el(
      'header',
      { clase: 'totem-cabecera' },
      el(
        'div',
        { clase: 'totem-marca' },
        el('img', {
          clase: 'totem-logo',
          src: '/assets/brand/logo-nubaglow.png',
          alt: 'NubaGlow'
        }),
        el(
          'div',
          {},
          el('p', { clase: 'totem-marca-nombre', texto: 'NubaGlow' }),
          el('p', {
            clase: 'totem-marca-sub',
            texto: 'Autoservicio · Sucre, Bolivia'
          })
        )
      ),
      el('div', { clase: 'totem-cabecera-acciones' }, timer, botonReset)
    );

    // ------------------------------------------------------------------
    // Barra de progreso tactil de 3 pasos.
    // ------------------------------------------------------------------
    const pasos = [
      { numero: 1, etiqueta: 'Productos' },
      { numero: 2, etiqueta: 'Datos y pago' },
      { numero: 3, etiqueta: 'Pago y ticket' }
    ];

    const itemsPasos = pasos.map((paso) => {
      const item = el(
        'li',
        { clase: 'totem-paso' },
        el('span', { clase: 'totem-paso-numero', texto: String(paso.numero) }),
        el('span', { clase: 'totem-paso-texto', texto: paso.etiqueta })
      );
      item.dataset.paso = String(paso.numero);
      return item;
    });

    const barraPasos = el(
      'ol',
      {
        clase: 'totem-pasos',
        atributos: { role: 'progressbar', 'aria-label': 'Progreso de la compra' }
      },
      ...itemsPasos
    );

    // ------------------------------------------------------------------
    // Paneles de los tres pasos.
    // ------------------------------------------------------------------
    const paneles = {
      1: el('section', {
        clase: 'totem-panel',
        atributos: { 'aria-label': 'Paso 1: seleccion de productos' }
      }),
      2: el('section', {
        clase: 'totem-panel',
        atributos: { 'aria-label': 'Paso 2: datos y método de pago' }
      }),
      3: el('section', {
        clase: 'totem-panel',
        atributos: { 'aria-label': 'Paso 3: pago y ticket' }
      })
    };

    const avisos = el('div', {
      clase: 'totem-avisos',
      atributos: { 'aria-live': 'polite' }
    });

    // ------------------------------------------------------------------
    // Elementos del paso 1.
    // ------------------------------------------------------------------
    const chipsCategoria = el('div', { clase: 'totem-chips' });
    const grilla = el('div', { clase: 'totem-grilla' });
    const textoConteo = el('span', { clase: 'totem-resumen-conteo', texto: '0 artículos' });
    const textoTotal = el('strong', { clase: 'totem-resumen-total', texto: 'Bs. 0,00' });
    const mensajePaso1 = el('p', { clase: 'totem-error' });
    const botonContinuar = el(
      'button',
      { clase: 'totem-btn totem-btn-primario', atributos: { type: 'button' } },
      el('span', { texto: 'Continuar a datos' }),
      icono('flecha', 24)
    );

    paneles[1].append(
      el(
        'div',
        { clase: 'totem-panel-cabecera' },
        el('div', {},
          el('p', { clase: 'totem-eyebrow', texto: 'Paso 1' }),
          el('h1', { clase: 'totem-titulo', texto: 'Elige tus productos' }),
          el('p', {
            clase: 'totem-subtitulo',
            texto: 'Toca los botones + y - para ajustar cantidades.'
          })
        )
      ),
      chipsCategoria,
      grilla,
      mensajePaso1,
      el(
        'div',
        { clase: 'totem-barra-acciones' },
        el(
          'div',
          { clase: 'totem-resumen' },
          el('span', { clase: 'totem-resumen-etiqueta', texto: 'Tu pedido' }),
          textoTotal,
          textoConteo
        ),
        botonContinuar
      )
    );

    // ------------------------------------------------------------------
    // Logica del temporizador de inactividad.
    // ------------------------------------------------------------------
    function actualizarTimer() {
      timerTexto.textContent = `${Math.max(0, restante)} s`;
      timer.classList.toggle('totem-timer-alerta', restante <= 10);
    }

    function registrarActividad() {
      restante = SEGUNDOS_INACTIVIDAD;
      actualizarTimer();
    }

    function iniciarTimer() {
      intervalo = window.setInterval(() => {
        if (!raiz.isConnected) {
          window.clearInterval(intervalo);
          intervalo = null;
          return;
        }
        if (estado.procesando) return;

        restante -= 1;
        if (restante <= 0) {
          reiniciarPedido('Sesión reiniciada por inactividad.');
          return;
        }
        actualizarTimer();
      }, 1000);
    }

    raiz.addEventListener('pointerdown', registrarActividad, { passive: true });
    raiz.addEventListener('keydown', registrarActividad);
    raiz.addEventListener('input', registrarActividad);

    // ------------------------------------------------------------------
    // Avisos flotantes.
    // ------------------------------------------------------------------
    function mostrarAviso(mensaje, tipo = 'info') {
      if (!mensaje) return;
      const aviso = el('div', { clase: `totem-aviso totem-aviso-${tipo}`, texto: mensaje });
      avisos.appendChild(aviso);
      window.setTimeout(() => aviso.remove(), 6000);
    }

    // ------------------------------------------------------------------
    // Navegacion entre pasos y progreso.
    // ------------------------------------------------------------------
    function actualizarProgreso() {
      for (const item of itemsPasos) {
        const numero = Number(item.dataset.paso);
        item.classList.toggle('activo', numero === estado.paso);
        item.classList.toggle('completado', numero < estado.paso);
        if (numero === estado.paso) {
          item.setAttribute('aria-current', 'step');
        } else {
          item.removeAttribute('aria-current');
        }
      }
      barraPasos.setAttribute('aria-valuenow', String(estado.paso));
      barraPasos.setAttribute('aria-valuemin', '1');
      barraPasos.setAttribute('aria-valuemax', '3');
    }

    function mostrarPaso() {
      actualizarProgreso();
      paneles[1].hidden = estado.paso !== 1;
      paneles[2].hidden = estado.paso !== 2;
      paneles[3].hidden = estado.paso !== 3;

      if (estado.paso === 1) {
        renderChips();
        renderGrilla();
        actualizarBarra();
      }
      if (estado.paso === 2) renderPaso2();
      if (estado.paso === 3) renderPaso3();
    }

    // ------------------------------------------------------------------
    // Paso 1: categorias, tarjetas y cantidades.
    // ------------------------------------------------------------------
    function renderChips() {
      const opciones = [
        { slug: '', nombre: 'Todos' },
        ...estado.categorias.map((categoria) => ({
          slug: categoria.slug,
          nombre: categoria.nombre
        }))
      ];

      chipsCategoria.replaceChildren(
        ...opciones.map((opcion) => {
          const activo = estado.filtroCategoria === opcion.slug;
          const chip = el(
            'button',
            {
              clase: `totem-chip${activo ? ' activo' : ''}`,
              atributos: {
                type: 'button',
                'aria-pressed': activo ? 'true' : 'false'
              }
            },
            el('span', { texto: opcion.nombre })
          );
          chip.addEventListener('click', () => {
            estado.filtroCategoria = opcion.slug;
            registrarActividad();
            renderChips();
            renderGrilla();
          });
          return chip;
        })
      );
    }

    function variantesFiltradas() {
      if (!estado.filtroCategoria) return estado.variantes;
      return estado.variantes.filter(
        (variante) => variante.categoriaSlug === estado.filtroCategoria
      );
    }

    function crearTarjetaProducto(variante) {
      const item = estado.carrito.get(variante.varianteId);
      const cantidad = item ? item.cantidad : 0;

      const menos = el(
        'button',
        {
          clase: 'totem-stepper',
          atributos: {
            type: 'button',
            'aria-label': `Quitar una unidad de ${variante.productoNombre}`
          },
          disabled: cantidad <= 0,
          on: { click: () => cambiarCantidad(variante, -1) }
        },
        icono('menos', 26)
      );

      const mas = el(
        'button',
        {
          clase: 'totem-stepper',
          atributos: {
            type: 'button',
            'aria-label': `Agregar una unidad de ${variante.productoNombre}`
          },
          disabled: cantidad >= variante.stock,
          on: { click: () => cambiarCantidad(variante, 1) }
        },
        icono('mas', 26)
      );

      return el(
        'article',
        { clase: `totem-tarjeta${cantidad > 0 ? ' seleccionada' : ''}` },
        el(
          'div',
          { clase: 'totem-tarjeta-foto' },
          el('img', {
            src: variante.imagen || IMAGEN_RESPALDO,
            alt: variante.productoNombre,
            loading: 'lazy'
          }),
          cantidad > 0
            ? el('span', { clase: 'totem-tarjeta-badge', texto: String(cantidad) })
            : null
        ),
        el(
          'div',
          { clase: 'totem-tarjeta-cuerpo' },
          el('p', { clase: 'totem-tarjeta-categoria', texto: variante.categoriaNombre }),
          el('h2', { clase: 'totem-tarjeta-nombre', texto: variante.productoNombre }),
          el('p', {
            clase: 'totem-tarjeta-variante',
            texto: `${variante.varianteNombre} · ${variante.sku}`
          }),
          el(
            'div',
            { clase: 'totem-tarjeta-pie' },
            el(
              'div',
              { clase: 'totem-tarjeta-precio' },
              el('strong', { texto: formatearBs(variante.precio) }),
              el('span', {
                clase: 'totem-tarjeta-stock',
                texto: `Stock: ${variante.stock}`
              })
            ),
            el(
              'div',
              { clase: 'totem-stepper-grupo' },
              menos,
              el('output', { clase: 'totem-stepper-valor', texto: String(cantidad) }),
              mas
            )
          )
        )
      );
    }

    function renderGrilla() {
      if (!estado.catalogoCargado) {
        grilla.replaceChildren(
          el('p', { clase: 'totem-cargando', texto: 'Cargando catálogo...' })
        );
        return;
      }

      const variantes = variantesFiltradas();
      if (variantes.length === 0) {
        grilla.replaceChildren(
          el('p', {
            clase: 'totem-vacio',
            texto: 'No hay productos disponibles en esta categoría.'
          })
        );
        return;
      }

      grilla.replaceChildren(...variantes.map(crearTarjetaProducto));
    }

    function cambiarCantidad(variante, delta) {
      const item = estado.carrito.get(variante.varianteId);
      const nuevaCantidad = (item ? item.cantidad : 0) + delta;

      if (nuevaCantidad <= 0) {
        estado.carrito.delete(variante.varianteId);
      } else if (nuevaCantidad > variante.stock) {
        mostrarAviso(`Solo hay ${variante.stock} unidades disponibles.`, 'error');
        return;
      } else {
        estado.carrito.set(variante.varianteId, {
          variante,
          cantidad: nuevaCantidad
        });
      }

      mensajePaso1.textContent = '';
      registrarActividad();
      renderGrilla();
      actualizarBarra();
    }

    function actualizarBarra() {
      const articulos = contarArticulos(estado.carrito);
      textoTotal.textContent = formatearBs(calcularTotal(estado.carrito));
      textoConteo.textContent = `${articulos} artículo${articulos === 1 ? '' : 's'}`;
      botonContinuar.disabled = estado.carrito.size === 0;
    }

    botonContinuar.addEventListener('click', () => {
      if (estado.carrito.size === 0) {
        mensajePaso1.textContent = 'Agrega al menos un producto para continuar.';
        return;
      }
      mensajePaso1.textContent = '';
      estado.paso = 2;
      mostrarPaso();
    });

    // ------------------------------------------------------------------
    // Paso 2: datos del cliente y metodo de pago.
    // ------------------------------------------------------------------
    function crearBotonMetodo(metodo, iconoNombre, titulo, descripcion) {
      const activo = estado.metodoPago === metodo;
      const boton = el(
        'button',
        {
          clase: `totem-metodo${activo ? ' activo' : ''}`,
          atributos: {
            type: 'button',
            'aria-pressed': activo ? 'true' : 'false'
          }
        },
        el('span', { clase: 'totem-metodo-icono' }, icono(iconoNombre, 40)),
        el(
          'span',
          { clase: 'totem-metodo-texto' },
          el('strong', { texto: titulo }),
          el('span', { texto: descripcion })
        )
      );

      boton.addEventListener('click', () => {
        estado.metodoPago = metodo;
        registrarActividad();
        renderPaso2();
      });

      return boton;
    }

    function renderPaso2() {
      const panel = paneles[2];
      const total = calcularTotal(estado.carrito);

      if (estado.carrito.size === 0) {
        estado.paso = 1;
        mostrarPaso();
        return;
      }

      const nombre = el('input', {
        clase: 'totem-entrada',
        type: 'text',
        maxlength: 150,
        value: estado.clienteNombre,
        placeholder: 'Consumidor Final',
        atributos: { autocomplete: 'off', inputmode: 'text' }
      });
      nombre.addEventListener('input', () => {
        estado.clienteNombre = nombre.value;
      });

      const nit = el('input', {
        clase: 'totem-entrada',
        type: 'text',
        maxlength: 50,
        value: estado.clienteNitCi,
        placeholder: 'Opcional',
        atributos: { autocomplete: 'off', inputmode: 'text' }
      });
      nit.addEventListener('input', () => {
        estado.clienteNitCi = nit.value;
      });

      const lineas = Array.from(estado.carrito.values()).map((item) =>
        el(
          'div',
          { clase: 'totem-resumen-linea' },
          el('span', {
            texto: `${item.cantidad}x ${item.variante.productoNombre}`
          }),
          el('strong', {
            texto: formatearBs(item.variante.precio * item.cantidad)
          })
        )
      );

      const volver = el(
        'button',
        {
          clase: 'totem-btn totem-btn-claro',
          atributos: { type: 'button' },
          on: {
            click: () => {
              estado.paso = 1;
              mostrarPaso();
            }
          }
        },
        icono('flechaIzquierda', 22),
        el('span', { texto: 'Volver a productos' })
      );

      const pagar = el(
        'button',
        { clase: 'totem-btn totem-btn-primario', atributos: { type: 'button' } },
        el('span', { texto: 'Continuar al pago' }),
        icono('flecha', 24)
      );
      pagar.addEventListener('click', () => {
        estado.paso = 3;
        estado.pin = '';
        estado.tarjetaInsertada = false;
        estado.tarjetaUltimos4 = '';
        estado.venta = null;
        estado.error = '';
        mostrarPaso();
      });

      panel.replaceChildren(
        el(
          'div',
          { clase: 'totem-panel-cabecera' },
          el('div', {},
            el('p', { clase: 'totem-eyebrow', texto: 'Paso 2' }),
            el('h1', { clase: 'totem-titulo', texto: 'Datos y forma de pago' }),
            el('p', {
              clase: 'totem-subtitulo',
              texto: 'Podemos emitir tu ticket a nombre de Consumidor Final.'
            })
          )
        ),
        el(
          'div',
          { clase: 'totem-dos-columnas' },
          el(
            'div',
            { clase: 'totem-columna' },
            el('h2', { clase: 'totem-seccion', texto: 'Datos del cliente' }),
            el(
              'label',
              { clase: 'totem-campo' },
              el('span', { clase: 'totem-campo-etiqueta', texto: 'Nombre completo' }),
              nombre
            ),
            el(
              'label',
              { clase: 'totem-campo' },
              el('span', { clase: 'totem-campo-etiqueta', texto: 'NIT / CI (opcional)' }),
              nit
            ),
            el('h2', { clase: 'totem-seccion', texto: 'Método de pago' }),
            el(
              'div',
              { clase: 'totem-metodos' },
              crearBotonMetodo(
                METODO_TARJETA,
                'tarjeta',
                'Tarjeta Débito ATM (POS)',
                'Pinpad integrado con autorización bancaria'
              ),
              crearBotonMetodo(
                METODO_QR,
                'qr',
                'QR Bancario',
                'Escanea el código desde tu aplicación bancaria'
              )
            )
          ),
          el(
            'aside',
            { clase: 'totem-resumen-pedido' },
            el('h2', { clase: 'totem-seccion', texto: 'Resumen del pedido' }),
            el('div', { clase: 'totem-resumen-lineas' }, ...lineas),
            el(
              'div',
              { clase: 'totem-resumen-total-linea' },
              el('span', { texto: 'Total a pagar' }),
              el('strong', { texto: formatearBs(total) })
            )
          )
        ),
        el('div', { clase: 'totem-acciones-paso' }, volver, pagar)
      );
    }

    // ------------------------------------------------------------------
    // Paso 3: pinpad POS, QR y ticket termico.
    // ------------------------------------------------------------------
    function crearPuntosPin() {
      const puntos = [];
      for (let indice = 0; indice < 4; indice += 1) {
        const lleno = indice < estado.pin.length;
        puntos.push(
          el('span', {
            clase: `totem-pin-punto${lleno ? ' lleno' : ''}`,
            texto: lleno ? '•' : ''
          })
        );
      }
      return el('div', { clase: 'totem-pin-puntos', atributos: { 'aria-hidden': 'true' } }, ...puntos);
    }

    function agregarDigito(digito) {
      if (estado.procesando || estado.pin.length >= 4) return;
      estado.error = '';
      estado.pin += digito;
      registrarActividad();
      renderPaso3();
    }

    function borrarDigito() {
      if (estado.procesando) return;
      estado.pin = estado.pin.slice(0, -1);
      estado.error = '';
      renderPaso3();
    }

    function insertarTarjeta() {
      estado.tarjetaUltimos4 = String(Math.floor(1000 + Math.random() * 9000));
      estado.tarjetaInsertada = true;
      estado.pin = '';
      estado.error = '';
      registrarActividad();
      renderPaso3();
    }

    function crearTeclado() {
      const teclas = [];
      const filas = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9']
      ];

      for (const fila of filas) {
        for (const digito of fila) {
          teclas.push(
            el(
              'button',
              {
                clase: 'totem-tecla',
                atributos: { type: 'button', 'aria-label': `Dígito ${digito}` },
                disabled: estado.procesando,
                on: { click: () => agregarDigito(digito) }
              },
              el('span', { texto: digito })
            )
          );
        }
      }

      teclas.push(
        el(
          'button',
          {
            clase: 'totem-tecla totem-tecla-limpiar',
            atributos: { type: 'button', 'aria-label': 'Limpiar PIN' },
            disabled: estado.procesando || estado.pin.length === 0,
            on: {
              click: () => {
                if (estado.procesando) return;
                estado.pin = '';
                estado.error = '';
                renderPaso3();
              }
            }
          },
          el('span', { texto: 'C' })
        )
      );
      teclas.push(
        el(
          'button',
          {
            clase: 'totem-tecla',
            atributos: { type: 'button', 'aria-label': 'Dígito 0' },
            disabled: estado.procesando,
            on: { click: () => agregarDigito('0') }
          },
          el('span', { texto: '0' })
        )
      );
      teclas.push(
        el(
          'button',
          {
            clase: 'totem-tecla totem-tecla-borrar',
            atributos: { type: 'button', 'aria-label': 'Borrar último dígito' },
            disabled: estado.procesando || estado.pin.length === 0,
            on: { click: borrarDigito }
          },
          icono('cerrar', 26)
        )
      );

      return el('div', { clase: 'totem-teclado' }, ...teclas);
    }

    function crearTerminalTarjeta() {
      const total = calcularTotal(estado.carrito);
      const pantalla = el('div', { clase: 'totem-terminal-pantalla' });

      if (!estado.tarjetaInsertada) {
        pantalla.append(
          el('p', { clase: 'totem-terminal-titulo', texto: 'Terminal POS' }),
          el('p', {
            clase: 'totem-terminal-instruccion',
            texto: 'Inserte, deslice o acerque su tarjeta de débito'
          }),
          icono('tarjeta', 96)
        );
      } else {
        pantalla.append(
          el('p', {
            clase: 'totem-terminal-tarjeta',
            texto: `TARJETA **** ${estado.tarjetaUltimos4}`
          }),
          el('p', {
            clase: 'totem-terminal-instruccion',
            texto: estado.procesando
              ? 'Procesando pago seguro...'
              : 'Ingrese su PIN de 4 dígitos'
          }),
          crearPuntosPin()
        );
      }

      if (estado.error) {
        pantalla.appendChild(
          el('p', { clase: 'totem-terminal-error', texto: estado.error })
        );
      }

      const terminal = el(
        'div',
        { clase: 'totem-terminal' },
        el(
          'div',
          { clase: 'totem-terminal-borde' },
          el('span', { texto: 'NUBA POS' }),
          el('span', { texto: 'ATM DEBIT' })
        ),
        pantalla
      );

      if (!estado.tarjetaInsertada) {
        const insertar = el(
          'button',
          {
            clase: 'totem-btn totem-btn-primario',
            atributos: { type: 'button' },
            on: { click: insertarTarjeta }
          },
          icono('tarjeta', 24),
          el('span', { texto: 'Insertar tarjeta (simulación)' })
        );
        terminal.appendChild(insertar);
        return terminal;
      }

      terminal.appendChild(crearTeclado());

      const pagar = el(
        'button',
        {
          clase: 'totem-btn totem-btn-exito',
          atributos: { type: 'button' },
          disabled: estado.pin.length !== 4 || estado.procesando
        },
        el('span', {
          texto: estado.procesando
            ? 'Procesando pago...'
            : `Pagar ${formatearBs(total)}`
        }),
        icono('pago', 24)
      );
      pagar.addEventListener('click', procesarVenta);
      terminal.appendChild(pagar);

      return terminal;
    }

    function crearPanelQr() {
      const total = calcularTotal(estado.carrito);
      const boton = el(
        'button',
        {
          clase: 'totem-btn totem-btn-primario',
          atributos: { type: 'button' },
          disabled: estado.procesando
        },
        el('span', {
          texto: estado.procesando
            ? 'Esperando confirmación del banco...'
            : `Confirmar pago QR de ${formatearBs(total)}`
        }),
        icono('qr', 24)
      );
      boton.addEventListener('click', procesarVenta);

      return el(
        'div',
        { clase: 'totem-qr' },
        el(
          'div',
          { clase: 'totem-qr-caja' },
          icono('qr', 220),
          el('p', { texto: `Monto a pagar: ${formatearBs(total)}` }),
          el('p', {
            clase: 'totem-qr-ayuda',
            texto: 'Escanea el QR bancario desde tu aplicación y confirma el pago.'
          })
        ),
        estado.error ? el('p', { clase: 'totem-error', texto: estado.error }) : null,
        boton
      );
    }

    function crearLineaTicket(etiqueta, valor) {
      return el(
        'div',
        { clase: 'ticket-linea' },
        el('span', { texto: etiqueta }),
        el('strong', { texto: valor })
      );
    }

    function crearTicket(venta) {
      const filas = venta.items.map((item) =>
        el(
          'tr',
          {},
          el(
            'td',
            {},
            el('span', { texto: `${item.cantidad}x ${item.productoNombre}` }),
            el('small', { texto: item.varianteNombre })
          ),
          el('td', { clase: 'ticket-numero', texto: formatearBs(item.subtotal) })
        )
      );

      const qr = venta.qrRastreo
        ? el('img', {
            clase: 'ticket-qr',
            src: venta.qrRastreo,
            alt: 'Código QR de rastreo'
          })
        : null;

      const datosPago = [];
      if (venta.tarjetaUltimos4) {
        datosPago.push(
          crearLineaTicket('Tarjeta ATM', `**** ${venta.tarjetaUltimos4}`)
        );
      }
      datosPago.push(crearLineaTicket('Autorización', venta.codigoAutorizacion));
      datosPago.push(crearLineaTicket('Factura', venta.numeroFactura));
      datosPago.push(crearLineaTicket('Pago', venta.metodoPago));

      return el(
        'article',
        {
          clase: 'totem-ticket',
          atributos: { id: 'totem-ticket', 'aria-label': 'Ticket de compra' }
        },
        el(
          'header',
          { clase: 'ticket-cabecera' },
          el('img', {
            clase: 'ticket-logo',
            src: '/assets/brand/logo-nubaglow.png',
            alt: 'NubaGlow'
          }),
          el('h2', { texto: 'NubaGlow' }),
          el('p', { texto: 'Sucre, Bolivia' }),
          el('p', { clase: 'ticket-sub', texto: 'Comprobante de compra · Autoservicio' })
        ),
        el('div', { clase: 'ticket-separador' }),
        crearLineaTicket('Ticket', venta.numeroTicket),
        crearLineaTicket('Fecha y hora', formatearFecha(venta.creadoEn)),
        crearLineaTicket('Cliente', venta.clienteNombre),
        venta.clienteNitCi
          ? crearLineaTicket('NIT / CI', venta.clienteNitCi)
          : null,
        el('div', { clase: 'ticket-separador' }),
        el(
          'table',
          { clase: 'ticket-items' },
          el(
            'thead',
            {},
            el('tr', {},
              el('th', { texto: 'Detalle' }),
              el('th', { clase: 'ticket-numero', texto: 'Subtotal' })
            )
          ),
          el('tbody', {}, ...filas)
        ),
        el('div', { clase: 'ticket-separador' }),
        el(
          'div',
          { clase: 'ticket-total' },
          el('span', { texto: 'TOTAL' }),
          el('strong', { texto: formatearBs(venta.total) })
        ),
        el('div', { clase: 'ticket-pago' }, ...datosPago),
        el('div', { clase: 'ticket-separador' }),
        el(
          'div',
          { clase: 'ticket-rastreo' },
          qr,
          el('p', { texto: `Rastreo: ${venta.codigoRastreo}` }),
          el('p', {
            clase: 'ticket-nota',
            texto: 'Comprobante académico de simulación — Sin valor fiscal'
          })
        )
      );
    }

    function crearAccionesTicket() {
      const imprimir = el(
        'button',
        {
          clase: 'totem-btn totem-btn-primario',
          atributos: { type: 'button' },
          on: { click: () => window.print() }
        },
        icono('descargar', 24),
        el('span', { texto: 'Imprimir ticket' })
      );

      const nuevo = el(
        'button',
        {
          clase: 'totem-btn totem-btn-claro',
          atributos: { type: 'button' },
          on: {
            click: () =>
              reiniciarPedido('Ticket emitido. Puede iniciar un nuevo pedido.')
          }
        },
        icono('reiniciar', 24),
        el('span', { texto: 'Nuevo pedido' })
      );

      return el(
        'div',
        { clase: 'totem-ticket-acciones totem-no-print' },
        imprimir,
        nuevo
      );
    }

    function renderPaso3() {
      const panel = paneles[3];

      if (estado.venta) {
        panel.replaceChildren(
          el(
            'div',
            { clase: 'totem-panel-cabecera totem-no-print' },
            el('div', {},
              el('p', { clase: 'totem-eyebrow', texto: 'Pago aprobado' }),
              el('h1', { clase: 'totem-titulo', texto: 'Retira tu ticket' }),
              el('p', {
                clase: 'totem-subtitulo',
                texto: 'Conserva tu comprobante para el retiro de productos.'
              })
            )
          ),
          crearTicket(estado.venta),
          crearAccionesTicket()
        );
        return;
      }

      const titulo =
        estado.metodoPago === METODO_TARJETA
          ? 'Paga con tu tarjeta de débito'
          : 'Paga con QR bancario';

      const volver = el(
        'button',
        {
          clase: 'totem-btn totem-btn-claro',
          atributos: { type: 'button' },
          disabled: estado.procesando,
          on: {
            click: () => {
              estado.paso = 2;
              estado.error = '';
              mostrarPaso();
            }
          }
        },
        icono('flechaIzquierda', 22),
        el('span', { texto: 'Volver' })
      );

      const contenido =
        estado.metodoPago === METODO_TARJETA
          ? crearTerminalTarjeta()
          : crearPanelQr();

      panel.replaceChildren(
        el(
          'div',
          { clase: 'totem-panel-cabecera' },
          el('div', {},
            el('p', { clase: 'totem-eyebrow', texto: 'Paso 3' }),
            el('h1', { clase: 'totem-titulo', texto: titulo }),
            el('p', {
              clase: 'totem-subtitulo',
              texto: `Total a pagar: ${formatearBs(calcularTotal(estado.carrito))}`
            })
          )
        ),
        contenido,
        el('div', { clase: 'totem-acciones-paso' }, volver)
      );
    }

    // ------------------------------------------------------------------
    // Procesamiento del cobro contra el backend.
    // ------------------------------------------------------------------
    async function procesarVenta() {
      if (estado.procesando) return;

      if (estado.carrito.size === 0) {
        estado.paso = 1;
        mostrarPaso();
        return;
      }

      if (estado.metodoPago === METODO_TARJETA && estado.pin.length !== 4) {
        estado.error = 'Ingrese los 4 dígitos de su PIN para continuar.';
        renderPaso3();
        return;
      }

      estado.procesando = true;
      estado.error = '';
      renderPaso3();

      try {
        const cuerpo = {
          items: Array.from(estado.carrito.values()).map((item) => ({
            variante_id: item.variante.varianteId,
            cantidad: item.cantidad
          })),
          metodo_pago: estado.metodoPago,
          cliente_nombre: estado.clienteNombre.trim() || 'Consumidor Final',
          cliente_nit_ci: estado.clienteNitCi.trim() || undefined
        };

        if (estado.metodoPago === METODO_TARJETA) {
          cuerpo.pin = estado.pin;
          cuerpo.tarjeta_ultimos4 = estado.tarjetaUltimos4;
        }

        const respuesta = await api.crear('/totem/venta', cuerpo);
        const ticket = respuesta && respuesta.datos ? respuesta.datos.ticket : null;

        if (!ticket) {
          throw new Error('El servidor no devolvió el ticket de compra.');
        }

        estado.venta = ticket;
        estado.procesando = false;
        estado.pin = '';
        mostrarPaso();
        mostrarAviso(
          `Pago aprobado. Autorización ${ticket.codigoAutorizacion}.`,
          'exito'
        );

        window.setTimeout(() => {
          try {
            window.print();
          } catch {
            /* Si el navegador bloquea la impresion queda el boton manual. */
          }
        }, 700);
      } catch (error) {
        estado.procesando = false;
        estado.pin = '';
        estado.error = error.message || 'No se pudo procesar el pago.';
        mostrarPaso();
        mostrarAviso(estado.error, 'error');
      }
    }

    // ------------------------------------------------------------------
    // Reinicio total del totem para el siguiente cliente.
    // ------------------------------------------------------------------
    function reiniciarPedido(mensaje) {
      estado.paso = 1;
      estado.carrito.clear();
      estado.clienteNombre = '';
      estado.clienteNitCi = '';
      estado.metodoPago = METODO_TARJETA;
      estado.pin = '';
      estado.tarjetaUltimos4 = '';
      estado.tarjetaInsertada = false;
      estado.procesando = false;
      estado.venta = null;
      estado.error = '';
      estado.filtroCategoria = '';
      restante = SEGUNDOS_INACTIVIDAD;
      actualizarTimer();
      mostrarPaso();
      if (mensaje) mostrarAviso(mensaje);
    }

    // ------------------------------------------------------------------
    // Montaje y carga del catalogo.
    // ------------------------------------------------------------------
    raiz.append(
      cabecera,
      barraPasos,
      paneles[1],
      paneles[2],
      paneles[3],
      avisos
    );

    actualizarTimer();
    mostrarPaso();
    iniciarTimer();

    try {
      const respuesta = await api.obtener('/totem/catalogo');
      const datos = respuesta && respuesta.datos ? respuesta.datos : {};
      estado.categorias = datos.categorias || [];
      estado.variantes = datos.variantes || [];
      estado.catalogoCargado = true;
      renderChips();
      renderGrilla();
      actualizarBarra();
    } catch (error) {
      estado.catalogoCargado = true;
      estado.variantes = [];
      grilla.replaceChildren(
        el('p', {
          clase: 'totem-error',
          texto:
            error.message ||
            'No se pudo cargar el catálogo. Reinicia el pedido e intenta otra vez.'
        })
      );
    }

    return raiz;
  }
};
