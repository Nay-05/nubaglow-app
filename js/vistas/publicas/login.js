/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: LOGIN Y REGISTRO DE CLIENTES
 * ============================================================================
 * Pestañas de acceso y creación de cuenta en la misma tarjeta editorial.
 * El registro público siempre crea rol cliente desde el backend.
 */

import { el } from '../../core/dom.js';
import {
  destinoTrasLoginCliente,
  iniciarSesionCliente,
  registrarCliente
} from '../../core/sesion.js';
import { fusionarCarritoVisitante, guardarAvisoFusion } from '../../core/carrito.js';
import { alerta, boton, campo } from '../comunes.js';

function destinoSeguro(valor, respaldo) {
  if (typeof valor !== 'string') return respaldo;
  if (!valor.startsWith('/') || valor.startsWith('//')) return respaldo;
  return valor;
}

function normalizarCelular(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.startsWith('591') && digitos.length === 11) {
    return digitos.slice(3);
  }
  return digitos;
}

function crearCampoRegistro({
  etiqueta,
  nombre,
  tipo = 'text',
  placeholder = '',
  autocomplete
}) {
  const id = `registro-${nombre}`;
  const entrada = el('input', {
    clase: 'entrada',
    id,
    name: nombre,
    type: tipo,
    placeholder,
    atributos: autocomplete ? { autocomplete } : {}
  });
  const error = el('p', {
    clase: 'campo-error',
    atributos: { role: 'alert' }
  });
  error.hidden = true;

  const nodo = el(
    'div',
    { clase: 'campo' },
    el('label', {
      clase: 'campo-etiqueta',
      atributos: { for: id },
      texto: etiqueta
    }),
    entrada,
    error
  );

  return { nodo, entrada, error };
}

function marcarError(campoActual, mensaje) {
  campoActual.error.textContent = mensaje;
  campoActual.error.hidden = false;
  campoActual.entrada.setAttribute('aria-invalid', 'true');
}

function limpiarError(campoActual) {
  campoActual.error.textContent = '';
  campoActual.error.hidden = true;
  campoActual.entrada.removeAttribute('aria-invalid');
}

function crearRequisito(texto, prueba) {
  const item = el('li', { texto });
  return { item, prueba };
}

export const vistaLogin = {
  async render({ consulta, router }) {
    let tab = 'login';
    const modo = String(consulta.get('modo') || '').toLowerCase();
    const esRutaRegistro = window.location.pathname === '/registro';
    if (esRutaRegistro || modo === 'registro') tab = 'registro';

    const seccion = el('section', {
      clase: 'formulario-auth auth-login'
    });
    const tabs = el('div', {
      clase: 'auth-tabs',
      atributos: { role: 'tablist', 'aria-label': 'Acceso de clientes' }
    });
    const panelLogin = el('div', {
      clase: 'auth-panel',
      atributos: { role: 'tabpanel', 'aria-label': 'Iniciar sesión' }
    });
    const panelRegistro = el('div', {
      clase: 'auth-panel',
      atributos: { role: 'tabpanel', 'aria-label': 'Crear cuenta' }
    });

    async function finalizarEntrada(usuario) {
      try {
        const fusion = await fusionarCarritoVisitante(usuario);
        if (
          fusion.agregados > 0 ||
          fusion.ajustados > 0 ||
          fusion.noDisponibles > 0
        ) {
          guardarAvisoFusion(fusion);
        }
      } catch {
        guardarAvisoFusion({ error: true });
      }

      const respaldo = destinoTrasLoginCliente(usuario);
      const destino = destinoSeguro(consulta.get('redirigir'), respaldo);
      router.navegar(destino, { reemplazar: true });
    }

    function actualizarTabs() {
      const esRegistro = tab === 'registro';
      panelLogin.hidden = esRegistro;
      panelRegistro.hidden = !esRegistro;
      for (const control of tabs.querySelectorAll('.auth-tab')) {
        const activo = control.dataset.tab === tab;
        control.classList.toggle('activo', activo);
        control.setAttribute('aria-selected', activo ? 'true' : 'false');
        control.tabIndex = activo ? 0 : -1;
      }
    }

    function cambiarTab(nuevoTab) {
      tab = nuevoTab;
      actualizarTabs();
      const params = new URLSearchParams(consulta.toString());
      if (tab === 'registro') {
        params.set('modo', 'registro');
      } else {
        params.delete('modo');
      }
      const ruta = tab === 'registro' ? '/registro' : '/login';
      const query = params.toString();
      window.history.replaceState({}, '', query ? `${ruta}?${query}` : ruta);
      const primerCampo = tab === 'registro'
        ? panelRegistro.querySelector('input')
        : panelLogin.querySelector('input');
      if (primerCampo) primerCampo.focus();
    }

    function crearTab(etiqueta, valor) {
      const control = el('button', {
        clase: `auth-tab${tab === valor ? ' activo' : ''}`,
        atributos: {
          type: 'button',
          role: 'tab',
          'aria-selected': tab === valor ? 'true' : 'false'
        },
        texto: etiqueta
      });
      control.dataset.tab = valor;
      control.addEventListener('click', () => cambiarTab(valor));
      return control;
    }

    tabs.append(
      crearTab('Iniciar sesión', 'login'),
      crearTab('Crear cuenta', 'registro')
    );

    // ----------------------------------------------------------------- LOGIN
    const mensajesLogin = el('div', { clase: 'mensajes' });
    const campoEmail = campo({
      etiqueta: 'Correo electrónico',
      nombre: 'email',
      tipo: 'email',
      autocomplete: 'email',
      placeholder: 'nombre@correo.com'
    });
    const campoPassword = campo({
      etiqueta: 'Contraseña',
      nombre: 'password',
      tipo: 'password',
      autocomplete: 'current-password',
      placeholder: 'Tu contraseña'
    });
    const botonIngresar = boton('Ingresar', { variante: 'primary' });
    const formularioLogin = el(
      'form',
      { clase: 'formulario' },
      el('h2', { clase: 'formulario-titulo', texto: 'Iniciar sesión' }),
      el('p', {
        clase: 'texto-suave',
        texto: 'Accede para gestionar tu carrito, tus pedidos y tus reseñas.'
      }),
      campoEmail,
      campoPassword,
      mensajesLogin,
      botonIngresar
    );

    formularioLogin.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      mensajesLogin.replaceChildren();
      botonIngresar.disabled = true;

      const email = String(
        formularioLogin.elements.namedItem('email')?.value || ''
      ).trim();
      const password = String(
        formularioLogin.elements.namedItem('password')?.value || ''
      );

      try {
        const usuario = await iniciarSesionCliente(email, password);
        await finalizarEntrada(usuario);
      } catch (error) {
        mensajesLogin.appendChild(
          alerta(
            error.estado === 401
              ? 'Correo o contraseña incorrectos. Verifica tus datos.'
              : error.message || 'No se pudo iniciar sesión.'
          )
        );
        botonIngresar.disabled = false;
      }
    });

    // --------------------------------------------------------------- REGISTRO
    const mensajesRegistro = el('div', { clase: 'mensajes' });
    const campoNombre = crearCampoRegistro({
      etiqueta: 'Nombre completo',
      nombre: 'nombre',
      autocomplete: 'name',
      placeholder: 'Mariana Gómez'
    });
    const campoCorreo = crearCampoRegistro({
      etiqueta: 'Correo electrónico',
      nombre: 'email',
      tipo: 'email',
      autocomplete: 'email',
      placeholder: 'nombre@correo.com'
    });
    const campoCelular = crearCampoRegistro({
      etiqueta: 'Celular boliviano (opcional)',
      nombre: 'celular',
      tipo: 'tel',
      autocomplete: 'tel',
      placeholder: '72860307'
    });
    const campoClave = crearCampoRegistro({
      etiqueta: 'Contraseña',
      nombre: 'password',
      tipo: 'password',
      autocomplete: 'new-password',
      placeholder: 'Crea una contraseña'
    });
    const campoConfirmar = crearCampoRegistro({
      etiqueta: 'Confirmar contraseña',
      nombre: 'confirmar',
      tipo: 'password',
      autocomplete: 'new-password',
      placeholder: 'Repite la contraseña'
    });

    const requisitosBase = [
      crearRequisito('Mínimo 8 caracteres', (valor) => valor.length >= 8),
      crearRequisito('Al menos una letra mayúscula', (valor) =>
        /[A-Z]/.test(valor)
      ),
      crearRequisito('Al menos un número', (valor) => /[0-9]/.test(valor))
    ];
    const listaRequisitos = el(
      'ul',
      { clase: 'requisitos-password' },
      ...requisitosBase.map((requisito) => requisito.item)
    );

    function actualizarRequisitos() {
      const valor = campoClave.entrada.value;
      for (const requisito of requisitosBase) {
        requisito.item.classList.toggle(
          'cumple',
          requisito.prueba(valor)
        );
      }
    }

    function validarNombre() {
      const valor = campoNombre.entrada.value.trim();
      if (valor.length < 3) {
        marcarError(campoNombre, 'Ingresa al menos 3 caracteres.');
        return false;
      }
      limpiarError(campoNombre);
      return true;
    }

    function validarCorreo() {
      const valor = campoCorreo.entrada.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
        marcarError(campoCorreo, 'Ingresa un correo electrónico válido.');
        return false;
      }
      limpiarError(campoCorreo);
      return true;
    }

    function validarCelular() {
      const valor = normalizarCelular(campoCelular.entrada.value);
      if (valor && !/^[67]\d{7}$/.test(valor)) {
        marcarError(
          campoCelular,
          'Ingresa un celular boliviano válido, por ejemplo 72860307.'
        );
        return false;
      }
      limpiarError(campoCelular);
      return true;
    }

    function validarClave() {
      const valor = campoClave.entrada.value;
      const requisitosOk = requisitosBase.every((requisito) =>
        requisito.prueba(valor)
      );
      if (!requisitosOk) {
        marcarError(campoClave, 'La contraseña aún no cumple los requisitos.');
        return false;
      }
      limpiarError(campoClave);
      return true;
    }

    function validarConfirmacion() {
      const valor = campoConfirmar.entrada.value;
      if (!valor || valor !== campoClave.entrada.value) {
        marcarError(campoConfirmar, 'Las contraseñas no coinciden.');
        return false;
      }
      limpiarError(campoConfirmar);
      return true;
    }

    const validadores = [
      { campo: campoNombre, validar: validarNombre },
      { campo: campoCorreo, validar: validarCorreo },
      { campo: campoCelular, validar: validarCelular },
      { campo: campoClave, validar: validarClave },
      { campo: campoConfirmar, validar: validarConfirmacion }
    ];

    for (const { campo, validar } of validadores) {
      campo.entrada.addEventListener('blur', () => {
        campo.entrada.dataset.tocado = '1';
        validar();
      });
      campo.entrada.addEventListener('input', () => {
        if (campo.entrada.dataset.tocado) validar();
        if (campo === campoClave) actualizarRequisitos();
      });
    }

    const botonCrear = boton('Crear cuenta', {
      variante: 'primary',
      nombreIcono: 'cuenta'
    });
    const formularioRegistro = el(
      'form',
      { clase: 'formulario' },
      el('h2', { clase: 'formulario-titulo', texto: 'Crear cuenta' }),
      el('p', {
        clase: 'texto-suave',
        texto: 'Crea tu cuenta para guardar tu carrito y seguir tus pedidos.'
      }),
      campoNombre.nodo,
      campoCorreo.nodo,
      campoCelular.nodo,
      campoClave.nodo,
      listaRequisitos,
      campoConfirmar.nodo,
      mensajesRegistro,
      botonCrear
    );

    formularioRegistro.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      mensajesRegistro.replaceChildren();
      let valido = true;
      for (const { validar } of validadores) {
        if (!validar()) valido = false;
      }
      if (!valido) {
        const primerError = formularioRegistro.querySelector('[aria-invalid]');
        if (primerError) primerError.focus();
        return;
      }

      botonCrear.disabled = true;
      const textoBoton = botonCrear.querySelector('span');
      if (textoBoton) textoBoton.textContent = 'Creando cuenta...';

      try {
        const usuario = await registrarCliente({
          nombre: campoNombre.entrada.value.trim(),
          email: campoCorreo.entrada.value.trim(),
          celular: normalizarCelular(campoCelular.entrada.value) || undefined,
          password: campoClave.entrada.value
        });
        await finalizarEntrada(usuario);
      } catch (error) {
        if (error.estado === 409) {
          marcarError(
            campoCorreo,
            'Este correo ya está registrado. Inicia sesión.'
          );
        } else {
          mensajesRegistro.appendChild(
            alerta(
              error.message || 'No se pudo crear la cuenta. Intenta nuevamente.'
            )
          );
        }
        botonCrear.disabled = false;
        if (textoBoton) textoBoton.textContent = 'Crear cuenta';
      }
    });

    panelLogin.appendChild(formularioLogin);
    panelRegistro.appendChild(formularioRegistro);
    seccion.append(tabs, panelLogin, panelRegistro);
    actualizarTabs();
    return seccion;
  }
};
