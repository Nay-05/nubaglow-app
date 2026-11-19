/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: CARRITO (/carrito)
 * ============================================================================
 * Vista completa del carrito. Comparte el modulo core/carrito.js con el
 * mini-carrito lateral: cliente autenticado usa la API y visitante usa el
 * respaldo local, por lo que ambos puntos de entrada muestran lo mismo.
 * No se simula checkout ni costos de envio: el total final lo calcula el
 * servidor al crear el pedido en la Fase 6.
 */

import { el, icono } from '../../core/dom.js';
import { formatearBs } from '../../core/formato.js';
import {
  cargarCarrito,
  cambiarCantidad,
  quitarItem,
  estadoStock,
  consumirAvisoFusion,
  notificarCarritoActualizado
} from '../../core/carrito.js';
import {
  encabezadoPagina,
  alerta,
  boton,
  enlaceInterno,
  estadoVacio,
  imagenProducto,
  tabla
} from '../comunes.js';

const MENSAJE_PAGO = 'El pago se habilita en la siguiente etapa.';
const RUTA_LOGIN_CARRITO = '/login?redirigir=/carrito';

function textoAvisoFusion(resumen) {
  if (resumen.error) {
    return 'Iniciaste sesión, pero no pudimos unir el carrito de tu visita. Tus artículos siguen guardados en este navegador.';
  }

  const partes = [];

  if (resumen.agregados > 0) {
    partes.push(
      resumen.agregados === 1
        ? 'Agregamos 1 artículo del carrito de visitante a tu cuenta.'
        : `Agregamos ${resumen.agregados} artículos del carrito de visitante a tu cuenta.`
    );
  }

  if (resumen.ajustados > 0) {
    partes.push(
      resumen.ajustados === 1
        ? 'Ajustamos 1 artículo para respetar el stock disponible.'
        : `Ajustamos ${resumen.ajustados} artículos para respetar el stock disponible.`
    );
  }

  if (resumen.noDisponibles > 0) {
    partes.push(
      resumen.noDisponibles === 1
        ? '1 artículo ya no estaba disponible y no se agregó.'
        : `${resumen.noDisponibles} artículos ya no estaban disponibles y no se agregaron.`
    );
  }

  if (resumen.vaciado === false) {
    partes.push('No pudimos vaciar el respaldo temporal del navegador; revísalo antes de continuar.');
  }

  return partes.length > 0
    ? partes.join(' ')
    : 'El carrito de tu visita se unió correctamente a tu cuenta.';
}

function textoDisponibilidad(item) {
  const stock = estadoStock(item);

  if (stock === 'agotado') {
    return {
      texto: item.noDisponible
        ? 'Esta variante ya no está disponible.'
        : 'Variante agotada.',
      clase: 'texto-error'
    };
  }

  if (stock === 'excede') {
    return {
      texto: `Solo quedan ${item.stockDisponible} unidades. Ajusta la cantidad para continuar.`,
      clase: 'texto-error'
    };
  }

  if (item.stockDisponible === null) {
    return {
      texto: 'Disponibilidad a confirmar.',
      clase: 'texto-suave'
    };
  }

  return {
    texto: `Disponible: ${item.stockDisponible} unidades.`,
    clase: 'texto-suave'
  };
}

function celdaProducto(item, alQuitar) {
  const disponibilidad = textoDisponibilidad(item);
  const quitar = el(
    'button',
    {
      clase: 'carrito-quitar',
      atributos: {
        type: 'button',
        'aria-label': `Quitar ${item.productoNombre} del carrito`
      },
      on: { click: () => alQuitar(item, quitar) }
    },
    icono('papelera', 14),
    el('span', { texto: 'Quitar' })
  );

  return el(
    'div',
    { clase: 'celda-producto carrito-producto' },
    imagenProducto(item.imagen, item.productoNombre),
    el(
      'div',
      { clase: 'carrito-producto-info' },
      el('a', {
        clase: 'celda-producto-nombre',
        href: `/producto/${encodeURIComponent(item.productoSlug)}`,
        atributos: { 'data-ruta': '' },
        texto: item.productoNombre
      }),
      el('span', { clase: 'texto-suave', texto: item.varianteNombre }),
      el('span', {
        clase: disponibilidad.clase,
        atributos: { role: 'status' },
        texto: disponibilidad.texto
      }),
      quitar
    )
  );
}

function celdaCantidad(item, alCambiar) {
  const stock = estadoStock(item);
  const stockDisponible =
    item.stockDisponible === null ? null : Number(item.stockDisponible);

  const menos = el(
    'button',
    {
      clase: 'carrito-cantidad-boton',
      atributos: {
        type: 'button',
        'aria-label': `Reducir la cantidad de ${item.productoNombre}`
      },
      disabled: item.cantidad <= 1 || stock === 'agotado'
    },
    icono('menos', 14)
  );

  const mas = el(
    'button',
    {
      clase: 'carrito-cantidad-boton',
      atributos: {
        type: 'button',
        'aria-label': `Aumentar la cantidad de ${item.productoNombre}`
      },
      disabled:
        stock !== 'ok' ||
        (stockDisponible !== null && item.cantidad >= stockDisponible)
    },
    icono('mas', 14)
  );

  const grupo = el(
    'div',
    {
      clase: 'carrito-cantidad',
      atributos: { role: 'group', 'aria-label': `Cantidad de ${item.productoNombre}` }
    },
    menos,
    el('output', {
      clase: 'carrito-cantidad-valor',
      atributos: { 'aria-live': 'polite' },
      texto: String(item.cantidad)
    }),
    mas
  );

  menos.addEventListener('click', () => {
    const cantidad =
      stock === 'excede'
        ? Math.max(1, Number(stockDisponible) || 1)
        : item.cantidad - 1;
    alCambiar(item, cantidad, grupo);
  });

  mas.addEventListener('click', () => {
    alCambiar(item, item.cantidad + 1, grupo);
  });

  return grupo;
}

export const vistaCarrito = {
  async render(contexto = {}) {
    const { usuario, router } = contexto;

    const seccion = el(
      'section',
      { clase: 'pagina' },
      encabezadoPagina('Tu carrito', 'Revisa los artículos que agregaste antes de continuar.')
    );
    const avisos = el('div', { clase: 'mensajes' });
    const mensajes = el('div', { clase: 'mensajes' });
    const contenido = el('div', { clase: 'carrito-contenido' });

    seccion.append(avisos, mensajes, contenido);

    const avisoFusion = consumirAvisoFusion();
    if (avisoFusion) {
      avisos.appendChild(
        alerta(textoAvisoFusion(avisoFusion), avisoFusion.error ? 'error' : 'info')
      );
    }

    let carrito = null;

    function navegar(ruta) {
      if (router && typeof router.navegar === 'function') {
        router.navegar(ruta);
      } else {
        window.location.assign(ruta);
      }
    }

    function mostrarMensaje(mensaje, tipo = 'error') {
      mensajes.replaceChildren(alerta(mensaje, tipo));
    }

    function deshabilitarGrupo(grupo) {
      grupo.querySelectorAll('button').forEach((control) => {
        control.disabled = true;
      });
    }

    async function recargar() {
      try {
        carrito = await cargarCarrito(usuario);
        renderContenido();
      } catch (error) {
        carrito = null;
        contenido.replaceChildren();
        mostrarMensaje(error.message || 'No se pudo cargar tu carrito. Intenta nuevamente.');
      }
    }

    async function cambiar(item, cantidad, grupo) {
      deshabilitarGrupo(grupo);

      try {
        carrito = await cambiarCantidad(usuario, item, cantidad);
        notificarCarritoActualizado({ origen: 'pagina-carrito' });
        renderContenido();
      } catch (error) {
        mostrarMensaje(error.message || 'No se pudo actualizar la cantidad.');
        await recargar();
      }
    }

    async function quitar(item, botonQuitar) {
      botonQuitar.disabled = true;

      try {
        carrito = await quitarItem(usuario, item);
        notificarCarritoActualizado({ origen: 'pagina-carrito' });
        renderContenido();
      } catch (error) {
        mostrarMensaje(error.message || 'No se pudo quitar el producto.');
        await recargar();
      }
    }

    function renderContenido() {
      contenido.replaceChildren();

      if (!carrito || carrito.items.length === 0) {
        contenido.append(
          estadoVacio('Tu carrito está vacío. Explora el catálogo para agregar productos.'),
          enlaceInterno('/catalogo', 'Ver catálogo', { clase: 'btn btn-primary' })
        );
        return;
      }

      const bloqueado = carrito.items.some((item) => estadoStock(item) !== 'ok');
      const continuar = boton('Continuar con la compra', { variante: 'primary' });
      continuar.disabled = bloqueado;

      continuar.addEventListener('click', () => {
        if (!usuario || usuario.rol !== 'cliente') {
          navegar(RUTA_LOGIN_CARRITO);
          return;
        }

        mostrarMensaje(MENSAJE_PAGO, 'info');
      });

      contenido.appendChild(
        tabla(
          ['Producto', 'Cantidad', 'Precio unitario', 'Subtotal'],
          carrito.items.map((item) => [
            celdaProducto(item, quitar),
            celdaCantidad(item, cambiar),
            formatearBs(item.precioUnitario),
            formatearBs(item.subtotal)
          ])
        )
      );

      contenido.appendChild(
        el(
          'div',
          { clase: 'resumen-carrito' },
          el('p', { texto: `Artículos: ${carrito.totalArticulos}` }),
          el('p', {
            clase: 'resumen-total',
            texto: `Subtotal: ${formatearBs(carrito.subtotal)}`
          }),
          el('p', {
            clase: 'texto-suave',
            texto: 'El total definitivo lo calcula el servidor al crear el pedido.'
          }),
          bloqueado
            ? el('p', {
                clase: 'texto-error',
                texto: 'Corrige las cantidades marcadas para continuar con la compra.'
              })
            : null,
          el(
            'div',
            { clase: 'carrito-acciones' },
            continuar,
            enlaceInterno('/catalogo', 'Seguir comprando', { clase: 'btn btn-outline' })
          )
        )
      );
    }

    await recargar();
    return seccion;
  }
};
