/**
 * ============================================================================
 * NUBAGLOW APP - TARJETA DE PRODUCTO COMPARTIDA
 * ============================================================================
 * Usada por el catalogo y por los productos relacionados de la ficha. Mantiene
 * una sola presentacion visual y reutiliza el flujo de carrito de visitante y
 * de cliente autenticado. Todo el contenido dinamico se crea con nodos seguros.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs } from '../../core/formato.js';
import { agregarAlCarritoVisitante, notificarCarritoActualizado } from '../../core/carritoVisitante.js';
import { imagenProducto } from '../comunes.js';

export function estrellas(promedio, tamano = 14) {
  const valor = Number(promedio) || 0;
  const llenas = Math.round(valor);
  const nodos = [];

  for (let indice = 0; indice < 5; indice += 1) {
    const estrella = icono('estrella', tamano);
    if (indice < llenas) estrella.classList.add('estrella-activa');
    nodos.push(estrella);
  }

  return el(
    'span',
    {
      clase: 'estrellas',
      atributos: {
        role: 'img',
        'aria-label': valor > 0 ? `Valoración ${valor.toFixed(1)} de 5` : 'Producto sin reseñas'
      }
    },
    ...nodos
  );
}

export function valoracion(producto) {
  const promedio = Number(producto.promedioCalificacion) || 0;
  const total = Number(producto.totalResenas) || 0;

  return el(
    'div',
    { clase: 'valoracion' },
    estrellas(promedio),
    el('span', {
      texto: promedio > 0 ? `${promedio.toFixed(1)} (${total})` : 'Sin reseñas'
    })
  );
}

function disponibilidad(stock) {
  if (stock <= 0) return { texto: 'Agotado', clase: 'agotado' };
  if (stock <= 5) return { texto: 'Últimas unidades', clase: 'bajo' };
  return null;
}

export function crearTarjetaProducto(producto, { router, usuario }) {
  const stock = Number(producto.stockTotal) || 0;
  const ruta = `/producto/${encodeURIComponent(String(producto.slug || ''))}`;
  const precio = Number(producto.precioMin) || 0;
  const etiquetaStock = disponibilidad(stock);
  const estadoAccion = el('p', {
    clase: 'tarjeta-accion-estado',
    atributos: { role: 'status', 'aria-live': 'polite' }
  });

  const textoBoton = el('span', { texto: stock > 0 ? 'Agregar' : 'Agotado' });
  const botonAgregar = el(
    'button',
    {
      clase: 'btn btn-primary btn-pequeno boton-agregar',
      atributos: {
        type: 'button',
        ...(stock <= 0 ? { disabled: true } : {}),
        'aria-label':
          stock > 0
            ? `Agregar ${producto.nombre || 'producto'} al carrito`
            : `${producto.nombre || 'Producto'} agotado`
      }
    },
    icono('carrito', 16),
    textoBoton
  );

  if (stock > 0) {
    botonAgregar.addEventListener('click', () =>
      agregarProducto({ producto, boton: botonAgregar, textoBoton, estadoAccion, router, usuario })
    );
  }

  return el(
    'article',
    { clase: 'tarjeta-producto tarjeta-catalogo' },
    el(
      'a',
      { clase: 'tarjeta-imagen', href: ruta, atributos: { 'data-ruta': '' } },
      imagenProducto(producto.imagenPrincipal, producto.nombre)
    ),
    el(
      'div',
      { clase: 'tarjeta-cuerpo' },
      el('span', { clase: 'tarjeta-marca', texto: producto.marca || 'Nuba Beauty' }),
      el(
        'h2',
        { clase: 'tarjeta-titulo' },
        el('a', {
          href: ruta,
          atributos: { 'data-ruta': '' },
          texto: producto.nombre || 'Producto Nuba Beauty'
        })
      ),
      el('p', {
        clase: 'tarjeta-precio',
        texto: precio > 0 ? `Desde ${formatearBs(precio)}` : 'Precio por confirmar'
      }),
      valoracion(producto),
      etiquetaStock
        ? el('span', { clase: `estado-stock ${etiquetaStock.clase}`, texto: etiquetaStock.texto })
        : null,
      el('div', { clase: 'tarjeta-acciones' }, estadoAccion, botonAgregar)
    )
  );
}

async function agregarProducto({ producto, boton, textoBoton, estadoAccion, router, usuario }) {
  if (Number(producto.stockTotal) <= 0) return;

  estadoAccion.classList.remove('exito', 'error');
  estadoAccion.textContent = '';
  boton.disabled = true;
  textoBoton.textContent = 'Agregando...';

  try {
    const respuesta = await api.obtener(
      `/productos/${encodeURIComponent(String(producto.slug || ''))}`
    );
    const detalle = respuesta.datos.producto;
    const variantes = detalle.variantes || [];
    const ruta = `/producto/${encodeURIComponent(String(producto.slug || ''))}`;

    if (variantes.length !== 1) {
      router.navegar(ruta);
      return;
    }

    const variante = variantes[0];
    if (Number(variante.stock) <= 0) {
      estadoAccion.textContent = 'Esta presentación está agotada.';
      estadoAccion.classList.add('error');
      return;
    }

    if (usuario && usuario.rol === 'cliente') {
      await api.crear('/carrito/items', { variante_id: variante.id, cantidad: 1 });
      estadoAccion.textContent = 'Agregado a tu carrito.';
    } else {
      const resultado = agregarAlCarritoVisitante({
        varianteId: variante.id,
        productoId: producto.id,
        productoSlug: producto.slug,
        productoNombre: producto.nombre,
        varianteNombre: variante.nombre,
        precio: variante.precio,
        imagen: producto.imagenPrincipal,
        stockDisponible: variante.stock,
        cantidad: 1
      });

      if (!resultado.ok) {
        estadoAccion.textContent = 'No se pudo guardar el carrito en este navegador.';
        estadoAccion.classList.add('error');
        return;
      }

      estadoAccion.textContent = 'Agregado al carrito de visitante.';
    }

    notificarCarritoActualizado({ abrir: true });
    estadoAccion.classList.add('exito');
  } catch (error) {
    const sesionVencida = error && error.estado === 401;
    estadoAccion.textContent = sesionVencida
      ? 'Inicia sesión para guardar tu carrito.'
      : error.message || 'No se pudo agregar el producto. Intenta nuevamente.';
    estadoAccion.classList.add('error');
  } finally {
    boton.disabled = false;
    textoBoton.textContent = 'Agregar';
  }
}
