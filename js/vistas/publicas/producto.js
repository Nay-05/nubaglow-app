/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: FICHA DE PRODUCTO (/producto/:slug)
 * ============================================================================
 * Galeria con miniaturas, seleccion de variante y cantidad, carrito de cliente
 * o visitante, resenas verificadas y productos relacionados. Los datos de la
 * base se pintan siempre con nodos y textContent (nunca innerHTML).
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs, formatearFechaCorta } from '../../core/formato.js';
import {
  agregarAlCarritoVisitante,
  leerCarritoVisitante,
  notificarCarritoActualizado
} from '../../core/carritoVisitante.js';
import {
  alerta,
  areaTexto,
  boton,
  enlaceInterno,
  estadoVacio,
  imagenProducto
} from '../comunes.js';
import { crearTarjetaProducto, estrellas } from './tarjetaProducto.js';

const MAX_RELACIONADOS = 4;
const UMBRAL_ULTIMAS_UNIDADES = 5;

function disponibilidadVariante(stock) {
  const unidades = Math.max(0, Number(stock) || 0);
  if (unidades <= 0) return { texto: 'Agotado', clase: 'agotado' };
  if (unidades <= UMBRAL_ULTIMAS_UNIDADES) {
    return { texto: `Últimas unidades (quedan ${unidades})`, clase: 'bajo' };
  }
  return { texto: 'Disponible', clase: 'disponible' };
}

function textoValoracion(promedio, total) {
  const cantidad = Number(total) || 0;
  if (cantidad === 0) return 'Sin reseñas todavía';
  const valor = Number(promedio) || 0;
  return `${valor.toFixed(1)} · ${cantidad} ${cantidad === 1 ? 'reseña' : 'reseñas'}`;
}

function crearValoracion(promedio, total) {
  return el(
    'div',
    { clase: 'ficha-valoracion' },
    estrellas(promedio, 16),
    el('span', { clase: 'ficha-valoracion-texto', texto: textoValoracion(promedio, total) })
  );
}

function crearMigas(producto) {
  return el(
    'nav',
    { clase: 'ficha-migas', atributos: { 'aria-label': 'Ruta de navegación' } },
    enlaceInterno('/', 'Inicio'),
    el('span', { clase: 'ficha-migas-separador', texto: '/' }),
    enlaceInterno('/catalogo', 'Catálogo'),
    el('span', { clase: 'ficha-migas-separador', texto: '/' }),
    producto.categoriaSlug
      ? enlaceInterno(
          `/catalogo?categoria=${encodeURIComponent(String(producto.categoriaSlug))}`,
          producto.categoriaNombre || 'Categoría'
        )
      : el('span', { texto: producto.categoriaNombre || 'Producto' }),
    el('span', { clase: 'ficha-migas-separador', texto: '/' }),
    el('span', { clase: 'ficha-migas-actual', texto: producto.nombre || 'Producto' })
  );
}

function crearGaleria(producto) {
  const urls = [];
  for (const imagen of producto.imagenes || []) {
    const url = imagen && imagen.url;
    if (url && !urls.includes(url)) urls.push(url);
  }
  if (urls.length === 0 && producto.imagenPrincipal) urls.push(producto.imagenPrincipal);
  if (urls.length === 0) urls.push('assets/brand/icono1.png');

  const principal = el('div', { clase: 'ficha-galeria-principal' });
  const miniaturas = el('div', {
    clase: 'ficha-miniaturas',
    atributos: { role: 'group', 'aria-label': 'Miniaturas del producto' }
  });
  const botones = [];

  const mostrar = (indice) => {
    principal.replaceChildren(
      imagenProducto(urls[indice], `${producto.nombre || 'Producto'} - imagen ${indice + 1}`)
    );
    botones.forEach((botonMini, posicion) => {
      const activa = posicion === indice;
      botonMini.classList.toggle('activa', activa);
      botonMini.setAttribute('aria-pressed', activa ? 'true' : 'false');
    });
  };

  if (urls.length > 1) {
    urls.forEach((url, indice) => {
      const botonMini = el(
        'button',
        {
          clase: 'ficha-miniatura',
          atributos: {
            type: 'button',
            'aria-label': `Ver imagen ${indice + 1} de ${urls.length}`,
            'aria-pressed': 'false'
          }
        },
        imagenProducto(url, `${producto.nombre || 'Producto'} - miniatura ${indice + 1}`)
      );
      botonMini.addEventListener('click', () => mostrar(indice));
      botones.push(botonMini);
      miniaturas.appendChild(botonMini);
    });
  }

  mostrar(0);

  return el(
    'div',
    { clase: 'ficha-galeria' },
    principal,
    urls.length > 1 ? miniaturas : null
  );
}

function crearInfoProducto(producto, { usuario }) {
  const variantes = Array.isArray(producto.variantes) ? producto.variantes : [];
  let seleccionada =
    variantes.find((variante) => Number(variante.stock) > 0) || variantes[0] || null;

  const valoracionNodo = crearValoracion(
    producto.promedioCalificacion,
    producto.totalResenas
  );
  const precioNodo = el('p', { clase: 'ficha-precio' });
  const disponibilidadNodo = el('p', { clase: 'ficha-disponibilidad' });
  const estadoAccion = el('p', {
    clase: 'ficha-accion-estado',
    atributos: { role: 'status', 'aria-live': 'polite' }
  });

  const textoSkin = producto.tipoPiel
    ? el('span', { clase: 'ficha-chip', texto: `Piel ${producto.tipoPiel}` })
    : null;

  const grupoVariantes = el('div', {
    clase: 'ficha-variantes',
    atributos: { role: 'group', 'aria-label': 'Presentaciones disponibles' }
  });
  const botonesVariante = variantes.map((variante) => {
    const botonVariante = el(
      'button',
      {
        clase: 'ficha-variante',
        atributos: {
          type: 'button',
          'aria-pressed': 'false',
          'aria-label': `${variante.nombre || 'Presentación'}, ${formatearBs(variante.precio)}`
        }
      },
      el('span', { clase: 'ficha-variante-nombre', texto: variante.nombre || 'Presentación' }),
      el('span', { clase: 'ficha-variante-precio', texto: formatearBs(variante.precio) })
    );
    botonVariante.addEventListener('click', () => seleccionarVariante(variante));
    grupoVariantes.appendChild(botonVariante);
    return botonVariante;
  });

  const selectorCantidad = el('select', {
    clase: 'entrada ficha-selector-cantidad',
    id: 'ficha-cantidad',
    name: 'cantidad',
    atributos: { 'aria-label': 'Cantidad de unidades' }
  });
  const textoBoton = el('span', { texto: 'Agregar al carrito' });
  const botonAgregar = el(
    'button',
    { clase: 'btn btn-primary ficha-boton-agregar', atributos: { type: 'button' } },
    icono('carrito', 18),
    textoBoton
  );

  const fichaCompra = el(
    'div',
    { clase: 'ficha-compra' },
    el(
      'div',
      { clase: 'ficha-compra-precio' },
      el('span', { clase: 'ficha-precio-etiqueta', texto: 'Precio' }),
      precioNodo
    ),
    disponibilidadNodo,
    variantes.length
      ? el(
          'fieldset',
          { clase: 'ficha-grupo' },
          el('legend', { clase: 'ficha-grupo-titulo', texto: 'Presentación' }),
          grupoVariantes
        )
      : el('p', { clase: 'texto-suave', texto: 'Este producto no tiene presentaciones activas.' }),
    el(
      'div',
      { clase: 'ficha-cantidad' },
      el('label', { clase: 'ficha-cantidad-etiqueta', atributos: { for: 'ficha-cantidad' }, texto: 'Cantidad' }),
      selectorCantidad
    ),
    botonAgregar,
    estadoAccion
  );

  const info = el(
    'div',
    { clase: 'ficha-info' },
    el('span', { clase: 'tarjeta-marca', texto: producto.marca || 'Nuba Beauty' }),
    el('h1', { clase: 'ficha-titulo', texto: producto.nombre || 'Producto Nuba Beauty' }),
    valoracionNodo,
    el(
      'div',
      { clase: 'ficha-etiquetas' },
      producto.categoriaSlug
        ? enlaceInterno(
            `/catalogo?categoria=${encodeURIComponent(String(producto.categoriaSlug))}`,
            producto.categoriaNombre || 'Categoría',
            { clase: 'ficha-chip ficha-chip-enlace' }
          )
        : null,
      textoSkin
    ),
    el('p', {
      clase: 'ficha-descripcion',
      texto: producto.descripcion || 'Descripción no disponible por el momento.'
    }),
    fichaCompra
  );

  function actualizarCantidad(stock) {
    const unidades = Math.max(0, Number(stock) || 0);
    const opciones = [];
    for (let cantidad = 1; cantidad <= unidades; cantidad += 1) {
      opciones.push(el('option', { value: String(cantidad), texto: String(cantidad) }));
    }
    if (opciones.length === 0) {
      opciones.push(el('option', { value: '0', texto: '0' }));
    }
    selectorCantidad.replaceChildren(...opciones);
    selectorCantidad.value = unidades > 0 ? '1' : '0';
    selectorCantidad.disabled = unidades <= 0;
  }

  function actualizarBoton(stock) {
    const disponible = Number(stock) > 0;
    botonAgregar.disabled = !disponible;
    textoBoton.textContent = disponible ? 'Agregar al carrito' : 'Producto agotado';
    botonAgregar.setAttribute(
      'aria-label',
      disponible
        ? `Agregar ${producto.nombre || 'producto'} al carrito`
        : `${producto.nombre || 'Producto'} agotado`
    );
  }

  function seleccionarVariante(variante) {
    seleccionada = variante || null;
    const stock = seleccionada ? Number(seleccionada.stock) || 0 : 0;

    botonesVariante.forEach((botonVariante, indice) => {
      const activa = variantes[indice] && seleccionada && variantes[indice].id === seleccionada.id;
      botonVariante.classList.toggle('activa', Boolean(activa));
      botonVariante.setAttribute('aria-pressed', activa ? 'true' : 'false');
    });

    precioNodo.textContent = seleccionada
      ? formatearBs(seleccionada.precio)
      : formatearBs(producto.precioMin);

    const disponibilidad = disponibilidadVariante(stock);
    disponibilidadNodo.textContent = disponibilidad.texto;
    disponibilidadNodo.className = `ficha-disponibilidad ${disponibilidad.clase}`;
    actualizarCantidad(stock);
    actualizarBoton(stock);
  }

  botonAgregar.addEventListener('click', agregarAlCarrito);

  async function agregarAlCarrito() {
    if (!seleccionada) return;
    const stock = Math.max(0, Number(seleccionada.stock) || 0);
    if (stock <= 0) return;

    const cantidad = Math.min(
      Math.max(1, Number(selectorCantidad.value) || 1),
      stock
    );
    estadoAccion.classList.remove('exito', 'error');
    estadoAccion.textContent = '';
    botonAgregar.disabled = true;
    textoBoton.textContent = 'Agregando...';

    try {
      if (usuario && usuario.rol === 'cliente') {
        await api.crear('/carrito/items', {
          variante_id: seleccionada.id,
          cantidad
        });
        estadoAccion.textContent = 'Agregado a tu carrito.';
      } else {
        const existente = leerCarritoVisitante().find(
          (item) => item.varianteId === Number(seleccionada.id)
        );
        if (existente && existente.cantidad + cantidad > stock) {
          estadoAccion.textContent = `Solo quedan ${stock} unidades de esta presentación.`;
          estadoAccion.classList.add('error');
          return;
        }

        const resultado = agregarAlCarritoVisitante({
          varianteId: seleccionada.id,
          productoId: producto.id,
          productoSlug: producto.slug,
          productoNombre: producto.nombre,
          varianteNombre: seleccionada.nombre,
          precio: seleccionada.precio,
          imagen: producto.imagenPrincipal,
          stockDisponible: seleccionada.stock,
          cantidad
        });

        if (!resultado.ok) {
          estadoAccion.textContent = 'No se pudo guardar el carrito en este navegador.';
          estadoAccion.classList.add('error');
          return;
        }

        estadoAccion.textContent = 'Agregado al carrito de visitante.';
      }

      estadoAccion.classList.add('exito');
      notificarCarritoActualizado({ abrir: true });
      selectorCantidad.value = '1';
    } catch (error) {
      let mensaje = error && error.message
        ? error.message
        : 'No se pudo agregar el producto. Intenta nuevamente.';

      if (error && error.estado === 401) {
        mensaje = 'Tu sesión expiró. Inicia sesión como cliente para guardar el carrito.';
      } else if (error && error.estado === 400 && /stock/i.test(mensaje)) {
        const disponible = /Disponible:\s*(\d+)/i.exec(mensaje);
        mensaje = disponible
          ? `Solo quedan ${disponible[1]} unidades de esta presentación.`
          : 'No hay suficiente stock para esa cantidad.';
      }

      estadoAccion.textContent = mensaje;
      estadoAccion.classList.add('error');
    } finally {
      actualizarBoton(seleccionada ? seleccionada.stock : 0);
    }
  }

  seleccionarVariante(seleccionada);

  return {
    nodo: info,
    actualizarValoracion(resumen) {
      const total = Number(resumen.total) || 0;
      const promedio = Number(resumen.promedio) || 0;
      valoracionNodo.replaceChildren(
        estrellas(promedio, 16),
        el('span', { clase: 'ficha-valoracion-texto', texto: textoValoracion(promedio, total) })
      );
    }
  };
}

function crearFormularioResena({ producto, usuario, alPublicar }) {
  const contenedor = el('div', { clase: 'resena-formulario' });

  if (!usuario || usuario.rol !== 'cliente') {
    contenedor.appendChild(
      el(
        'p',
        { clase: 'texto-suave resena-aviso-sesion' },
        'Inicia sesión como cliente para publicar una reseña verificada. ',
        enlaceInterno(
          `/login?redirigir=${encodeURIComponent(`/producto/${producto.slug}`)}`,
          'Iniciar sesión'
        )
      )
    );
    return contenedor;
  }

  const mensajes = el('div', { clase: 'mensajes resena-form-mensajes' });
  const botonesEstrella = [];
  let calificacion = 0;

  const estrellasEntrada = el('div', {
    clase: 'estrellas-entrada',
    atributos: { role: 'group', 'aria-label': 'Calificación con estrellas' }
  });

  for (let valor = 1; valor <= 5; valor += 1) {
    const botonEstrella = el(
      'button',
      {
        clase: 'estrella-boton',
        atributos: {
          type: 'button',
          'aria-pressed': 'false',
          'aria-label': `${valor} ${valor === 1 ? 'estrella' : 'estrellas'}`
        }
      },
      icono('estrella', 24)
    );
    botonEstrella.addEventListener('click', () => {
      calificacion = valor;
      botonesEstrella.forEach((nodo, indice) => {
        const activa = indice < calificacion;
        nodo.classList.toggle('activa', activa);
        nodo.setAttribute('aria-pressed', indice === calificacion - 1 ? 'true' : 'false');
      });
    });
    botonesEstrella.push(botonEstrella);
    estrellasEntrada.appendChild(botonEstrella);
  }

  const botonEnviar = boton('Publicar reseña', { variante: 'primary' });
  const grupoEstrellas = el(
    'fieldset',
    { clase: 'resena-grupo-estrellas' },
    el('legend', { clase: 'campo-etiqueta', texto: 'Tu calificación' }),
    estrellasEntrada
  );
  const campoComentario = areaTexto({
    etiqueta: 'Comentario',
    nombre: 'comentario',
    filas: 4,
    placeholder: 'Cuéntanos cómo te fue con este producto.',
    requerido: true
  });
  const formulario = el(
    'form',
    { clase: 'resena-form' },
    el('h3', { clase: 'resena-form-titulo', texto: 'Deja tu reseña' }),
    el('p', {
      clase: 'texto-suave resena-form-ayuda',
      texto: 'Solo los clientes con un pedido entregado que incluya este producto pueden publicar una reseña.'
    }),
    grupoEstrellas,
    campoComentario,
    mensajes,
    botonEnviar
  );

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mensajes.replaceChildren();

    const comentario = String(
      formulario.elements.namedItem('comentario')?.value || ''
    ).trim();

    if (calificacion < 1) {
      mensajes.appendChild(alerta('Selecciona una calificación de 1 a 5 estrellas.', 'info'));
      return;
    }
    if (comentario.length < 5) {
      mensajes.appendChild(
        alerta('El comentario debe tener al menos 5 caracteres.', 'info')
      );
      return;
    }

    botonEnviar.disabled = true;
    try {
      await api.crear('/resenas', {
        producto_id: producto.id,
        calificacion,
        comentario
      });
      mensajes.appendChild(alerta('Gracias. Tu reseña fue publicada.', 'exito'));
      formulario.reset();
      calificacion = 0;
      botonesEstrella.forEach((nodo) => {
        nodo.classList.remove('activa');
        nodo.setAttribute('aria-pressed', 'false');
      });
      await alPublicar();
    } catch (error) {
      const esAviso = error && (error.estado === 403 || error.estado === 409);
      mensajes.appendChild(
        alerta(
          error && error.message
            ? error.message
            : 'No se pudo publicar la reseña. Intenta nuevamente.',
          esAviso ? 'info' : 'error'
        )
      );
    } finally {
      botonEnviar.disabled = false;
    }
  });

  contenedor.appendChild(formulario);
  return contenedor;
}

function crearPanelResenas(producto, { usuario, alActualizarValoracion }) {
  const resumenContenedor = el('div', { clase: 'resenas-resumen-contenedor' });
  const listaContenedor = el('div', { clase: 'resenas-lista-contenedor' });
  const formularioContenedor = el('div', { clase: 'resenas-formulario-contenedor' });

  const panel = el(
    'div',
    { clase: 'resenas-panel' },
    resumenContenedor,
    listaContenedor,
    formularioContenedor
  );

  const renderResumen = (resumen) => {
    const total = Number(resumen.total) || 0;
    const promedio = Number(resumen.promedio) || 0;
    const distribucion = resumen.distribucion || {};

    const filas = [5, 4, 3, 2, 1].map((valor) => {
      const cantidad = Number(distribucion[String(valor)] ?? distribucion[valor]) || 0;
      return el(
        'div',
        { clase: 'resena-distribucion-fila' },
        el('span', {
          clase: 'resena-distribucion-etiqueta',
          texto: `${valor} ${valor === 1 ? 'estrella' : 'estrellas'}`
        }),
        el('progress', {
          clase: 'resena-barra',
          max: total > 0 ? total : 1,
          value: cantidad,
          atributos: { 'aria-label': `${cantidad} reseñas de ${valor} estrellas` }
        }),
        el('span', {
          clase: 'resena-distribucion-cantidad',
          texto: String(cantidad)
        })
      );
    });

    resumenContenedor.replaceChildren(
      el(
        'div',
        { clase: 'resenas-resumen' },
        el(
          'div',
          { clase: 'resenas-puntaje' },
          el('p', {
            clase: 'resenas-promedio',
            texto: total > 0 ? promedio.toFixed(1) : '—'
          }),
          el('p', { clase: 'resenas-promedio-etiqueta', texto: 'de 5 estrellas' }),
          estrellas(promedio, 18),
          el('p', {
            clase: 'resenas-total',
            texto: `${total} ${total === 1 ? 'reseña' : 'reseñas'}`
          })
        ),
        el('div', { clase: 'resenas-distribucion' }, ...filas)
      )
    );

    alActualizarValoracion(resumen);
  };

  const renderLista = (resumen) => {
    const resenas = Array.isArray(resumen.resenas) ? resumen.resenas : [];
    if (resenas.length === 0) {
      listaContenedor.replaceChildren(
        estadoVacio('Este producto aún no tiene reseñas verificadas.')
      );
      return;
    }

    listaContenedor.replaceChildren(
      el('h3', { clase: 'resenas-lista-titulo', texto: 'Opiniones de clientes' }),
      ...resenas.map((resena) =>
        el(
          'article',
          { clase: 'resena' },
          el(
            'header',
            { clase: 'resena-cabecera' },
            el(
              'div',
              { clase: 'resena-autor-bloque' },
              el('p', {
                clase: 'resena-autor',
                texto: resena.autor || 'Cliente Nuba Beauty'
              }),
              el('p', {
                clase: 'resena-fecha',
                texto: formatearFechaCorta(resena.creadoEn)
              })
            ),
            estrellas(resena.calificacion, 14)
          ),
          resena.verificado
            ? el('span', { clase: 'resena-verificada', texto: 'Compra verificada' })
            : null,
          el('p', {
            clase: 'resena-comentario',
            texto: String(resena.comentario || '')
          })
        )
      )
    );
  };

  const cargarResenas = async ({ mostrarCargando = true } = {}) => {
    if (mostrarCargando) {
      resumenContenedor.replaceChildren(
        el('p', {
          clase: 'catalogo-cargando',
          atributos: { role: 'status' },
          texto: 'Cargando reseñas...'
        })
      );
      listaContenedor.replaceChildren();
    }

    try {
      const respuesta = await api.obtener(`/resenas/producto/${producto.id}`);
      const resumen = respuesta.datos || {};
      renderResumen(resumen);
      renderLista(resumen);
    } catch (error) {
      resumenContenedor.replaceChildren(
        el(
          'div',
          { clase: 'resenas-error' },
          alerta(
            error && error.message
              ? error.message
              : 'No se pudieron cargar las reseñas.'
          ),
          el(
            'button',
            {
              clase: 'btn btn-outline',
              atributos: { type: 'button' },
              on: { click: () => cargarResenas() }
            },
            el('span', { texto: 'Reintentar' })
          )
        )
      );
    }
  };

  formularioContenedor.appendChild(
    crearFormularioResena({
      producto,
      usuario,
      alPublicar: () => cargarResenas({ mostrarCargando: false })
    })
  );

  cargarResenas();

  return panel;
}

function crearPestanas(producto, { usuario, alActualizarValoracion }) {
  const definiciones = [
    {
      id: 'ingredientes',
      etiqueta: 'Ingredientes clave',
      contenido: el('p', {
        clase: 'ficha-panel-texto',
        texto: producto.ingredientes || 'Información de ingredientes no disponible.'
      })
    },
    {
      id: 'modo-uso',
      etiqueta: 'Modo de uso',
      contenido: el('p', {
        clase: 'ficha-panel-texto',
        texto: producto.modoUso || 'Información de uso no disponible.'
      })
    },
    {
      id: 'resenas',
      etiqueta: 'Reseñas',
      contenido: crearPanelResenas(producto, { usuario, alActualizarValoracion })
    }
  ];

  const lista = el('div', {
    clase: 'ficha-tabs-lista',
    role: 'tablist',
    atributos: { 'aria-label': 'Información del producto' }
  });
  const paneles = el('div', { clase: 'ficha-tabs-paneles' });
  const botones = [];
  const panelesNodos = [];
  let activo = 0;

  const activar = (indice) => {
    activo = indice;
    botones.forEach((botonTab, posicion) => {
      const esActivo = posicion === activo;
      botonTab.classList.toggle('activa', esActivo);
      botonTab.setAttribute('aria-selected', esActivo ? 'true' : 'false');
      botonTab.tabIndex = esActivo ? 0 : -1;
      panelesNodos[posicion].hidden = !esActivo;
    });
  };

  definiciones.forEach((definicion, indice) => {
    const botonTab = el('button', {
      clase: 'ficha-tab',
      id: `ficha-tab-${definicion.id}`,
      atributos: {
        type: 'button',
        role: 'tab',
        'aria-selected': indice === 0 ? 'true' : 'false',
        'aria-controls': `ficha-panel-${definicion.id}`,
        tabindex: indice === 0 ? '0' : '-1'
      },
      texto: definicion.etiqueta,
      on: { click: () => activar(indice) }
    });
    botones.push(botonTab);
    lista.appendChild(botonTab);

    const panel = el(
      'section',
      {
        clase: 'ficha-panel',
        id: `ficha-panel-${definicion.id}`,
        role: 'tabpanel',
        atributos: {
          'aria-labelledby': `ficha-tab-${definicion.id}`,
          tabindex: '0'
        }
      },
      definicion.contenido
    );
    panel.hidden = indice !== 0;
    panelesNodos.push(panel);
    paneles.appendChild(panel);
  });

  lista.addEventListener('keydown', (evento) => {
    const indiceActual = botones.indexOf(document.activeElement);
    if (indiceActual < 0) return;

    let siguiente = null;
    if (evento.key === 'ArrowRight') siguiente = (indiceActual + 1) % botones.length;
    if (evento.key === 'ArrowLeft') siguiente = (indiceActual - 1 + botones.length) % botones.length;
    if (evento.key === 'Home') siguiente = 0;
    if (evento.key === 'End') siguiente = botones.length - 1;
    if (siguiente === null) return;

    evento.preventDefault();
    botones[siguiente].focus();
    activar(siguiente);
  });

  return el('div', { clase: 'ficha-tabs' }, lista, paneles);
}

async function cargarRelacionados(seccion, producto, { router, usuario }) {
  if (!producto.categoriaSlug) return;

  try {
    const respuesta = await api.obtener(
      `/productos?categoria=${encodeURIComponent(String(producto.categoriaSlug))}&limite=${MAX_RELACIONADOS + 1}&orden=recientes`
    );
    const productos = (respuesta.datos.productos || [])
      .filter((relacionado) => Number(relacionado.id) !== Number(producto.id))
      .slice(0, MAX_RELACIONADOS);

    if (productos.length === 0) return;

    seccion.appendChild(
      el(
        'section',
        { clase: 'ficha-relacionados' },
        el('h2', { clase: 'ficha-relacionados-titulo', texto: 'También te puede interesar' }),
        el(
          'div',
          { clase: 'grilla-productos grilla-relacionados' },
          ...productos.map((relacionado) =>
            crearTarjetaProducto(relacionado, { router, usuario })
          )
        )
      )
    );
  } catch {
    // Los relacionados son un complemento: si fallan, la ficha sigue disponible.
  }
}

function vistaProductoNoEncontrado() {
  return el(
    'section',
    { clase: 'pagina ficha-no-encontrada' },
    el('h1', { texto: 'Producto no encontrado' }),
    el('p', {
      clase: 'texto-suave',
      texto: 'El producto que buscas no existe o ya no está disponible en el catálogo.'
    }),
    enlaceInterno('/catalogo', 'Ver catálogo', { clase: 'btn btn-primary' })
  );
}

function vistaErrorProducto({ router, slug }) {
  const seccion = el(
    'section',
    { clase: 'pagina' },
    el('h1', { texto: 'No pudimos cargar el producto' }),
    alerta('Revisa tu conexión e inténtalo nuevamente.')
  );

  seccion.appendChild(
    el(
      'div',
      { clase: 'ficha-error-acciones' },
      el(
        'button',
        {
          clase: 'btn btn-primary',
          atributos: { type: 'button' },
          on: {
            click: () =>
              router.navegar(`/producto/${encodeURIComponent(String(slug || ''))}`, {
                reemplazar: true
              })
          }
        },
        el('span', { texto: 'Reintentar' })
      ),
      enlaceInterno('/catalogo', 'Volver al catálogo', { clase: 'btn btn-outline' })
    )
  );

  return seccion;
}

export const vistaProducto = {
  async render({ params, router, usuario }) {
    const slug = params.slug || '';

    try {
      const respuesta = await api.obtener(`/productos/${encodeURIComponent(slug)}`);
      const producto = respuesta && respuesta.datos ? respuesta.datos.producto : null;

      if (!producto) {
        const error = new Error('Producto no encontrado');
        error.estado = 404;
        throw error;
      }

      const seccion = el('section', { clase: 'pagina ficha-pagina' });
      seccion.appendChild(crearMigas(producto));

      const info = crearInfoProducto(producto, { usuario });
      seccion.appendChild(
        el('div', { clase: 'ficha-producto' }, crearGaleria(producto), info.nodo)
      );
      seccion.appendChild(
        crearPestanas(producto, {
          usuario,
          alActualizarValoracion: info.actualizarValoracion
        })
      );

      cargarRelacionados(seccion, producto, { router, usuario });

      return seccion;
    } catch (error) {
      if (error && error.estado === 404) return vistaProductoNoEncontrado();
      return vistaErrorProducto({ router, slug });
    }
  }
};
