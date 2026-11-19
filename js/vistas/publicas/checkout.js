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

const MENSAJE_CARRITO_VACIO = 'El carrito está vacío. Explora el catálogo para agregar productos.';
const RUTA_INICIO = '/';
const RUTA_LOGIN = '/login';
const RUTA_CARRITO = '/carrito';

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
    let itemsParaCotizar = [];
    try {
      const carritoRes = await api.obtener('/carrito', { sinRenovacion: true });
      carrito = carritoRes?.datos?.carrito;
      if (carrito && carrito.items && carrito.items.length > 0) {
        itemsParaCotizar = carrito.items;
      }
    } catch {
      router.navegar(RUTA_CARRITO, { reemplazar: true });
      return null;
    }

    if (!carrito || carrito.items.length === 0) {
      router.navegar(RUTA_CARRITO, { reemplazar: true });
      return null;
    }

    // 3. Obtener resumen de pedido desde el servidor usando items del carrito
    let cotizacion = null;
    try {
      const respuesta = await api.crear('/pedidos/cotizar', {
        ciudad: '',
        items: itemsParaCotizar
      }, { sinRenovacion: true });
      cotizacion = respuesta?.datos?.cotizacion;
    } catch (error) {
      // Si la cotizacion falla, volvemos al carrito
      router.navegar(RUTA_CARRITO, { reemplazar: true });
      return null;
    }

    // 4. Construir la seccion del checkout
    const seccion = el(
      'section',
      { clase: 'pagina' },
      el('h1', { clase: 'titulo-pagina', texto: 'Finalizar compra' }),
      el('p', { clase: 'subtitulo', texto: 'Revisa tus datos y elige el metodo de pago.' })
    );

    // Area de mensajes de error/success
    const mensajes = el('div', { clase: 'mensajes' });

    // Formulario de datos del cliente
    const formulario = el('form', { clase: 'formulario-checkout' });

    // Campo: nombre completo
    const entradaNombre = el('input', {
      clase: 'input-formulario',
      nombre: 'nombre',
      type: 'text',
      placeholder: 'Juan Perez',
      required: true,
      'aria-label': 'Nombre completo',
      atributos: { 'data-ruta': '' }
    });
    const campoNombre = el(
      'div',
      { clase: 'grupo-formulario' },
      el('label', { texto: 'Nombre completo' }),
      entradaNombre
    );

    // Campo: celular (8 dígitos bolivianos, iniciar con 6 o 7)
    const entradaCelular = el('input', {
      clase: 'input-formulario',
      nombre: 'celular',
      type: 'tel',
      placeholder: '61234567',
      required: true,
      'aria-label': 'Celular',
      atributos: { 'data-ruta': '', pattern: '^[67][0-9]{7}$', inputmode: 'numeric' }
    });
    const campoCelular = el(
      'div',
      { clase: 'grupo-formulario' },
      el('label', { texto: 'Celular' }),
      entradaCelular
    );

    // Campo: correo electrónico
    const entradaCorreo = el('input', {
      clase: 'input-formulario',
      nombre: 'correo',
      type: 'email',
      placeholder: 'juan@ejemplo.com',
      required: true,
      'aria-label': 'Correo electrónico'
    });
    const campoCorreo = el(
      'div',
      { clase: 'grupo-formulario' },
      el('label', { texto: 'Correo electrónico' }),
      entradaCorreo
    );

    // Campo: ciudad
    const entradaCiudad = el('input', {
      clase: 'input-formulario',
      nombre: 'ciudad',
      type: 'text',
      placeholder: 'Sucre',
      required: true,
      'aria-label': 'Ciudad'
    });
    const campoCiudad = el(
      'div',
      { clase: 'grupo-formulario' },
      el('label', { texto: 'Ciudad' }),
      entradaCiudad
    );

    // Campo: dirección exacta
    const entradaDireccion = el('input', {
      clase: 'input-formulario',
      nombre: 'direccion',
      type: 'text',
      placeholder: 'Calle 12 de Octubre No. 123',
      required: true,
      'aria-label': 'Dirección exacta'
    });
    const campoDireccion = el(
      'div',
      { clase: 'grupo-formulario' },
      el('label', { texto: 'Dirección exacta' }),
      entradaDireccion
    );

    // Resumen del pedido
    let resumenPedido;
    if (cotizacion) {
      const lineasResumen = [
        `Subtotal: ${formatearBs(cotizacion.subtotal)}`,
        `Envío: ${formatearBs(cotizacion.costoEnvio)}`,
        `Total: ${formatearBs(cotizacion.total)}`
      ];
      const parrafosResumen = lineasResumen.map((linea) =>
        el('p', { clase: 'texto-suave', texto: linea })
      );
      resumenPedido = el(
        'div',
        { clase: 'resumen-pedido' },
        el('h3', { texto: 'Resumen del pedido' }),
        ...parrafosResumen
      );
    } else {
      resumenPedido = el(
        'div',
        { clase: 'resumen-pedido' },
        el('h3', { texto: 'Resumen del pedido' }),
        el('p', { clase: 'texto-suave', texto: 'Cargando resumen...' })
      );
    }

    // Metodos de pago
    const metodosPago = el('div', { clase: 'metodos-pago' }, el('h3', { texto: 'Metodo de pago' }));

    // Obtener modo de PayPal desde el endpoint publico (sin exponer claves)
    let paypalMensaje = 'PayPal (simulación académica)';

    try {
      const configRes = await api.obtener('/config');
      if (configRes && configRes.datos && configRes.datos.mensajePaypal) {
        paypalMensaje = configRes.datos.mensajePaypal;
      }
    } catch {
      // Si falla la consulta, usar valor por defecto
      paypalMensaje = 'PayPal (simulación académica)';
    }

    // Opcion 1: QR Simple
    const entradaQr = el('input', {
      tipo: 'radio',
      nombre: 'metodo_pago',
      value: 'qr_simple',
      id: 'metodo-qr',
      required: true,
      'aria-label': 'Pago con QR simple'
    });
    const etiquetaQr = el(
      'label',
      { 'for': 'metodo-qr', clase: 'etiqueta-pago' },
      el('span', { clase: 'texto-suave', texto: 'QR Simple' }),
      el('span', {
        clase: 'texto-suave',
        texto: ' - Pago simulado con imagen QR, valida comprobante luego'
      })
    );
    const opcionQr = el('div', { clase: 'opcion-pago' }, entradaQr, etiquetaQr);

    // Opcion 2: Depósito Bancario
    const entradaDeposito = el('input', {
      tipo: 'radio',
      nombre: 'metodo_pago',
      value: 'deposito_bancario',
      id: 'metodo-deposito',
      required: true,
      'aria-label': 'Depósito bancario'
    });
    const etiquetaDeposito = el(
      'label',
      { 'for': 'metodo-deposito', clase: 'etiqueta-pago' },
      el('span', { clase: 'texto-suave', texto: 'Depósito Bancario' }),
      el('span', {
        clase: 'texto-suave',
        texto: ' - Comprobante con carga de archivo, valida manualmente'
      })
    );
    const opcionDeposito = el(
      'div',
      { clase: 'opcion-pago' },
      entradaDeposito,
      etiquetaDeposito
    );

    // Opcion 3: PayPal
    const entradaPaypal = el('input', {
      tipo: 'radio',
      nombre: 'metodo_pago',
      value: 'paypal',
      id: 'metodo-paypal',
      required: true,
      'aria-label': 'PayPal'
    });
    const etiquetaPaypal = el(
      'label',
      { 'for': 'metodo-paypal', clase: 'etiqueta-pago' },
      el('span', { clase: 'texto-suave', texto: paypalMensaje })
    );
    const opcionPayPal = el(
      'div',
      { clase: 'opcion-pago' },
      entradaPaypal,
      etiquetaPaypal
    );

    // Opcion 4: Contra entrega
    const entradaContraEntrega = el('input', {
      tipo: 'radio',
      nombre: 'metodo_pago',
      value: 'contra_entrega',
      id: 'metodo-contra-entrega',
      required: true,
      'aria-label': 'Contra entrega'
    });
    const etiquetaContraEntrega = el(
      'label',
      { 'for': 'metodo-contra-entrega', clase: 'etiqueta-pago' },
      el('span', { clase: 'texto-suave', texto: 'Pago contra entrega' }),
      el('span', {
        clase: 'texto-suave',
        texto: ' - Pagar al recibir el producto en Sucre'
      })
    );
    const opcionContraEntrega = el(
      'div',
      { clase: 'opcion-pago' },
      entradaContraEntrega,
      etiquetaContraEntrega
    );

    // Botón de confirmar
    const botonConfirmar = el('button', {
      clase: 'boton-grande',
      tipo: 'submit',
      disabled: true,
      'aria-label': 'Confirmar pedido'
    }, el('span', { texto: 'Confirmar pedido' }));

    formulario.append(
      campoNombre,
      campoCelular,
      campoCorreo,
      campoCiudad,
      campoDireccion,
      resumenPedido,
      metodosPago,
      opcionQr,
      opcionDeposito,
      opcionPayPal,
      opcionContraEntrega,
      botonConfirmar
    );

    seccion.append(mensajes, formulario);

    // Manejo de validacion de formulario en el navegador
    const formularioElemento = formulario;

    formularioElemento.addEventListener('input', (evento) => {
      const target = evento.target;

      if (target.name === 'nombre') {
        const valor = target.value.trim();
        target.value = valor;
        if (valor.length < 3) {
          target.setCustomValidity('El nombre debe tener al menos 3 caracteres');
        } else {
          target.setCustomValidity('');
        }
      } else if (target.name === 'celular') {
        const valor = target.value.trim();
        target.value = valor;
        if (!/^[67][0-9]{7}$/.test(valor)) {
          target.setCustomValidity('El celular debe tener 8 dígitos y comenzar con 6 o 7');
        } else {
          target.setCustomValidity('');
        }
      } else if (target.name === 'correo') {
        const valor = target.value.trim();
        target.value = valor;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
          target.setCustomValidity('El correo no tiene un formato válido');
        } else {
          target.setCustomValidity('');
        }
      } else if (target.name === 'ciudad') {
        const valor = target.value.trim();
        target.value = valor;
        if (valor.length < 2) {
          target.setCustomValidity('La ciudad debe tener al menos 2 caracteres');
        } else {
          target.setCustomValidity('');
        }
      } else if (target.name === 'direccion') {
        const valor = target.value.trim();
        target.value = valor;
        if (valor.length < 5) {
          target.setCustomValidity('La dirección debe tener al menos 5 caracteres');
        } else {
          target.setCustomValidity('');
        }
      }
    });

    // Habilitar/deshabilitar boton al rellenar campos y seleccionar metodo de pago
    let camposLlenos = false;

    function actualizarEstadoBoton() {
      const nombre = formularioElemento.elements.namedItem('nombre').value.trim();
      const celular = formularioElemento.elements.namedItem('celular').value.trim();
      const correo = formularioElemento.elements.namedItem('correo').value.trim();
      const ciudad = formularioElemento.elements.namedItem('ciudad').value.trim();
      const direccion = formularioElemento.elements.namedItem('direccion').value.trim();

      const hayErrores = formularioElemento.checkValidity() === false;
      const nombreOk = nombre.length >= 3;
      const celularOk = /^[67][0-9]{7}$/.test(celular);
      const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
      const ciudadOk = ciudad.length >= 2;
      const direccionOk = direccion.length >= 5;
      const datosOk =
        nombreOk && celularOk && correoOk && ciudadOk && direccionOk;

      const metodoPago = formularioElemento.elements.namedItem('metodo_pago');
      const metodoSeleccionado = Boolean(metodoPago && metodoPago.checked);

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
        const nombre = String(formularioElemento.elements.namedItem('nombre')?.value || '').trim();
        const celular = String(formularioElemento.elements.namedItem('celular')?.value || '').trim();
        const correo = String(formularioElemento.elements.namedItem('correo')?.value || '').trim();
        const ciudad = String(formularioElemento.elements.namedItem('ciudad')?.value || '').trim();
        const direccion = String(formularioElemento.elements.namedItem('direccion')?.value || '').trim();
        const metodoPago = formularioElemento.elements.namedItem('metodo_pago').value;

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
            el('p', { clase: 'texto-error', texto: 'Error: no se generó el código de rastreo. Intente nuevamente.' })
          );
          boton.disabled = false;
          boton.removeAttribute('aria-busy');
          boton.textContent = 'Confirmar pedido';
        }
      } catch (error) {
        // Mostrar errores del servidor
        const mensajeError = error instanceof Error ? error.message : 'Error desconocido al crear el pedido';
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