/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: GESTION DE PRODUCTOS (/staff/productos)
 * ============================================================================
 * CRUD de productos, variantes, categorias e imagenes. Todo cambio de precio
 * o estado queda auditado en el backend con usuario y valores anterior/nuevo.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs } from '../../core/formato.js';
import {
  alerta,
  boton,
  estadoVacio,
  imagenProducto,
  precioRango
} from '../comunes.js';
import {
  crearCeldaStaff,
  crearTablaStaff
} from './tablaResponsiva.js';
import {
  campoAdmin,
  campoAreaAdmin,
  campoCheckAdmin
} from './formularioAdmin.js';
import { crearGestorCategorias } from './categoriasAdmin.js';

const TIPOS_PIEL = ['Todo tipo', 'Seca', 'Grasa', 'Mixta', 'Sensible'];

const COLUMNAS_PRODUCTOS = [
  { etiqueta: 'Producto' },
  { etiqueta: 'Categoría' },
  { etiqueta: 'Precio', clase: 'staff-numero' },
  { etiqueta: 'Stock', clase: 'staff-numero' },
  { etiqueta: 'Estado' },
  { etiqueta: 'Acciones', clase: 'staff-col-acciones' }
];

function badgeEstado(activo) {
  return el('span', {
    clase:
      'estado-badge ' +
      (activo ? 'admin-estado-activo' : 'admin-estado-inactivo'),
    texto: activo ? 'Activo' : 'Inactivo'
  });
}

function crearEntrada({
  tipo = 'text',
  valor = '',
  placeholder = '',
  min,
  max,
  step
}) {
  return el('input', {
    clase: 'entrada',
    type: tipo,
    value: valor,
    placeholder,
    min,
    max,
    step
  });
}

function crearArea(valor = '', placeholder = '', filas = 3) {
  return el('textarea', {
    clase: 'entrada entrada-area',
    rows: filas,
    placeholder,
    value: valor
  });
}

function crearSelect(opciones, valor, etiquetaVacia = '') {
  const nodos = [];
  if (etiquetaVacia) {
    nodos.push(el('option', { value: '', texto: etiquetaVacia }));
  }
  for (const opcion of opciones) {
    nodos.push(
      el('option', {
        value: opcion.valor,
        texto: opcion.etiqueta,
        selected: String(opcion.valor) === String(valor)
      })
    );
  }
  return el('select', { clase: 'entrada' }, ...nodos);
}


async function subirArchivoImagen(productoId, archivo) {
  const tipo = archivo.type || (
    /\.png$/i.test(archivo.name)
      ? 'image/png'
      : /\.webp$/i.test(archivo.name)
        ? 'image/webp'
        : 'image/jpeg'
  );
  const enviar = () =>
    fetch(`/api/staff/productos/${productoId}/imagen`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': tipo },
      body: archivo
    });

  let respuesta = await enviar();
  if (respuesta.status === 401) {
    await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    respuesta = await enviar();
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }
  if (!respuesta.ok || !datos?.exito) {
    throw new Error(
      datos?.error || 'No se pudo subir la imagen del producto.'
    );
  }
  return datos.datos.imagen;
}

export const vistaProductos = {
  async render() {
    let categorias = [];
    let productos = [];
    let productoActual = null;
    let selectCategoriaActual = null;
    let timerBusqueda = null;

    const mensajes = el('div', { clase: 'admin-mensajes' });
    const lista = el('div', { clase: 'admin-tabla' });
    const editor = el('div', { clase: 'admin-editor' });
    const buscador = el('input', {
      clase: 'entrada',
      type: 'search',
      placeholder: 'Buscar producto, marca, categoría o SKU'
    });

    function mostrarMensaje(texto, tipo = 'exito') {
      mensajes.replaceChildren(alerta(texto, tipo));
    }

    async function cargarCategorias() {
      const respuesta = await api.obtener('/categorias');
      categorias = respuesta?.datos?.categorias || [];
      actualizarSelectCategorias();
    }

    function opcionesCategorias(seleccionada) {
      return categorias.map((categoria) => ({
        valor: String(categoria.id),
        etiqueta: categoria.nombre,
        seleccionada: String(categoria.id) === String(seleccionada)
      }));
    }

    function actualizarSelectCategorias() {
      if (!selectCategoriaActual) return;
      const valorActual = selectCategoriaActual.value;
      selectCategoriaActual.replaceChildren(
        ...opcionesCategorias(valorActual).map((opcion) =>
          el('option', {
            value: opcion.valor,
            texto: opcion.etiqueta,
            selected: opcion.seleccionada
          })
        )
      );
      if (
        categorias.some(
          (categoria) => String(categoria.id) === String(valorActual)
        )
      ) {
        selectCategoriaActual.value = valorActual;
      }
    }

    function crearSelectCategoria(seleccionada) {
      const opciones = opcionesCategorias(seleccionada);
      const select = el(
        'select',
        { clase: 'entrada' },
        ...opciones.map((opcion) =>
          el('option', {
            value: opcion.valor,
            texto: opcion.etiqueta,
            selected: opcion.seleccionada
          })
        )
      );
      selectCategoriaActual = select;
      return select;
    }

    async function eliminarProducto(producto) {
      const confirmado = window.confirm(
        `Eliminar o desactivar el producto "${producto.nombre}"?`
      );
      if (!confirmado) return;
      try {
        const respuesta = await api.eliminar(`/productos/${producto.id}`);
        mostrarMensaje(
          respuesta?.mensaje || 'Producto eliminado correctamente.'
        );
        if (productoActual && productoActual.id === producto.id) {
          productoActual = null;
          selectCategoriaActual = null;
          editor.replaceChildren();
        }
        await cargarProductos();
      } catch (error) {
        mostrarMensaje(
          error.message || 'No se pudo eliminar el producto.',
          'error'
        );
      }
    }

    function crearFilaProducto(producto) {
      const editar = boton('Editar', {
        tipo: 'button',
        variante: 'outline',
        clase: 'btn-pequeno'
      });
      editar.addEventListener('click', () => abrirProducto(producto.slug));
      const eliminar = boton('Eliminar', {
        tipo: 'button',
        variante: 'outline',
        clase: 'btn-pequeno'
      });
      eliminar.addEventListener('click', () => eliminarProducto(producto));

      return el(
        'tr',
        { clase: producto.activo ? '' : 'admin-fila-inactiva' },
        crearCeldaStaff(
          'Producto',
          el(
            'div',
            { clase: 'admin-producto-celda' },
            el('strong', { texto: producto.nombre }),
            el('span', {
              clase: 'texto-suave',
              texto: producto.marca || 'Sin marca'
            })
          )
        ),
        crearCeldaStaff(
          'Categoría',
          el('span', { texto: producto.categoriaNombre || 'Sin categoría' })
        ),
        crearCeldaStaff(
          'Precio',
          el('span', {
            texto: precioRango(producto.precioMin, producto.precioMax)
          }),
          'staff-numero'
        ),
        crearCeldaStaff(
          'Stock',
          el('span', { texto: String(producto.stockTotal ?? 0) }),
          'staff-numero'
        ),
        crearCeldaStaff('Estado', badgeEstado(producto.activo)),
        crearCeldaStaff(
          'Acciones',
          el('div', { clase: 'admin-acciones-celda' }, editar, eliminar),
          'staff-col-acciones'
        )
      );
    }

    function renderLista() {
      if (productos.length === 0) {
        lista.replaceChildren(
          estadoVacio('No encontramos productos con ese criterio.')
        );
        return;
      }
      lista.replaceChildren(
        crearTablaStaff(
          COLUMNAS_PRODUCTOS,
          productos.map(crearFilaProducto)
        )
      );
    }

    async function cargarProductos() {
      lista.replaceChildren(
        el('p', { clase: 'cargando', texto: 'Cargando productos...' })
      );
      try {
        const termino = encodeURIComponent(buscador.value.trim());
        const respuesta = await api.obtener(
          `/productos?todos=true&limite=50&orden=nombre_asc` +
            `&buscar=${termino}`
        );
        productos = respuesta?.datos?.productos || [];
        renderLista();
      } catch (error) {
        lista.replaceChildren();
        mostrarMensaje(
          error.message || 'No se pudieron cargar los productos.',
          'error'
        );
      }
    }

    function crearFormularioProducto(producto) {
      const esNuevo = !producto;
      const nombre = crearEntrada({
        valor: producto?.nombre || '',
        placeholder: 'Nombre del producto'
      });
      const slug = crearEntrada({
        valor: producto?.slug || '',
        placeholder: 'Slug opcional'
      });
      const marca = crearEntrada({
        valor: producto?.marca || 'NubaGlow',
        placeholder: 'Marca'
      });
      const tipoPiel = crearSelect(
        TIPOS_PIEL.map((tipo) => ({ valor: tipo, etiqueta: tipo })),
        producto?.tipoPiel || 'Todo tipo'
      );
      const categoria = crearSelectCategoria(producto?.categoriaId || '');
      const descripcion = crearArea(
        producto?.descripcion || '',
        'Descripción del producto'
      );
      const ingredientes = crearArea(
        producto?.ingredientes || '',
        'Ingredientes clave',
        2
      );
      const modoUso = crearArea(
        producto?.modoUso || '',
        'Modo de uso',
        2
      );
      const activo = el('input', {
        type: 'checkbox',
        checked: producto ? producto.activo : true
      });
      const archivoImagen = el('input', {
        clase: 'entrada',
        type: 'file',
        accept: 'image/jpeg,image/png,image/webp'
      });
      const vistaPrevia = el('img', {
        clase: 'imagen-producto',
        alt: 'Vista previa de la imagen seleccionada'
      });
      const contenedorPrevia = el(
        'div',
        { clase: 'admin-imagen-preview', hidden: true },
        vistaPrevia
      );
      let archivoSeleccionado = null;
      let urlPrevia = null;

      archivoImagen.addEventListener('change', () => {
        if (urlPrevia) URL.revokeObjectURL(urlPrevia);
        urlPrevia = null;
        const archivo = archivoImagen.files
          ? archivoImagen.files[0]
          : null;
        if (!archivo) {
          archivoSeleccionado = null;
          contenedorPrevia.hidden = true;
          return;
        }
        if (archivo.size > 3 * 1024 * 1024) {
          mostrarMensaje('La imagen no puede superar los 3 MB.', 'error');
          archivoImagen.value = '';
          archivoSeleccionado = null;
          contenedorPrevia.hidden = true;
          return;
        }
        const tipos = ['image/jpeg', 'image/png', 'image/webp'];
        const extensionValida = /\.(jpe?g|png|webp)$/i.test(archivo.name);
        if (!tipos.includes(archivo.type) && !extensionValida) {
          mostrarMensaje('Selecciona una imagen JPG, PNG o WEBP.', 'error');
          archivoImagen.value = '';
          archivoSeleccionado = null;
          contenedorPrevia.hidden = true;
          return;
        }
        archivoSeleccionado = archivo;
        urlPrevia = URL.createObjectURL(archivo);
        vistaPrevia.setAttribute('src', urlPrevia);
        contenedorPrevia.hidden = false;
      });
      const guardar = boton(esNuevo ? 'Crear producto' : 'Guardar cambios', {
        tipo: 'submit',
        variante: 'primary',
        nombreIcono: 'productos'
      });
      const cancelar = boton('Limpiar', {
        tipo: 'button',
        variante: 'outline'
      });
      cancelar.addEventListener('click', () => {
        if (urlPrevia) URL.revokeObjectURL(urlPrevia);
        if (esNuevo) {
          editor.replaceChildren();
          return;
        }
        renderEditor(producto);
      });

      const formulario = el(
        'form',
        { clase: 'admin-formulario' },
        el(
          'div',
          { clase: 'admin-form-grid' },
          campoAdmin('Nombre', nombre),
          campoAdmin('Slug', slug),
          campoAdmin('Marca', marca),
          campoAdmin('Tipo de piel', tipoPiel),
          campoAdmin('Categoría', categoria),
          campoCheckAdmin('Producto activo', activo),
          campoAreaAdmin('Descripción', descripcion, 'admin-col-completa'),
          campoAreaAdmin('Ingredientes', ingredientes, 'admin-col-completa'),
          campoAreaAdmin('Modo de uso', modoUso, 'admin-col-completa'),
          campoAdmin(
            'Imagen del producto (archivo)',
            archivoImagen,
            'admin-col-completa'
          ),
          el(
            'div',
            { clase: 'admin-upload-vista' },
            contenedorPrevia,
            el('p', {
              clase: 'texto-suave',
              texto: 'JPG, PNG o WEBP. M?ximo 3 MB. Se usar? como imagen principal.'
            })
          )
        ),
        el('div', { clase: 'admin-form-acciones' }, guardar, cancelar)
      );

      formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        guardar.disabled = true;
        try {
          const cuerpo = {
            categoria_id: Number(categoria.value),
            nombre: nombre.value.trim(),
            marca: marca.value.trim(),
            tipo_piel: tipoPiel.value,
            descripcion: descripcion.value.trim(),
            ingredientes: ingredientes.value.trim(),
            modo_uso: modoUso.value.trim(),
            activo: activo.checked
          };
          if (slug.value.trim()) cuerpo.slug = slug.value.trim();

          const respuesta = esNuevo
            ? await api.crear('/productos', cuerpo)
            : await api.actualizar(`/productos/${producto.id}`, cuerpo);
          const guardado = respuesta?.datos?.producto;
          if (!guardado) throw new Error('El producto no devolvio datos.');

          let productoFinal = guardado;
          let errorImagen = null;
          if (archivoSeleccionado) {
            try {
              await subirArchivoImagen(guardado.id, archivoSeleccionado);
              const detalle = await api.obtener(
                `/productos/${encodeURIComponent(guardado.slug)}`
              );
              productoFinal = detalle?.datos?.producto || guardado;
            } catch (error) {
              errorImagen = error;
            }
          }
          if (urlPrevia) URL.revokeObjectURL(urlPrevia);
          productoActual = productoFinal;
          renderEditor(productoFinal);
          if (errorImagen) {
            mostrarMensaje(
              'Producto guardado, pero la imagen no se pudo subir: ' +
                (errorImagen.message || 'error desconocido'),
              'error'
            );
          } else {
            mostrarMensaje(
              esNuevo
                ? 'Producto creado correctamente.'
                : 'Producto actualizado correctamente.'
            );
          }
          await cargarProductos();
        } catch (error) {
          mostrarMensaje(
            error.message || 'No se pudo guardar el producto.',
            'error'
          );
        } finally {
          guardar.disabled = false;
        }
      });

      return el(
        'section',
        { clase: 'admin-panel' },
        el('h2', {
          clase: 'admin-panel-titulo',
          texto: esNuevo ? 'Nuevo producto' : 'Datos del producto'
        }),
        formulario
      );
    }

    function crearFormularioVariante(producto, variante) {
      const esNueva = !variante;
      const sku = crearEntrada({
        valor: variante?.sku || '',
        placeholder: 'SKU único'
      });
      const nombre = crearEntrada({
        valor: variante?.nombre || '',
        placeholder: 'Tono o presentación'
      });
      const precio = crearEntrada({
        tipo: 'number',
        valor: variante ? String(variante.precio) : '',
        placeholder: '0.00',
        min: '0',
        step: '0.01'
      });
      const stock = crearEntrada({
        tipo: 'number',
        valor: variante ? String(variante.stock) : '0',
        min: '0',
        step: '1'
      });
      const reorden = crearEntrada({
        tipo: 'number',
        valor: variante ? String(variante.puntoReorden) : '5',
        min: '0',
        step: '1'
      });
      const activo = el('input', {
        type: 'checkbox',
        checked: variante ? variante.activo : true
      });
      const guardar = boton(esNueva ? 'Agregar variante' : 'Guardar', {
        tipo: 'submit',
        variante: 'primary',
        clase: 'btn-pequeno'
      });
      const formulario = el(
        'form',
        { clase: 'admin-formulario admin-variante-form' },
        el(
          'div',
          { clase: 'admin-form-grid' },
          campoAdmin('SKU', sku),
          campoAdmin('Nombre', nombre),
          campoAdmin('Precio (Bs.)', precio),
          campoAdmin('Stock', stock),
          campoAdmin('Punto de reorden', reorden),
          campoCheckAdmin('Variante activa', activo)
        ),
        el('div', { clase: 'admin-form-acciones' }, guardar)
      );

      if (!esNueva) {
        const eliminar = boton('Eliminar', {
          tipo: 'button',
          variante: 'outline',
          clase: 'btn-pequeno'
        });
        eliminar.addEventListener('click', async () => {
          const confirmado = window.confirm(
            `Eliminar la variante "${variante.nombre}"?`
          );
          if (!confirmado) return;
          try {
            await api.eliminar(`/variantes/${variante.id}`);
            mostrarMensaje('Variante eliminada correctamente.');
            await recargarProductoActual();
          } catch (error) {
            mostrarMensaje(
              error.message || 'No se pudo eliminar la variante.',
              'error'
            );
          }
        });
        formulario
          .querySelector('.admin-form-acciones')
          .appendChild(eliminar);
      }

      formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        guardar.disabled = true;
        try {
          const cuerpo = {
            sku: sku.value.trim(),
            nombre: nombre.value.trim(),
            precio: Number(precio.value),
            stock: Number(stock.value),
            punto_reorden: Number(reorden.value),
            activo: activo.checked
          };
          if (esNueva) {
            await api.crear(
              `/productos/${producto.id}/variantes`,
              cuerpo
            );
            mostrarMensaje('Variante creada correctamente.');
          } else {
            await api.actualizar(`/variantes/${variante.id}`, cuerpo);
            mostrarMensaje('Variante actualizada correctamente.');
          }
          await recargarProductoActual();
        } catch (error) {
          mostrarMensaje(
            error.message || 'No se pudo guardar la variante.',
            'error'
          );
        } finally {
          guardar.disabled = false;
        }
      });

      return formulario;
    }

    function crearFormularioImagen(producto, imagen) {
      const esNueva = !imagen;
      const url = crearEntrada({
        valor: imagen?.url || '',
        placeholder: '/assets/... o https://...'
      });
      const orden = crearEntrada({
        tipo: 'number',
        valor: imagen ? String(imagen.orden) : '0',
        min: '0',
        step: '1'
      });
      const principal = el('input', {
        type: 'checkbox',
        checked: imagen ? imagen.esPrincipal : false
      });
      const guardar = boton(esNueva ? 'Agregar imagen' : 'Guardar', {
        tipo: 'submit',
        variante: 'primary',
        clase: 'btn-pequeno'
      });
      const preview = imagen
        ? el(
            'div',
            { clase: 'admin-imagen-preview' },
            imagenProducto(imagen.url, producto.nombre)
          )
        : null;
      const formulario = el(
        'form',
        { clase: 'admin-formulario admin-imagen-form' },
        preview,
        el(
          'div',
          { clase: 'admin-form-grid' },
          campoAdmin('URL de la imagen', url, 'admin-col-completa'),
          campoAdmin('Orden', orden),
          campoCheckAdmin('Imagen principal', principal)
        ),
        el('div', { clase: 'admin-form-acciones' }, guardar)
      );

      if (!esNueva) {
        const eliminar = boton('Eliminar', {
          tipo: 'button',
          variante: 'outline',
          clase: 'btn-pequeno'
        });
        eliminar.addEventListener('click', async () => {
          const confirmado = window.confirm('Eliminar esta imagen?');
          if (!confirmado) return;
          try {
            await api.eliminar(
              `/productos/${producto.id}/imagenes/${imagen.id}`
            );
            mostrarMensaje('Imagen eliminada correctamente.');
            await recargarProductoActual();
          } catch (error) {
            mostrarMensaje(
              error.message || 'No se pudo eliminar la imagen.',
              'error'
            );
          }
        });
        formulario
          .querySelector('.admin-form-acciones')
          .appendChild(eliminar);
      }

      formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        guardar.disabled = true;
        try {
          const cuerpo = {
            url: url.value.trim(),
            orden: Number(orden.value),
            es_principal: principal.checked
          };
          if (esNueva) {
            await api.crear(
              `/productos/${producto.id}/imagenes`,
              cuerpo
            );
            mostrarMensaje('Imagen agregada correctamente.');
          } else {
            await api.actualizar(
              `/productos/${producto.id}/imagenes/${imagen.id}`,
              cuerpo
            );
            mostrarMensaje('Imagen actualizada correctamente.');
          }
          await recargarProductoActual();
        } catch (error) {
          mostrarMensaje(
            error.message || 'No se pudo guardar la imagen.',
            'error'
          );
        } finally {
          guardar.disabled = false;
        }
      });

      return formulario;
    }

    function renderEditor(producto) {
      productoActual = producto;
      const variantes = producto.variantes || [];
      const imagenes = producto.imagenes || [];
      const panelVariantes = el(
        'section',
        { clase: 'admin-panel' },
        el('h2', { clase: 'admin-panel-titulo', texto: 'Variantes' }),
        el('p', {
          clase: 'texto-suave',
          texto: 'SKU, precio, stock y punto de reorden por presentacion.'
        }),
        ...variantes.map((variante) =>
          el(
            'article',
            { clase: 'admin-variante-card' },
            crearFormularioVariante(producto, variante)
          )
        ),
        el('h3', { clase: 'admin-subtitulo', texto: 'Nueva variante' }),
        crearFormularioVariante(producto)
      );
      const panelImagenes = el(
        'section',
        { clase: 'admin-panel' },
        el('h2', { clase: 'admin-panel-titulo', texto: 'Imágenes' }),
        el('p', {
          clase: 'texto-suave',
          texto: 'La imagen principal se muestra en el catálogo.'
        }),
        ...imagenes.map((imagen) =>
          el(
            'article',
            { clase: 'admin-imagen-card' },
            crearFormularioImagen(producto, imagen)
          )
        ),
        el('h3', { clase: 'admin-subtitulo', texto: 'Nueva imagen' }),
        crearFormularioImagen(producto)
      );

      editor.replaceChildren(
        crearFormularioProducto(producto),
        panelVariantes,
        panelImagenes
      );
      editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderEditorNuevo() {
      productoActual = null;
      selectCategoriaActual = null;
      editor.replaceChildren(crearFormularioProducto(null));
      editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function abrirProducto(slug) {
      try {
        const respuesta = await api.obtener(
          `/productos/${encodeURIComponent(slug)}`
        );
        const producto = respuesta?.datos?.producto;
        if (!producto) throw new Error('Producto no encontrado.');
        renderEditor(producto);
      } catch (error) {
        mostrarMensaje(
          error.message || 'No se pudo cargar el producto.',
          'error'
        );
      }
    }

    async function recargarProductoActual() {
      if (!productoActual) return;
      try {
        const respuesta = await api.obtener(
          `/productos/${encodeURIComponent(productoActual.slug)}`
        );
        const producto = respuesta?.datos?.producto;
        if (!producto) return;
        renderEditor(producto);
        await cargarProductos();
      } catch (error) {
        mostrarMensaje(
          error.message || 'No se pudo actualizar el producto.',
          'error'
        );
      }
    }

    const nuevo = boton('Nuevo producto', {
      tipo: 'button',
      variante: 'primary',
      nombreIcono: 'mas'
    });
    nuevo.addEventListener('click', renderEditorNuevo);

    buscador.addEventListener('input', () => {
      if (timerBusqueda) clearTimeout(timerBusqueda);
      timerBusqueda = setTimeout(() => cargarProductos(), 250);
    });

    const gestorCategorias = await crearGestorCategorias({
      onCambio: async () => {
        await cargarCategorias();
        await cargarProductos();
      }
    });

    const seccion = el(
      'section',
      { clase: 'pagina admin-productos' },
      el(
        'header',
        { clase: 'encabezado-pagina' },
        el('h1', { texto: 'Gestión de productos' }),
        el('p', {
          clase: 'texto-suave',
          texto:
            'Catálogo, variantes, precios, stock, categorías e imágenes.'
        })
      ),
      mensajes,
      el(
        'section',
        { clase: 'admin-panel' },
        el(
          'div',
          { clase: 'admin-panel-cabecera' },
          el(
            'div',
            {},
            el('h2', { clase: 'admin-panel-titulo', texto: 'Catálogo' }),
            el('p', {
              clase: 'texto-suave',
              texto: 'Incluye productos activos e inactivos.'
            })
          ),
          nuevo
        ),
        buscador,
        lista
      ),
      editor,
      gestorCategorias
    );

    await cargarCategorias();
    await cargarProductos();
    return seccion;
  }
};
