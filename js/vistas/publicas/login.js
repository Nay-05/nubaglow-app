/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: LOGIN DE CLIENTES (/login)
 * ============================================================================
 * Sin atajos de credenciales ni autocompletado forzado (CLAUDE.md Seccion 9).
 * El backend valida la contrasena con bcrypt y emite cookies HttpOnly.
 */

import { el } from '../../core/dom.js';
import { iniciarSesionCliente, destinoTrasLoginCliente } from '../../core/sesion.js';
import { alerta, campo, boton } from '../comunes.js';

function destinoSeguro(valor, respaldo) {
  if (typeof valor !== 'string') return respaldo;
  if (!valor.startsWith('/') || valor.startsWith('//')) return respaldo;
  return valor;
}

export const vistaLogin = {
  async render({ consulta, router }) {
    const seccion = el(
      'section',
      { clase: 'formulario-auth' },
      el('h2', { clase: 'formulario-titulo', texto: 'Iniciar sesion' }),
      el('p', {
        clase: 'texto-suave',
        texto: 'Accede para gestionar tu carrito, tus pedidos y tus resenas verificadas.'
      })
    );

    const mensajes = el('div', { clase: 'mensajes' });
    const campoEmail = campo({
      etiqueta: 'Correo electronico',
      nombre: 'email',
      tipo: 'email',
      autocomplete: 'email',
      placeholder: 'nombre@correo.com'
    });
    const campoPassword = campo({
      etiqueta: 'Contrasena',
      nombre: 'password',
      tipo: 'password',
      autocomplete: 'current-password',
      placeholder: 'Tu contrasena'
    });

    const botonIngresar = boton('Ingresar', { variante: 'primary' });

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
        const usuario = await iniciarSesionCliente(email, password);
        const respaldo = destinoTrasLoginCliente(usuario);
        const destino = destinoSeguro(consulta.get('redirigir'), respaldo);
        router.navegar(destino, { reemplazar: true });
      } catch (error) {
        mensajes.appendChild(
          alerta(
            error.estado === 401
              ? 'Correo o contrasena incorrectos. Verifica tus datos.'
              : error.message || 'No se pudo iniciar sesion. Intenta nuevamente.'
          )
        );
        botonIngresar.disabled = false;
      }
    });

    seccion.appendChild(formulario);
    return seccion;
  }
};
