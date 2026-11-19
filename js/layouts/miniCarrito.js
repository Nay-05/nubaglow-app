/**
 * ============================================================================
 * NUBAGLOW APP - MINI-CARRITO LATERAL (PANEL DESLIZANTE)
 * ============================================================================
 * Comparte el modulo core/carrito.js con la pagina /carrito. Se abre desde el
 * icono de la cabecera o automaticamente al agregar un producto, atrapa el
 * foco mientras esta abierto y se cierra con el boton, Esc o el fondo.
 * Todo el DOM se construye con helpers seguros (sin innerHTML).
 */

import { el, icono } from '../core/dom.js';
import { formatearBs } from '../core/formato.js';
import { solicitar } from '../core/api.js';
import {
  EVENTO_CARRITO,
  cargarCarrito,
  cambiarCantidad,
  quitarItem,
  estadoStock,
  notificarCarritoActualizado
} from '../core/carrito.js';
import { imagenProducto } from '../vistas/comunes.js';

const SIMBOLO_CONTROLADOR = Symbol.for('nubaglow.miniCarrito.controlador');
const TOTAL_SUGERENCIAS = 4;
const AVISO_PAGO = 'El pago se habilita en la siguiente etapa.';

function crearMiniCarrito({ usuario, router }) {
  let estado = null;
  let abierto = false;
  let disparador = null;
  let focoAnterior = null;
  let solicitudActual = 0;
  let sugerencias = null;
  let cargandoSugerencias = false;

  document.body.classList.remove('mini-carrito-abierto');

  const titulo = el('h2', {
    clase: 'mini-carrito-titulo',
    atributos: { id: 'mini-carrito-titulo' },
    texto: 'Tu carrito'
  });

  const conteo = el('p', {
    clase: 'mini-carrito-conteo',
    atributos: { 'aria-live': 'polite' }
  });

  const botonCerrar = el(
    'button',
    {
      clase: 'mini-carrito-cerrar',
      atributos: { type: 'button', 'aria-label': 'Cerrar carrito' }
    },
    icono('cerrar', 18)
  );
  botonCerrar.addEventListener('click', () => cerrar());

  const cuerpo = el('div', { clase: 'mini-carrito-cuerpo' });
  const pie = el('footer', { clase: 'mini-carrito-pie' });
  pie.hidden = true;

  const panel = el(
    'aside',
    {
      clase: 'mini-carrito-panel',
      tabIndex: -1,
      atributos: {
        id: 'mini-carrito-panel',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'mini-carrito-titulo'
      }
    },
    el(
      'header',
      { clase: 'mini-carrito-cabecera' },
      el('div', { clase: 'mini-carrito-cabecera-texto' }, titulo, conteo),
      botonCerrar
    ),
    cuerpo,
    pie
  );

  const velo = el('button', {
    clase: 'mini-carrito-velo',
    atributos: { type: 'button', tabindex: '-1', 'aria-label': 'Cerrar carrito' },
    on: { click: () => cerrar() }
  });

  const raiz = el(
    'div',
    { clase: 'mini-carrito', atributos: { 'aria-hidden': 'true' } },
    velo,
    panel
  );
  raiz.inert = true;

  function enfocarDentro() {
    if (panel.contains(document.activeElement)) return;
    panel.focus();
  }

  function elementosEnfocables() {
    return Array.from(
      panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((elemento) => {
      if (elemento.hidden || elemento.getAttribute('aria-hidden') === 'true') return false;
      if (typeof elemento.checkVisibility === 'function') {
        return elemento.checkVisibility({ checkVisibilityCSS: true });
      }
      return elemento.offsetParent !== null;
    });
  }

  panel.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      cerrar();
      return;
    }

    if (evento.key !== 'Tab') return;

    const enfocables = elementosEnfocables();
    if (enfocables.length === 0) {
      evento.preventDefault();
      panel.focus();
      return;
    }

    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];

    if (evento.shiftKey && (document.activeElement === primero || document.activeElement === panel)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  });

  function abrir() {
    if (abierto) {
      recargar();
      return;
    }

    focoAnterior = document.activeElement;
    abierto = true;
    raiz.inert = false;
    raiz.removeAttribute('aria-hidden');
    raiz.classList.add('abierto');
    document.body.classList.add('mini-carrito-abierto');
    if (disparador) disparador.setAttribute('aria-expanded', 'true');

    botonCerrar.focus();
    recargar();
  }

  function cerrar() {
    if (!abierto) return;

    abierto = false;
    raiz.classList.remove('abierto');
    raiz.setAttribute('aria-hidden', 'true');
    raiz.inert = true;
    document.body.classList.remove('mini-carrito-abierto');
    if (disparador) {
      disparador.setAttribute('aria-expanded', 'false');
      if (disparador.isConnected) {
        disparador.focus();
        return;
      }
    }

    if (focoAnterior && focoAnterior.isConnected && typeof focoAnterior.focus === 'function') {
      focoAnterior.focus();
    }
  }

  function renderCargando() {
    conteo.textContent = '';
    pie.hidden = true;
    cuerpo.replaceChildren(
      el('p', {
        clase: 'mini-carrito-estado',
        atributos: { role: 'status' },
        texto: 'Cargando tu carrito...'
      })
    );
  }

  function renderError(mensaje) {
    conteo.textContent = '';
    pie.hidden = true;

    const reintentar = el(
      'button',
      {
        clase: 'btn btn-outline btn-pequeno',
        atributos: { type: 'button' },
        on: { click: () => recargar() }
      },
      el('span', { texto: 'Reintentar' })
    );

    cuerpo.replaceChildren(
      el(
        'div',
        { clase: 'mini-carrito-estado' },
        el('p', { atributos: { role: 'status' }, texto: mensaje }),
        reintentar
      )
    );
  }

  function crearSugerencias(lista) {
    return el(
      'div',
      { clase: 'mini-sugerencias' },
      ...lista.map((producto) => {
        const ruta = `/producto/${encodeURIComponent(String(producto.slug || ''))}`;
        return el(
          'a',
          {
            clase: 'mini-sugerencia',
            href: ruta,
            atributos: { 'data-ruta': '' },
            on: { click: () => cerrar() }
          },
          el(
            'span',
            { clase: 'mini-sugerencia-imagen' },
            imagenProducto(producto.imagenPrincipal, producto.nombre)
          ),
          el(
            'span',
            { clase: 'mini-sugerencia-info' },
            el('span', {
              clase: 'mini-sugerencia-nombre',
              texto: producto.nombre || 'Producto NubaGlow'
            }),
            el('span', {
              clase: 'mini-sugerencia-meta',
              texto: producto.categoriaNombre || 'NubaGlow'
            })
          )
        );
      })
    );
  }

  async function cargarSugerencias() {
    if (sugerencias !== null || cargandoSugerencias) return;
    cargandoSugerencias = true;

    try {
      const respuesta = await solicitar(
        `/productos?limite=${TOTAL_SUGERENCIAS}&orden=mejor_valorados`
      );
      sugerencias = (respuesta?.datos?.productos || []).slice(0, TOTAL_SUGERENCIAS);
    } catch {
      sugerencias = [];
    } finally {
      cargandoSugerencias = false;
      if (abierto && estado && estado.items.length === 0) render();
    }
  }

  function renderVacio() {
    conteo.textContent = 'Carrito vacío';
    pie.hidden = true;

    const vacio = el(
      'div',
      { clase: 'mini-carrito-vacio' },
      el('p', { clase: 'mini-carrito-vacio-titulo', texto: 'Tu carrito está vacío' }),
      el('p', {
        clase: 'mini-carrito-vacio-texto',
        texto: 'Explora el catálogo y encuentra tu próximo ritual de belleza.'
      }),
      el(
        'a',
        {
          clase: 'btn btn-primary btn-pequeno',
          href: '/catalogo',
          atributos: { 'data-ruta': '' },
          on: { click: () => cerrar() }
        },
        icono('catalogo', 16),
        el('span', { texto: 'Explorar catálogo' })
      )
    );

    if (sugerencias === null) {
      vacio.appendChild(
        el('p', {
          clase: 'mini-carrito-estado',
          atributos: { role: 'status' },
          texto: 'Cargando sugerencias...'
        })
      );
      cargarSugerencias();
    } else if (sugerencias.length > 0) {
      vacio.append(
        el('p', { clase: 'mini-sugerencias-titulo', texto: 'Quizá te interese' }),
        crearSugerencias(sugerencias)
      );
    }

    cuerpo.replaceChildren(vacio);
    enfocarDentro();
  }

  function crearLinea(item) {
    const stock = estadoStock(item);
    const stockDisponible =
      item.stockDisponible === null ? null : Number(item.stockDisponible);
    const ruta = `/producto/${encodeURIComponent(item.productoSlug)}`;

    const disponibilidad = el('span', {
      clase: 'mini-linea-disponibilidad',
      texto:
        stock === 'agotado'
          ? 'No disponible.'
          : stockDisponible === null
            ? 'Disponibilidad a confirmar.'
            : `Disponible: ${stockDisponible} unidades.`
    });
    if (stock !== 'ok') disponibilidad.classList.add('texto-error');

    const aviso = el('p', {
      clase: 'mini-linea-aviso',
      atributos: { role: 'status' }
    });
    aviso.hidden = true;

    if (stock === 'agotado') {
      aviso.hidden = false;
      aviso.textContent = item.noDisponible
        ? 'Esta variante ya no está disponible. Quítala para continuar.'
        : 'Variante agotada. Quítala del carrito para continuar.';
    } else if (stock === 'excede') {
      aviso.hidden = false;
      aviso.textContent = `Solo quedan ${stockDisponible} unidades. Ajusta la cantidad para continuar.`;
    }

    const restar = el(
      'button',
      {
        clase: 'mini-cantidad-boton',
        atributos: {
          type: 'button',
          'aria-label': `Reducir la cantidad de ${item.productoNombre}`
        },
        disabled: item.cantidad <= 1 || stock === 'agotado',
        on: {
          click: () =>
            modificarCantidad(
              item,
              stock === 'excede' ? Math.max(1, Number(stockDisponible)) : item.cantidad - 1,
              aviso,
              linea
            )
        }
      },
      icono('menos', 14)
    );

    const sumar = el(
      'button',
      {
        clase: 'mini-cantidad-boton',
        atributos: {
          type: 'button',
          'aria-label': `Aumentar la cantidad de ${item.productoNombre}`
        },
        disabled:
          stock !== 'ok' ||
          (stockDisponible !== null && item.cantidad >= stockDisponible),
        on: { click: () => modificarCantidad(item, item.cantidad + 1, aviso, linea) }
      },
      icono('mas', 14)
    );

    const quitar = el(
      'button',
      {
        clase: 'mini-linea-quitar',
        atributos: {
          type: 'button',
          'aria-label': `Quitar ${item.productoNombre} del carrito`
        },
        on: { click: () => eliminarLinea(item, aviso, linea) }
      },
      icono('papelera', 16)
    );

    const linea = el(
      'article',
      { clase: 'mini-linea' },
      el(
        'a',
        {
          clase: 'mini-linea-imagen',
          href: ruta,
          atributos: { 'data-ruta': '', 'aria-label': `Ver ${item.productoNombre}` },
          on: { click: () => cerrar() }
        },
        imagenProducto(item.imagen, item.productoNombre)
      ),
      el(
        'div',
        { clase: 'mini-linea-info' },
        el('a', {
          clase: 'mini-linea-nombre',
          href: ruta,
          atributos: { 'data-ruta': '' },
          on: { click: () => cerrar() },
          texto: item.productoNombre
        }),
        el('span', { clase: 'mini-linea-variante', texto: item.varianteNombre }),
        el('span', {
          clase: 'mini-linea-precio',
          texto: `${formatearBs(item.precioUnitario)} c/u`
        }),
        disponibilidad,
        el(
          'div',
          { clase: 'mini-linea-acciones' },
          el(
            'div',
            {
              clase: 'mini-cantidad',
              atributos: {
                role: 'group',
                'aria-label': `Cantidad de ${item.productoNombre}`
              }
            },
            restar,
            el('output', {
              clase: 'mini-cantidad-valor',
              atributos: { 'aria-live': 'polite' },
              texto: String(item.cantidad)
            }),
            sumar
          ),
          quitar
        ),
        aviso
      )
    );

    return linea;
  }

  function renderLineas() {
    conteo.textContent =
      estado.totalArticulos === 1 ? '1 artículo' : `${estado.totalArticulos} artículos`;

    cuerpo.replaceChildren(
      el(
        'div',
        { clase: 'mini-carrito-lineas' },
        ...estado.items.map((item) => crearLinea(item))
      )
    );

    const verCarrito = el(
      'a',
      {
        clase: 'btn btn-primary',
        href: '/carrito',
        atributos: { 'data-ruta': '' },
        on: { click: () => cerrar() }
      },
      el('span', { texto: 'Ver carrito' })
    );

    const bloqueado = estado.items.some((item) => estadoStock(item) !== 'ok');
    const avisoPago = el('p', {
      clase: 'mini-carrito-nota',
      atributos: { role: 'status' }
    });
    avisoPago.hidden = true;

    const continuar = el(
      'button',
      {
        clase: 'btn btn-outline',
        atributos: { type: 'button' },
        disabled: bloqueado
      },
      el('span', { texto: 'Continuar con la compra' })
    );

    continuar.addEventListener('click', () => {
      if (!usuario || usuario.rol !== 'cliente') {
        cerrar();
        const destino = '/login?redirigir=/carrito';
        if (router && typeof router.navegar === 'function') {
          router.navegar(destino);
        } else {
          window.location.assign(destino);
        }
        return;
      }

      avisoPago.hidden = false;
      avisoPago.textContent = AVISO_PAGO;
    });

    pie.replaceChildren(
      el(
        'div',
        { clase: 'mini-carrito-resumen' },
        el('span', { texto: 'Subtotal' }),
        el('strong', { texto: formatearBs(estado.subtotal) })
      ),
      el('p', {
        clase: 'mini-carrito-nota',
        texto: bloqueado
          ? 'Corrige las cantidades marcadas para continuar.'
          : 'Revisa los artículos antes de continuar.'
      }),
      el('div', { clase: 'mini-carrito-acciones' }, verCarrito, continuar),
      avisoPago
    );
    pie.hidden = false;

    enfocarDentro();
  }

  function render() {
    if (!estado) {
      renderError('No se pudo cargar tu carrito. Intenta nuevamente.');
      return;
    }

    if (estado.items.length === 0) {
      renderVacio();
      return;
    }

    renderLineas();
  }

  async function recargar() {
    const turno = ++solicitudActual;
    if (!estado) renderCargando();

    try {
      const datos = await cargarCarrito(usuario);
      if (turno !== solicitudActual) return;
      estado = datos;
      render();
    } catch (error) {
      if (turno !== solicitudActual) return;
      estado = null;
      renderError(error.message || 'No se pudo cargar tu carrito.');
    }
  }

  async function modificarCantidad(item, cantidad, aviso, linea) {
    linea.classList.add('mini-linea-ocupada');
    aviso.hidden = false;
    aviso.textContent = 'Actualizando...';

    try {
      estado = await cambiarCantidad(usuario, item, cantidad);
      notificarCarritoActualizado({ origen: 'mini' });
      render();
    } catch (error) {
      aviso.hidden = false;
      aviso.textContent = error.message || 'No se pudo actualizar la cantidad.';
      linea.classList.remove('mini-linea-ocupada');
    }
  }

  async function eliminarLinea(item, aviso, linea) {
    linea.classList.add('mini-linea-ocupada');
    aviso.hidden = false;
    aviso.textContent = 'Quitando...';

    try {
      estado = await quitarItem(usuario, item);
      notificarCarritoActualizado({ origen: 'mini' });
      render();
    } catch (error) {
      aviso.hidden = false;
      aviso.textContent = error.message || 'No se pudo quitar el producto.';
      linea.classList.remove('mini-linea-ocupada');
    }
  }

  function vincularDisparador(boton) {
    if (!boton) return;
    disparador = boton;
    boton.setAttribute('aria-haspopup', 'dialog');
    boton.setAttribute('aria-controls', 'mini-carrito-panel');
    boton.setAttribute('aria-expanded', 'false');
    boton.addEventListener('click', () => abrir());
  }

  if (window[SIMBOLO_CONTROLADOR]) window[SIMBOLO_CONTROLADOR].abort();
  const controlador = new AbortController();
  window[SIMBOLO_CONTROLADOR] = controlador;

  window.addEventListener(
    EVENTO_CARRITO,
    (evento) => {
      const detalle = evento.detail || {};
      if (detalle.origen === 'mini') return;

      if (detalle.abrir) {
        if (!abierto) {
          abrir();
        } else {
          recargar();
        }
        return;
      }

      if (abierto) recargar();
    },
    { signal: controlador.signal }
  );

  return { raiz, abrir, cerrar, vincularDisparador, recargar };
}

export { crearMiniCarrito };
