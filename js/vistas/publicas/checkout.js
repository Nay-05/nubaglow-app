/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: CHECKOUT (/checkout)
 * ============================================================================
 * Carro de compra -> formulario de datos y metodo de pago -> crear pedido.
 * Unico paso: valida datos, crea pedido en transaccion y redirige a /
 * rastreo. Cumple con CLAUDE.md Secciones 3, 4, 6 y 9.
 * - No se usa innerHTML (prevencion XSS).
 * - Validacion en navegador y en servidor.
 * - Cambio de URL obligatorio con pushState.
 * - Mobile-first, sin emojis, con tildes, compatible CSP.
 */

import { el, icono, texto, vaciar } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs } from '../../core/formato.js';
import { alerta, boton, imagenProducto } from '../comunes.js';

const MENSAJE_CARRITO_VACIO =
  'El carrito está vacío. Explora el catálogo para agregar productos.';
const CIUDAD_COTIZACION_INICIAL = 'Sucre';
const RUTA_INICIO = '/';
const RUTA_LOGIN = '/login?redirigir=/checkout';
const RUTA_CARRITO = '/carrito';

function normalizarItemsParaCotizar(items) {
  return items.map((item) => ({
    variante_id: item.varianteId,
    cantidad: item.cantidad
  }));
}

function describirLineasNoDisponibles(items) {
  return items
    .filter((item) => item.noDisponible)
    .map((item) => `${item.productoNombre} - ${item.varianteNombre}`);
}

function detallesDeValidacion(error) {
  const detalles = error?.datos?.detalles;
  if (!Array.isArray(detalles)) return [];
  return detalles.map((detalle) => `${detalle.campo}: ${detalle.mensaje}`);
}

function crearMetodoPago({ id, valor, titulo, descripcion, iconoNombre }) {
  const entrada = el('input', {
    clase: 'metodo-pago-radio',
    type: 'radio',
    name: 'metodo_pago',
    value: valor,
    id,
    required: true,
    'aria-label': titulo
  });

  return el(
    'label',
    { clase: 'metodo-pago', 'for': id },
    entrada,
    el(
      'span',
      { clase: 'metodo-pago-icono', atributos: { 'aria-hidden': 'true' } },
      icono(iconoNombre, 20)
    ),
    el(
      'span',
      { clase: 'metodo-pago-texto' },
      el('strong', { texto: titulo }),
      el('span', { texto: descripcion })
    ),
    el('span', {
      clase: 'metodo-pago-marca',
      atributos: { 'aria-hidden': 'true' }
    })
  );
}

function crearResumenCheckout(carrito, cotizacion) {
  const items = Array.isArray(carrito?.items) ? carrito.items : [];
  const listaItems = items.length
    ? el(
        'ul',
        { clase: 'checkout-resumen-items' },
        ...items.map((item) =>
          el(
            'li',
            { clase: 'checkout-resumen-item' },
            imagenProducto(item.imagen, item.productoNombre),
            el(
              'div',
              { clase: 'checkout-resumen-item-info' },
              el('strong', { texto: item.productoNombre }),
              el('span', {
                clase: 'texto-suave',
                texto: item.varianteNombre || 'Variante única'
              }),
              el('span', {
                clase: 'texto-suave',
                texto: `${item.cantidad} unidad(es)`
              })
            ),
            el('span', {
              clase: 'checkout-resumen-item-subtotal',
              texto: formatearBs(item.subtotal)
            })
          )
        )
      )
    : el('p', {
        clase: 'texto-suave',
        texto: 'Tu carrito no tiene artículos registrados.'
      });

  return el(
    'aside',
    { clase: 'checkout-resumen' },
    el('h2', { clase: 'checkout-resumen-titulo', texto: 'Resumen del pedido' }),
    listaItems,
    el(
      'div',
      { clase: 'checkout-totales' },
      el(
        'div',
        { clase: 'checkout-total-linea' },
        el('span', { texto: 'Subtotal' }),
        el('span', { texto: formatearBs(cotizacion.subtotal) })
      ),
      el(
        'div',
        { clase: 'checkout-total-linea' },
        el('span', { texto: 'Envío' }),
        el('span', { texto: formatearBs(cotizacion.costoEnvio) })
      ),
      el(
        'div',
        { clase: 'checkout-total-final' },
        el('span', { texto: 'Total' }),
        el('span', { texto: formatearBs(cotizacion.total) })
      )
    )
  );
}

function crearPantallaError({ titulo, mensaje, detalles = [], router }) {
  const volver = boton('Volver al carrito', {
    tipo: 'button',
    variante: 'primary'
  });
  volver.addEventListener('click', () => router.navegar(RUTA_CARRITO));

  return el(
    'section',
    { clase: 'pagina' },
    el('h1', { clase: 'titulo-pagina', texto: titulo }),
    alerta(mensaje, 'error'),
    ...detalles.map((detalle) =>
      el('p', { clase: 'texto-error', texto: detalle })
    ),
    el(
      'div',
      { clase: 'carrito-acciones' },
      volver
    )
  );
}

export const vistaCheckout = {
  async render(contexto = {}) {
    const { usuario, router } = contexto;

    // 1. Si no hay sesion de cliente, ir al login
    if (!usuario || usuario.rol !== 'cliente') {
      router.navegar(RUTA_LOGIN, { reemplazar: true });
      return null;
    }

    // 2. Verificar que el carrito no este vacio y obtener sus items
    let carrito = null;
    try {
      const carritoRes = await api.obtener('/carrito', { sinRenovacion: true });
      carrito = carritoRes?.datos?.carrito;
    } catch (error) {
      return crearPantallaError({
        titulo: 'No se pudo preparar la compra',
        mensaje:
          error.message || 'No se pudo cargar tu carrito. Intenta nuevamente.',
        router
      });
    }

    if (!carrito || !carrito.items || carrito.items.length === 0) {
      return crearPantallaError({
        titulo: 'Tu carrito está vacío',
        mensaje: MENSAJE_CARRITO_VACIO,
        router
      });
    }

    // 3. Obtener resumen de pedido desde el servidor usando items del carrito
    let cotizacion = null;
    try {
      const itemsParaCotizar = normalizarItemsParaCotizar(carrito.items);
      const respuesta = await api.crear(
        '/pedidos/cotizar',
        {
          ciudad: CIUDAD_COTIZACION_INICIAL,
          items: itemsParaCotizar
        },
        { sinRenovacion: true }
      );
      cotizacion = respuesta?.datos?.cotizacion;
    } catch (error) {
      return crearPantallaError({
        titulo: 'No se pudo cotizar tu pedido',
        mensaje:
          error.message || 'No se pudo cotizar el pedido. Intenta nuevamente.',
        detalles: [
          ...describirLineasNoDisponibles(carrito.items),
          ...detallesDeValidacion(error)
        ],
        router
      });
    }

    // 4. Construir la seccion del checkout
    const seccion = el(
      'section',
      { clase: 'pagina' },
      el('h1', { clase: 'titulo-pagina', texto: 'Finalizar compra' }),
      el('p', {
        clase: 'subtitulo',
        texto: 'Revisa tus datos y elige el método de pago.'
      })
    );

    // Area de mensajes de error/success
    const mensajes = el('div', { clase: 'mensajes' });

    // Formulario de datos del cliente
    const formulario = el('form', {
      clase: 'checkout-formulario checkout-grid'
    });

    // Campo: nombre completo
    const errorNombre = el('small', {
      clase: 'campo-error',
      atributos: { id: 'error-nombre', 'aria-live': 'polite' }
    });
    const entradaNombre = el('input', {
      clase: 'entrada',
      name: 'nombre',
      type: 'text',
      placeholder: 'Juan Pérez',
      required: true,
      'aria-label': 'Nombre completo',
      atributos: {
        'aria-describedby': 'error-nombre',
        autocomplete: 'name'
      }
    });
    const campoNombre = el(
      'div',
      { clase: 'campo' },
      el('label', { clase: 'campo-etiqueta', texto: 'Nombre completo' }),
      entradaNombre,
      errorNombre
    );

    // Campo: celular (8 dígitos bolivianos, iniciar con 6 o 7)
    const errorCelular = el('small', {
      clase: 'campo-error',
      atributos: { id: 'error-celular', 'aria-live': 'polite' }
    });
    const entradaCelular = el('input', {
      clase: 'entrada',
      name: 'celular',
      type: 'tel',
      placeholder: '61234567',
      required: true,
      'aria-label': 'Celular',
      atributos: {
        'aria-describedby': 'error-celular',
        pattern: '^[67][0-9]{7}$',
        inputmode: 'numeric',
        autocomplete: 'tel'
      }
    });
    const campoCelular = el(
      'div',
      { clase: 'campo' },
      el('label', { clase: 'campo-etiqueta', texto: 'Celular' }),
      entradaCelular,
      errorCelular
    );

    // Campo: correo electrónico
    const errorCorreo = el('small', {
      clase: 'campo-error',
      atributos: { id: 'error-correo', 'aria-live': 'polite' }
    });
    const entradaCorreo = el('input', {
      clase: 'entrada',
      name: 'correo',
      type: 'email',
      placeholder: 'juan@ejemplo.com',
      required: true,
      'aria-label': 'Correo electrónico',
      atributos: {
        'aria-describedby': 'error-correo',
        autocomplete: 'email'
      }
    });
    const campoCorreo = el(
      'div',
      { clase: 'campo' },
      el('label', { clase: 'campo-etiqueta', texto: 'Correo electrónico' }),
      entradaCorreo,
      errorCorreo
    );

    // Campo: ciudad
    const errorCiudad = el('small', {
      clase: 'campo-error',
      atributos: { id: 'error-ciudad', 'aria-live': 'polite' }
    });
    const entradaCiudad = el('input', {
      clase: 'entrada',
      name: 'ciudad',
      type: 'text',
      placeholder: 'Sucre',
      required: true,
      'aria-label': 'Ciudad',
      atributos: {
        'aria-describedby': 'error-ciudad',
        autocomplete: 'address-level2'
      }
    });
    const campoCiudad = el(
      'div',
      { clase: 'campo' },
      el('label', { clase: 'campo-etiqueta', texto: 'Ciudad' }),
      entradaCiudad,
      errorCiudad
    );

    // Campo: dirección exacta
    const errorDireccion = el('small', {
      clase: 'campo-error',
      atributos: { id: 'error-direccion', 'aria-live': 'polite' }
    });
    const entradaDireccion = el('input', {
      clase: 'entrada',
      name: 'direccion',
      type: 'text',
      placeholder: 'Calle 12 de Octubre No. 123',
      required: true,
      'aria-label': 'Dirección exacta',
      atributos: {
        'aria-describedby': 'error-direccion',
        autocomplete: 'street-address'
      }
    });
    const campoDireccion = el(
      'div',
      { clase: 'campo' },
      el('label', { clase: 'campo-etiqueta', texto: 'Dirección exacta' }),
      entradaDireccion,
      errorDireccion
    );

    // Obtener modo de PayPal desde el endpoint publico (sin exponer claves)
    let paypalMensaje = 'PayPal';

    try {
      const configRes = await api.obtener('/config');
      if (configRes?.datos?.mensajePaypal) {
        paypalMensaje = configRes.datos.mensajePaypal;
      }
    } catch {
      paypalMensaje = 'PayPal';
    }

    const seccionDatos = el(
      'section',
      { clase: 'checkout-seccion' },
      el('h2', {
        clase: 'checkout-seccion-titulo',
        texto: 'Datos del cliente'
      }),
      el(
        'div',
        { clase: 'checkout-campos' },
        campoNombre,
        el('div', { clase: 'checkout-fila' }, campoCelular, campoCorreo),
        campoCiudad,
        campoDireccion
      )
    );

    const seccionPago = el(
      'section',
      { clase: 'checkout-seccion' },
      el('h2', {
        clase: 'checkout-seccion-titulo',
        texto: 'Método de pago'
      }),
      el(
        'div',
        { clase: 'checkout-metodos' },
        crearMetodoPago({
          id: 'metodo-qr',
          valor: 'qr_simple',
          titulo: 'QR Simple',
          descripcion: 'Escanea el QR y adjunta tu comprobante.',
          iconoNombre: 'qr'
        }),
        crearMetodoPago({
          id: 'metodo-deposito',
          valor: 'deposito_bancario',
          titulo: 'Depósito bancario',
          descripcion:
            'Transfiere a la cuenta de NubaGlow y adjunta el comprobante.',
          iconoNombre: 'banco'
        }),
        crearMetodoPago({
          id: 'metodo-paypal',
          valor: 'paypal',
          titulo: paypalMensaje,
          descripcion: 'Paga con tu cuenta PayPal en el entorno de pruebas.',
          iconoNombre: 'tarjeta'
        }),
        crearMetodoPago({
          id: 'metodo-contra-entrega',
          valor: 'contra_entrega',
          titulo: 'Pago contra entrega',
          descripcion: 'Paga en efectivo al recibir tu pedido en Sucre.',
          iconoNombre: 'efectivo'
        })
      )
    );

    const resumenPedido = crearResumenCheckout(carrito, cotizacion);
    const botonConfirmar = el(
      'button',
      {
        clase: 'btn btn-primary checkout-boton-confirmar',
        type: 'submit',
        disabled: true,
        'aria-label': 'Confirmar pedido'
      },
      el('span', { texto: 'Confirmar pedido' })
    );

    resumenPedido.append(mensajes, botonConfirmar);

    const columnaPrincipal = el(
      'div',
      { clase: 'checkout-columna-principal' },
      seccionDatos,
      seccionPago
    );

    formulario.append(columnaPrincipal, resumenPedido);
    seccion.append(formulario);

    // Manejo de validacion de formulario en el navegador
    const formularioElemento = formulario;

    function valorCampo(nombre) {
      const campo = formularioElemento.elements.namedItem(nombre);
      return String(campo?.value || '').trim();
    }

    const validadores = {
      nombre: (valor) =>
        valor.length >= 3
          ? ''
          : 'El nombre debe tener al menos 3 caracteres',
      celular: (valor) =>
        /^[67][0-9]{7}$/.test(valor)
          ? ''
          : 'El celular debe tener 8 dígitos y comenzar con 6 o 7',
      correo: (valor) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
          ? ''
          : 'El correo no tiene un formato válido',
      ciudad: (valor) =>
        valor.length >= 2
          ? ''
          : 'La ciudad debe tener al menos 2 caracteres',
      direccion: (valor) =>
        valor.length >= 5
          ? ''
          : 'La dirección debe tener al menos 5 caracteres'
    };

    const erroresPorCampo = {
      nombre: errorNombre,
      celular: errorCelular,
      correo: errorCorreo,
      ciudad: errorCiudad,
      direccion: errorDireccion
    };

    formularioElemento.addEventListener('input', (evento) => {
      const target = evento.target;
      const validador = validadores[target.name];
      if (!validador) return;

      const valor = target.value.trim();
      target.value = valor;
      const mensaje = validador(valor);
      target.setCustomValidity(mensaje);

      const error = erroresPorCampo[target.name];
      if (error) error.textContent = mensaje;
    });

    // Habilitar/deshabilitar boton al rellenar campos y seleccionar metodo de pago
    let camposLlenos = false;

    function actualizarEstadoBoton() {
      const nombre = valorCampo('nombre');
      const celular = valorCampo('celular');
      const correo = valorCampo('correo');
      const ciudad = valorCampo('ciudad');
      const direccion = valorCampo('direccion');

      const hayErrores = formularioElemento.checkValidity() === false;
      const nombreOk = nombre.length >= 3;
      const celularOk = /^[67][0-9]{7}$/.test(celular);
      const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
      const ciudadOk = ciudad.length >= 2;
      const direccionOk = direccion.length >= 5;
      const datosOk =
        nombreOk && celularOk && correoOk && ciudadOk && direccionOk;

      const metodoSeleccionado = Boolean(
        formularioElemento.querySelector(
          'input[name="metodo_pago"]:checked'
        )
      );

      camposLlenos = datosOk && metodoSeleccionado;
      botonConfirmar.disabled = hayErrores || !camposLlenos;
    }

    // Validar que todos los campos obligatorios esten llenos cuando algun radio este selecionado
    formularioElemento.addEventListener('change', (evento) => {
      if (evento.target.name === 'metodo_pago') {
        actualizarEstadoBoton();
      }
    });

    // Escuchar cambios en los campos para habilitar el boton
    formularioElemento.addEventListener('input', actualizarEstadoBoton);

    // Manejo del submit del formulario
    formularioElemento.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      const boton = formularioElemento.querySelector('button[type="submit"]');
      if (!boton) return;

      // Bloquear boton para evitar pedidos dobles
      boton.disabled = true;
      boton.setAttribute('aria-busy', 'true');
      boton.textContent = 'Procesando...';

      try {
        const nombre = valorCampo('nombre');
        const celular = valorCampo('celular');
        const correo = valorCampo('correo');
        const ciudad = valorCampo('ciudad');
        const direccion = valorCampo('direccion');
        const metodoPagoElemento =
          formularioElemento.elements.namedItem('metodo_pago');
        const metodoPago = metodoPagoElemento
          ? metodoPagoElemento.value
          : '';

        // Enviar al servidor para crear el pedido
        const respuesta = await api.crear('/pedidos', {
          nombre_cliente: nombre,
          celular_cliente: celular,
          correo_cliente: correo,
          ciudad,
          direccion,
          metodo_pago: metodoPago,
          // Los items se tomarán del carrito en el backend
          notas: ''
        }, { sinRenovacion: true });

        // Navegar a la pagina de rastreo del pedido
        const pedidoId = respuesta?.datos?.pedido?.id;
        const codigoRastreo = respuesta?.datos?.pedido?.codigoRastreo;

        if (pedidoId && codigoRastreo) {
          router.navegar(`/pedido/${codigoRastreo}`, { reemplazar: true });
        } else {
          // Si no hay codigo de rastreo, mostrar error
          mensajes.replaceChildren(
            el('p', {
              clase: 'texto-error',
              texto:
                'Error: no se generó el código de rastreo. ' +
                'Intente nuevamente.'
            })
          );
          boton.disabled = false;
          boton.removeAttribute('aria-busy');
          boton.textContent = 'Confirmar pedido';
        }
      } catch (error) {
        // Mostrar errores del servidor
        const mensajeError =
          error instanceof Error
            ? error.message
            : 'Error desconocido al crear el pedido';
        mensajes.replaceChildren(
          el('p', { clase: 'texto-error', texto: mensajeError })
        );
        boton.disabled = false;
        boton.removeAttribute('aria-busy');
        boton.textContent = 'Confirmar pedido';
      }
    });

    // Inicializar estado del boton
    actualizarEstadoBoton();

    return seccion;
  }
};
