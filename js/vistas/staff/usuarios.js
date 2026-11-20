/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: USUARIOS INTERNOS (/staff/usuarios)
 * ============================================================================
 * Alta, cambio de rol, activacion y restablecimiento de claves del personal.
 * El backend impide autodesactivarse y dejar al sistema sin administradores.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearFechaCorta } from '../../core/formato.js';
import { alerta, boton, estadoVacio } from '../comunes.js';
import {
  crearCeldaStaff,
  crearTablaStaff
} from './tablaResponsiva.js';

const ROLES = [
  { valor: 'vendedor', etiqueta: 'Vendedor' },
  { valor: 'almacen', etiqueta: 'Almacén' },
  { valor: 'logistica', etiqueta: 'Logística' },
  { valor: 'admin', etiqueta: 'Administrador' }
];

const COLUMNAS = [
  { etiqueta: 'Usuario' },
  { etiqueta: 'Rol' },
  { etiqueta: 'Estado' },
  { etiqueta: 'Creado' },
  { etiqueta: 'Acciones', clase: 'staff-col-acciones' }
];

function campoAdmin(etiqueta, control, clase = '') {
  return el(
    'label',
    { clase: `campo ${clase}`.trim() },
    el('span', { clase: 'campo-etiqueta', texto: etiqueta }),
    control
  );
}

function crearSelectRol(valor) {
  return el(
    'select',
    { clase: 'entrada entrada-compacta' },
    ...ROLES.map((rol) =>
      el('option', {
        value: rol.valor,
        texto: rol.etiqueta,
        selected: rol.valor === valor
      })
    )
  );
}

function badgeEstado(activo) {
  return el('span', {
    clase:
      'estado-badge ' +
      (activo ? 'admin-estado-activo' : 'admin-estado-inactivo'),
    texto: activo ? 'Activo' : 'Inactivo'
  });
}

export const vistaUsuarios = {
  async render({ usuario }) {
    const usuarioActual = usuario;
    let usuarios = [];

    const mensajes = el('div', { clase: 'admin-mensajes' });
    const tabla = el('div', { clase: 'admin-tabla' });
    const contenedorPassword = el('div');

    const nombre = el('input', {
      clase: 'entrada',
      type: 'text',
      placeholder: 'Nombre completo'
    });
    const email = el('input', {
      clase: 'entrada',
      type: 'email',
      placeholder: 'correo@nubaglow.bo'
    });
    const password = el('input', {
      clase: 'entrada',
      type: 'password',
      placeholder: 'Mínimo 8 caracteres, una mayúscula y un número',
      atributos: { autocomplete: 'new-password' }
    });
    const rol = crearSelectRol('vendedor');
    const crearBoton = boton('Crear cuenta', {
      tipo: 'submit',
      variante: 'primary',
      nombreIcono: 'usuarios'
    });
    const formularioAlta = el(
      'form',
      { clase: 'admin-formulario' },
      el(
        'div',
        { clase: 'admin-form-grid' },
        campoAdmin('Nombre', nombre),
        campoAdmin('Correo electrónico', email),
        campoAdmin('Contraseña inicial', password),
        campoAdmin('Rol', rol)
      ),
      crearBoton
    );

    const nuevaPassword = el('input', {
      clase: 'entrada',
      type: 'password',
      placeholder: 'Nueva contraseña',
      atributos: { autocomplete: 'new-password' }
    });
    const confirmarPassword = el('input', {
      clase: 'entrada',
      type: 'password',
      placeholder: 'Repite la nueva contraseña',
      atributos: { autocomplete: 'new-password' }
    });
    const guardarPassword = boton('Restablecer', {
      tipo: 'submit',
      variante: 'primary',
      nombreIcono: 'tarjeta'
    });
    const cancelarPassword = boton('Cancelar', {
      tipo: 'button',
      variante: 'outline'
    });
    const formularioPassword = el(
      'form',
      { clase: 'admin-formulario' },
      el(
        'div',
        { clase: 'admin-form-grid' },
        campoAdmin('Nueva contraseña', nuevaPassword),
        campoAdmin('Confirmar contraseña', confirmarPassword)
      ),
      el('div', { clase: 'admin-form-acciones' }, guardarPassword, cancelarPassword)
    );
    const panelPassword = el(
      'section',
      { clase: 'admin-panel admin-password-panel', hidden: true },
      el('h2', { clase: 'admin-panel-titulo', texto: 'Restablecer contraseña' }),
      el('p', { clase: 'texto-suave admin-password-usuario' }),
      formularioPassword
    );
    contenedorPassword.append(panelPassword);

    let usuarioPassword = null;

    function mostrarMensaje(texto, tipo = 'exito') {
      mensajes.replaceChildren(alerta(texto, tipo));
    }

    function abrirPassword(usuarioFila) {
      usuarioPassword = usuarioFila;
      panelPassword.hidden = false;
      const texto = panelPassword.querySelector('.admin-password-usuario');
      if (texto) {
        texto.textContent =
          `Cuenta de ${usuarioFila.nombre} (${usuarioFila.email}).`;
      }
      nuevaPassword.value = '';
      confirmarPassword.value = '';
      nuevaPassword.focus();
    }

    function cerrarPassword() {
      usuarioPassword = null;
      panelPassword.hidden = true;
      nuevaPassword.value = '';
      confirmarPassword.value = '';
    }

    function esUltimoAdmin(usuarioFila) {
      const activos = usuarios.filter(
        (item) => item.rol === 'admin' && item.activo
      );
      return (
        usuarioFila.rol === 'admin' &&
        usuarioFila.activo &&
        activos.length <= 1
      );
    }

    function crearFila(usuarioFila) {
      const selectRol = crearSelectRol(usuarioFila.rol);
      const guardarRol = boton('Guardar', {
        tipo: 'button',
        variante: 'outline',
        clase: 'btn-pequeno'
      });
      guardarRol.addEventListener('click', async () => {
        if (selectRol.value === usuarioFila.rol) {
          mostrarMensaje('El rol seleccionado no cambio.', 'info');
          return;
        }
        try {
          await api.actualizar(`/usuarios/${usuarioFila.id}`, {
            rol: selectRol.value
          });
          mostrarMensaje('Rol actualizado correctamente.');
          await cargar();
        } catch (error) {
          mostrarMensaje(error.message || 'No se pudo actualizar el rol.', 'error');
        }
      });

      const esPropia = usuarioFila.id === usuarioActual?.id;
      const bloqueoPropio = esPropia && usuarioFila.activo;
      const bloqueoUltimo = esUltimoAdmin(usuarioFila);
      const toggle = boton(
        usuarioFila.activo ? 'Desactivar' : 'Activar',
        {
          tipo: 'button',
          variante: usuarioFila.activo ? 'outline' : 'primary',
          clase: 'btn-pequeno'
        }
      );
      toggle.disabled = bloqueoPropio || bloqueoUltimo;
      if (bloqueoPropio) {
        toggle.title = 'No puedes desactivar tu propia cuenta';
      }
      if (bloqueoUltimo) {
        toggle.title = 'No puedes desactivar al ultimo administrador activo';
      }
      toggle.addEventListener('click', async () => {
        try {
          await api.actualizar(`/usuarios/${usuarioFila.id}`, {
            activo: !usuarioFila.activo
          });
          mostrarMensaje(
            usuarioFila.activo
              ? 'Acceso desactivado correctamente.'
              : 'Acceso activado correctamente.'
          );
          await cargar();
        } catch (error) {
          mostrarMensaje(
            error.message || 'No se pudo cambiar el acceso.',
            'error'
          );
        }
      });

      const restablecer = boton('Contraseña', {
        tipo: 'button',
        variante: 'outline',
        clase: 'btn-pequeno'
      });
      restablecer.addEventListener('click', () => abrirPassword(usuarioFila));

      return el(
        'tr',
        { clase: usuarioFila.activo ? '' : 'admin-fila-inactiva' },
        crearCeldaStaff(
          'Usuario',
          el(
            'div',
            { clase: 'admin-usuario-celda' },
            el('strong', { texto: usuarioFila.nombre }),
            el('span', { texto: usuarioFila.email })
          )
        ),
        crearCeldaStaff(
          'Rol',
          el('div', { clase: 'admin-rol-celda' }, selectRol, guardarRol),
          'admin-rol-col'
        ),
        crearCeldaStaff('Estado', badgeEstado(usuarioFila.activo)),
        crearCeldaStaff(
          'Creado',
          el('span', { texto: formatearFechaCorta(usuarioFila.creadoEn) })
        ),
        crearCeldaStaff(
          'Acciones',
          el(
            'div',
            { clase: 'admin-acciones-celda' },
            toggle,
            restablecer
          ),
          'staff-col-acciones'
        )
      );
    }

    function renderTabla() {
      if (usuarios.length === 0) {
        tabla.replaceChildren(
          estadoVacio('No hay cuentas internas registradas.')
        );
        return;
      }
      tabla.replaceChildren(
        crearTablaStaff(COLUMNAS, usuarios.map(crearFila))
      );
    }

    async function cargar() {
      tabla.replaceChildren(
        el('p', { clase: 'cargando', texto: 'Cargando usuarios...' })
      );
      try {
        const respuesta = await api.obtener('/usuarios');
        usuarios = respuesta?.datos?.usuarios || [];
        renderTabla();
      } catch (error) {
        tabla.replaceChildren();
        mostrarMensaje(
          error.message || 'No se pudieron cargar los usuarios.',
          'error'
        );
      }
    }

    formularioAlta.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      crearBoton.disabled = true;
      try {
        await api.crear('/usuarios', {
          nombre: nombre.value.trim(),
          email: email.value.trim(),
          password: password.value,
          rol: rol.value
        });
        formularioAlta.reset();
        rol.value = 'vendedor';
        mostrarMensaje('Cuenta interna creada correctamente.');
        await cargar();
      } catch (error) {
        mostrarMensaje(
          error.message || 'No se pudo crear la cuenta.',
          'error'
        );
      } finally {
        crearBoton.disabled = false;
      }
    });

    formularioPassword.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      if (!usuarioPassword) return;
      if (nuevaPassword.value !== confirmarPassword.value) {
        mostrarMensaje('Las contraseñas no coinciden.', 'error');
        confirmarPassword.focus();
        return;
      }
      guardarPassword.disabled = true;
      try {
        await api.parchear(`/usuarios/${usuarioPassword.id}/password`, {
          nueva_password: nuevaPassword.value
        });
        cerrarPassword();
        mostrarMensaje('Contraseña restablecida correctamente.');
      } catch (error) {
        mostrarMensaje(
          error.message || 'No se pudo restablecer la contraseña.',
          'error'
        );
      } finally {
        guardarPassword.disabled = false;
      }
    });

    cancelarPassword.addEventListener('click', cerrarPassword);

    const seccion = el(
      'section',
      { clase: 'pagina admin-usuarios' },
      el(
        'header',
        { clase: 'encabezado-pagina' },
        el('h1', { texto: 'Usuarios internos' }),
        el('p', {
          clase: 'texto-suave',
          texto:
            'Administra las cuentas del personal, sus roles y accesos.'
        })
      ),
      mensajes,
      el(
        'section',
        { clase: 'admin-panel' },
        el('h2', { clase: 'admin-panel-titulo', texto: 'Crear cuenta interna' }),
        el('p', {
          clase: 'texto-suave',
          texto:
            'Solo el administrador crea personal; no existe autorregistro.'
        }),
        formularioAlta
      ),
      contenedorPassword,
      el(
        'section',
        { clase: 'admin-panel' },
        el(
          'div',
          { clase: 'admin-panel-cabecera' },
          el(
            'div',
            {},
            el('h2', { clase: 'admin-panel-titulo', texto: 'Personal interno' }),
            el('p', {
              clase: 'texto-suave',
              texto:
                'Cambia roles, activa accesos o restablece contraseñas.'
            })
          )
        ),
        tabla
      )
    );

    await cargar();
    return seccion;
  }
};
