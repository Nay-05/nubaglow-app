/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: LOGIN INTERNO (/staff/login)
 * ============================================================================
 * Portal separado del login de clientes. No existe autorregistro: solo un
 * administrador crea cuentas internas. El backend valida el rol en BD.
 */

import { el } from '../../core/dom.js';
import { iniciarSesionStaff } from '../../core/sesion.js';
import { rutaInicioPorRol } from '../../core/permisos.js';
import { alerta, campo, boton, enlaceInterno } from '../comunes.js';

export const vistaLoginStaff = {
  async render({ router }) {
    const seccion = el(
      'section',
      { clase: 'formulario-auth' },
      el('h2', { clase: 'formulario-titulo', texto: 'Acceso del personal' }),
      el('p', {
        clase: 'texto-suave',
        texto: 'Portal interno de Nuba Beauty. Solo cuentas creadas por administracion.'
      })
    );

    const mensajes = el('div', { clase: 'mensajes' });
    const campoEmail = campo({
      etiqueta: 'Correo corporativo',
      nombre: 'email',
      tipo: 'email',
      autocomplete: 'username',
      placeholder: 'nombre@nubabeauty.bo'
    });
    const campoPassword = campo({
      etiqueta: 'Contrasena',
      nombre: 'password',
      tipo: 'password',
      autocomplete: 'current-password',
      placeholder: 'Tu contrasena'
    });

    const botonIngresar = boton('Ingresar al portal', { variante: 'primary' });

    const formulario = el(
      'form',
      { clase: 'formulario' },
      campoEmail,
      campoPassword,
      mensajes,
      botonIngresar
    );

    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      mensajes.replaceChildren();
      botonIngresar.disabled = true;

      const email = String(formulario.elements.namedItem('email')?.value || '').trim();
      const password = String(formulario.elements.namedItem('password')?.value || '');

      try {
        const usuario = await iniciarSesionStaff(email, password);
        router.navegar(rutaInicioPorRol(usuario.rol), { reemplazar: true });
      } catch (error) {
        mensajes.appendChild(
          alerta(
            error.estado === 403
              ? 'Esta cuenta no tiene acceso al portal interno.'
              : error.estado === 401
                ? 'Correo o contrasena incorrectos.'
                : error.message || 'No se pudo iniciar sesion. Intenta nuevamente.'
          )
        );
        botonIngresar.disabled = false;
      }
    });

    seccion.append(
      formulario,
      el(
        'p',
        { clase: 'formulario-pie' },
        enlaceInterno('/', 'Volver a la tienda', { clase: 'enlace' })
      )
    );

    return seccion;
  }
};
