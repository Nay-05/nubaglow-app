/**
 * ============================================================================
 * NUBAGLOW APP - GESTOR DE CATEGORIAS DEL ADMINISTRADOR
 * ============================================================================
 */

import { el } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { alerta, boton, estadoVacio } from '../comunes.js';
import {
  crearCeldaStaff,
  crearTablaStaff
} from './tablaResponsiva.js';
import { campoAdmin } from './formularioAdmin.js';

const COLUMNAS = [
  { etiqueta: 'Categoría' },
  { etiqueta: 'Slug' },
  { etiqueta: 'Productos', clase: 'staff-numero' },
  { etiqueta: 'Acciones', clase: 'staff-col-acciones' }
];

export async function crearGestorCategorias({ onCambio } = {}) {
  let categorias = [];
  let editandoId = null;

  const mensajes = el('div', { clase: 'admin-mensajes' });
  const tabla = el('div', { clase: 'admin-tabla' });
  const nombre = el('input', {
    clase: 'entrada',
    type: 'text',
    placeholder: 'Nombre de la categoría'
  });
  const slug = el('input', {
    clase: 'entrada',
    type: 'text',
    placeholder: 'Opcional: se genera desde el nombre'
  });
  const descripcion = el('textarea', {
    clase: 'entrada entrada-area',
    rows: 2,
    placeholder: 'Descripción breve'
  });
  const tituloFormulario = el('h3', {
    clase: 'admin-subtitulo',
    texto: 'Nueva categoría'
  });
  const guardar = boton('Crear categoría', {
    tipo: 'submit',
    variante: 'primary',
    nombreIcono: 'productos'
  });
  const cancelar = boton('Cancelar edición', {
    tipo: 'button',
    variante: 'outline'
  });
  cancelar.hidden = true;

  const formulario = el(
    'form',
    { clase: 'admin-formulario' },
    tituloFormulario,
    el(
      'div',
      { clase: 'admin-form-grid' },
      campoAdmin('Nombre', nombre),
      campoAdmin('Slug', slug),
      campoAdmin('Descripción', descripcion, 'admin-col-completa')
    ),
    el('div', { clase: 'admin-form-acciones' }, guardar, cancelar)
  );

  function mostrarMensaje(texto, tipo = 'exito') {
    mensajes.replaceChildren(alerta(texto, tipo));
  }

  function limpiarFormulario() {
    editandoId = null;
    formulario.reset();
    tituloFormulario.textContent = 'Nueva categoría';
    guardar.querySelector('span').textContent = 'Crear categoría';
    cancelar.hidden = true;
  }

  function editarCategoria(categoria) {
    editandoId = categoria.id;
    nombre.value = categoria.nombre;
    slug.value = categoria.slug;
    descripcion.value = categoria.descripcion || '';
    tituloFormulario.textContent = 'Editar categoría';
    guardar.querySelector('span').textContent = 'Guardar cambios';
    cancelar.hidden = false;
    nombre.focus();
  }

  async function eliminarCategoria(categoria) {
    const confirmado = window.confirm(
      `¿Eliminar la categoría "${categoria.nombre}"?`
    );
    if (!confirmado) return;
    try {
      await api.eliminar(`/categorias/${categoria.id}`);
      mostrarMensaje('Categoría eliminada correctamente.');
      await cargar();
      if (onCambio) await onCambio();
    } catch (error) {
      mostrarMensaje(
        error.message || 'No se pudo eliminar la categoría.',
        'error'
      );
    }
  }

  function crearFila(categoria) {
    const editar = boton('Editar', {
      tipo: 'button',
      variante: 'outline',
      clase: 'btn-pequeno'
    });
    editar.addEventListener('click', () => editarCategoria(categoria));
    const eliminar = boton('Eliminar', {
      tipo: 'button',
      variante: 'outline',
      clase: 'btn-pequeno'
    });
    eliminar.addEventListener('click', () => eliminarCategoria(categoria));

    return el(
      'tr',
      {},
      crearCeldaStaff(
        'Categoría',
        el('strong', { texto: categoria.nombre })
      ),
      crearCeldaStaff('Slug', el('span', { clase: 'staff-sku', texto: categoria.slug })),
      crearCeldaStaff(
        'Productos',
        el('span', { texto: String(categoria.totalProductos ?? 0) }),
        'staff-numero'
      ),
      crearCeldaStaff(
        'Acciones',
        el('div', { clase: 'admin-acciones-celda' }, editar, eliminar),
        'staff-col-acciones'
      )
    );
  }

  function renderTabla() {
    if (categorias.length === 0) {
      tabla.replaceChildren(estadoVacio('No hay categorías registradas.'));
      return;
    }
    tabla.replaceChildren(
      crearTablaStaff(COLUMNAS, categorias.map(crearFila))
    );
  }

  async function cargar() {
    tabla.replaceChildren(
      el('p', { clase: 'cargando', texto: 'Cargando categorías...' })
    );
    try {
      const respuesta = await api.obtener('/categorias');
      categorias = respuesta?.datos?.categorias || [];
      renderTabla();
    } catch (error) {
      tabla.replaceChildren();
      mostrarMensaje(
        error.message || 'No se pudieron cargar las categorías.',
        'error'
      );
    }
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    guardar.disabled = true;
    try {
      const cuerpo = {
        nombre: nombre.value.trim(),
        slug: slug.value.trim() || undefined,
        descripcion: descripcion.value.trim() || undefined
      };
      if (editandoId) {
        await api.actualizar(`/categorias/${editandoId}`, cuerpo);
        mostrarMensaje('Categoría actualizada correctamente.');
      } else {
        await api.crear('/categorias', cuerpo);
        mostrarMensaje('Categoría creada correctamente.');
      }
      limpiarFormulario();
      await cargar();
      if (onCambio) await onCambio();
    } catch (error) {
      mostrarMensaje(
        error.message || 'No se pudo guardar la categoría.',
        'error'
      );
    } finally {
      guardar.disabled = false;
    }
  });

  cancelar.addEventListener('click', limpiarFormulario);

  const seccion = el(
    'section',
    { clase: 'admin-panel' },
    el('h2', { clase: 'admin-panel-titulo', texto: 'Categorías' }),
    el('p', {
      clase: 'texto-suave',
      texto: 'Organiza el catálogo y evita eliminar categorías con productos.'
    }),
    mensajes,
    formulario,
    tabla
  );

  await cargar();
  return seccion;
}
