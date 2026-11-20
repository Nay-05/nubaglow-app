/**
 * ============================================================================
 * NUBAGLOW APP - ASISTENTE IA EN DRAWER LATERAL PUBLICO
 * ============================================================================
 * Las consultas viajan exclusivamente al backend (/api/asistente). Nunca se
 * usa una clave de Gemini en el navegador. Todo el DOM se crea con helpers
 * seguros y las tarjetas permiten abrir la ficha o agregar la variante real.
 */

import { el, icono } from '../core/dom.js';
import { api } from '../core/api.js';
import { formatearBs } from '../core/formato.js';
import { imagenProducto } from '../vistas/comunes.js';
import {
  agregarAlCarritoVisitante,
  leerCarritoVisitante,
  notificarCarritoActualizado
} from '../core/carritoVisitante.js';

const SUGERENCIAS = [
  'Rutina para piel grasa',
  'Hidratantes disponibles',
  'Regalos por menos de 150 Bs'
];

function crearTarjetaProducto(producto, usuario) {
  const estado = el('span', { clase: 'asistente-producto-estado' });
  const agregar = el(
    'button',
    {
      clase: 'btn btn-primary btn-pequeno',
      atributos: { type: 'button' }
    },
    icono('carrito', 14),
    el('span', { texto: 'Agregar' })
  );
  const textoBoton = agregar.querySelector('span');

  agregar.addEventListener('click', async () => {
    const stock = Math.max(0, Number(producto.stock) || 0);
    if (stock <= 0) {
      estado.textContent = 'Sin stock disponible.';
      return;
    }

    agregar.disabled = true;
    estado.textContent = 'Agregando...';

    try {
      if (usuario && usuario.rol === 'cliente') {
        await api.crear('/carrito/items', {
          variante_id: producto.varianteId,
          cantidad: 1
        });
      } else {
        const existente = leerCarritoVisitante().find(
          (item) => Number(item.varianteId) === Number(producto.varianteId)
        );
        const cantidadActual = existente ? Number(existente.cantidad) : 0;
        if (cantidadActual >= stock) {
          throw new Error('Ya tienes el máximo disponible de esta variante.');
        }
        const resultado = agregarAlCarritoVisitante({
          varianteId: producto.varianteId,
          productoId: producto.id,
          productoSlug: producto.slug,
          productoNombre: producto.nombre,
          varianteNombre: producto.varianteNombre,
          precio: producto.precio,
          imagen: producto.imagenPrincipal || '',
          cantidad: 1,
          stockDisponible: stock
        });
        if (!resultado.ok) {
          throw new Error('No se pudo guardar el producto en tu carrito.');
        }
      }

      notificarCarritoActualizado({ origen: 'asistente' });
      textoBoton.textContent = 'Agregado';
      agregar.disabled = true;
      estado.textContent = 'En tu carrito.';
    } catch (error) {
      estado.textContent =
        error.message || 'No se pudo agregar el producto.';
      agregar.disabled = false;
    }
  });

  return el(
    'article',
    { clase: 'asistente-producto' },
    el(
      'div',
      { clase: 'asistente-producto-imagen' },
      imagenProducto(producto.imagenPrincipal || '', producto.nombre)
    ),
    el(
      'div',
      { clase: 'asistente-producto-info' },
      el('strong', { texto: producto.nombre }),
      el('span', {
        clase: 'texto-suave',
        texto: `${producto.categoria || 'Catálogo'} · ${producto.tipoPiel}`
      }),
      el('span', {
        clase: 'asistente-producto-precio',
        texto: formatearBs(producto.precio)
      })
    ),
    el(
      'div',
      { clase: 'asistente-producto-acciones' },
      el(
        'a',
        {
          clase: 'btn btn-outline btn-pequeno',
          href: `/producto/${encodeURIComponent(producto.slug)}`,
          atributos: { 'data-ruta': '' }
        },
        icono('flecha', 14),
        el('span', { texto: 'Ver ficha' })
      ),
      agregar,
      estado
    )
  );
}

export function crearAsistente({ usuario, router } = {}) {
  let historial = [];
  let enviando = false;

  const raiz = el('div', { clase: 'asistente-raiz' });
  const boton = el(
    'button',
    {
      clase: 'asistente-boton',
      atributos: {
        type: 'button',
        'aria-label': 'Abrir asistente NubaGlow',
        'aria-expanded': 'false',
        'aria-controls': 'asistente-drawer'
      }
    },
    icono('asistente', 22)
  );
  const fondo = el('div', {
    clase: 'asistente-fondo',
    atributos: { 'aria-hidden': 'true' }
  });
  const drawer = el('aside', {
    clase: 'asistente-drawer',
    atributos: {
      id: 'asistente-drawer',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'asistente-titulo',
      'aria-hidden': 'true'
    }
  });
  const titulo = el('h2', {
    clase: 'asistente-titulo',
    atributos: { id: 'asistente-titulo' },
    texto: 'Asistente NubaGlow'
  });
  const modo = el('span', {
    clase: 'asistente-modo',
    texto: 'Modo catálogo local'
  });
  modo.hidden = true;

  const cerrar = el(
    'button',
    {
      clase: 'asistente-cerrar',
      atributos: { type: 'button', 'aria-label': 'Cerrar asistente' }
    },
    icono('cerrar', 18)
  );
  const mensajes = el('div', {
    clase: 'asistente-mensajes',
    atributos: { 'aria-live': 'polite' }
  });
  const sugerencias = el(
    'div',
    { clase: 'asistente-sugerencias' },
    ...SUGERENCIAS.map((texto) => {
      const botonSugerencia = el('button', {
        clase: 'asistente-sugerencia',
        atributos: { type: 'button' },
        texto
      });
      botonSugerencia.addEventListener('click', () => enviar(texto));
      return botonSugerencia;
    })
  );
  const estado = el('p', {
    clase: 'asistente-estado',
    atributos: { role: 'status' }
  });
  const entrada = el('input', {
    clase: 'asistente-entrada',
    type: 'text',
    placeholder: 'Pregunta sobre productos, piel o presupuesto',
    atributos: { autocomplete: 'off', 'aria-label': 'Mensaje para el asistente' }
  });
  const enviarBoton = el(
    'button',
    {
      clase: 'asistente-enviar',
      atributos: { type: 'submit', 'aria-label': 'Enviar mensaje' }
    },
    icono('flecha', 18)
  );
  const formulario = el(
    'form',
    { clase: 'asistente-form' },
    entrada,
    enviarBoton
  );

  drawer.append(
    el(
      'header',
      { clase: 'asistente-cabecera' },
      el('div', {}, titulo, modo),
      cerrar
    ),
    mensajes,
    sugerencias,
    estado,
    formulario
  );
  drawer.setAttribute('inert', '');
  raiz.append(boton, fondo, drawer);

  function agregarMensaje(rol, texto) {
    const burbuja = el('article', {
      clase: `asistente-mensaje ${rol}`
    });
    burbuja.append(
      el('span', {
        clase: 'asistente-mensaje-rol',
        texto: rol === 'usuario' ? 'Tú' : 'NubaGlow'
      }),
      el('p', { texto })
    );
    mensajes.appendChild(burbuja);
    mensajes.scrollTop = mensajes.scrollHeight;
    return burbuja;
  }

  function agregarProductos(burbuja, productos) {
    if (!Array.isArray(productos) || productos.length === 0) return;
    const contenedor = el('div', { clase: 'asistente-productos' });
    for (const producto of productos) {
      contenedor.appendChild(crearTarjetaProducto(producto, usuario));
    }
    burbuja.appendChild(contenedor);
    mensajes.scrollTop = mensajes.scrollHeight;
  }

  function abrir() {
    drawer.classList.add('abierto');
    fondo.classList.add('visible');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.removeAttribute('inert');
    boton.setAttribute('aria-expanded', 'true');
    entrada.focus();
    mensajes.scrollTop = mensajes.scrollHeight;
  }

  function cerrarDrawer() {
    drawer.classList.remove('abierto');
    fondo.classList.remove('visible');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    boton.setAttribute('aria-expanded', 'false');
    boton.focus();
  }

  async function enviar(textoForzado) {
    if (enviando) return;
    const mensaje = String(textoForzado ?? entrada.value).trim();
    if (mensaje.length < 2) {
      entrada.focus();
      return;
    }

    enviando = true;
    entrada.disabled = true;
    enviarBoton.disabled = true;
    estado.textContent = 'Consultando el catálogo...';
    modo.hidden = true;

    const contexto = historial.slice(-6);
    agregarMensaje('usuario', mensaje);
    historial.push({ rol: 'usuario', contenido: mensaje });
    entrada.value = '';

    try {
      const respuesta = await api.crear('/asistente', {
        mensaje,
        historial: contexto
      });
      const datos = respuesta?.datos || {};
      const texto = String(
        datos.respuesta || 'No obtuve una respuesta clara. Intenta de nuevo.'
      );
      const burbuja = agregarMensaje('asistente', texto);
      agregarProductos(burbuja, datos.productos || []);
      historial.push({ rol: 'asistente', contenido: texto });
      historial = historial.slice(-8);
      modo.hidden = datos.modoBasico !== true;
      estado.textContent = '';
    } catch (error) {
      agregarMensaje(
        'asistente',
        error.message ||
          'No pude consultar el catálogo en este momento. Intenta nuevamente.'
      );
      estado.textContent = '';
    } finally {
      enviando = false;
      entrada.disabled = false;
      enviarBoton.disabled = false;
      entrada.focus();
    }
  }

  boton.addEventListener('click', abrir);
  cerrar.addEventListener('click', cerrarDrawer);
  fondo.addEventListener('click', cerrarDrawer);
  drawer.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      cerrarDrawer();
    }
  });
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    enviar();
  });

  agregarMensaje(
    'asistente',
    'Hola, soy la asesora de NubaGlow. Cuéntame tu tipo de piel, ' +
      'lo que buscas o tu presupuesto y reviso el catálogo con stock real.'
  );

  return { raiz };
}
