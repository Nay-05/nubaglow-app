/**
 * ============================================================================
 * NUBAGLOW APP - ROUTER SPA EN JAVASCRIPT VANILLA
 * ============================================================================
 * Cumple con CLAUDE.md Seccion 4:
 * - Cada navegacion actualiza la URL con window.history.pushState (sin recargar).
 * - window.onpopstate re-renderiza para que Atras/Adelante funcionen.
 * - Soporta parametros dinamicos (/producto/:slug) y query string.
 * - Las guardas son solo UX: el backend valida permisos en cada endpoint.
 *
 * Contrato de vista: { async render(contexto) -> Node }
 * contexto = { params, consulta, router, usuario, opciones }
 * La vista puede ser el objeto directamente o un cargador () => import(...):
 * así un error en una pantalla no deja en blanco todo el sitio.
 */

import { el, texto } from '../core/dom.js';

function escaparSegmento(segmento) {
  return segmento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilarPatron(patron) {
  const claves = [];
  const segmentos = patron.split('/').filter(Boolean);

  const partes = segmentos.map((segmento) => {
    if (segmento === '*') {
      claves.push('comodin');
      return '(.*)';
    }
    if (segmento.startsWith(':')) {
      claves.push(segmento.slice(1));
      return '([^/]+)';
    }
    return escaparSegmento(segmento);
  });

  const fuente = partes.length === 0 ? '^/$' : `^/${partes.join('/')}/?$`;
  return { regex: new RegExp(fuente), claves };
}

function decodificar(valor) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

export class Router {
  constructor(contenedor, { crearDiseno, obtenerUsuario } = {}) {
    this.contenedor = contenedor;
    this.crearDiseno = typeof crearDiseno === 'function' ? crearDiseno : null;
    this.obtenerUsuario = typeof obtenerUsuario === 'function' ? obtenerUsuario : () => null;
    this.rutas = [];
    this.noEncontrada = null;
    this.navegacionActual = 0;
    this.iniciado = false;
  }

  registrar(patron, vista, opciones = {}) {
    const { regex, claves } = compilarPatron(patron);
    this.rutas.push({ patron, regex, claves, vista, opciones });
    return this;
  }

  registrarNoEncontrada(vista, opciones = {}) {
    this.noEncontrada = { vista, opciones };
    return this;
  }

  buscar(ruta) {
    for (const item of this.rutas) {
      const coincidencia = item.regex.exec(ruta);
      if (!coincidencia) continue;
      const params = {};
      item.claves.forEach((clave, indice) => {
        params[clave] = decodificar(coincidencia[indice + 1] || '');
      });
      return { item, params };
    }
    return null;
  }

  rutaActual() {
    return window.location.pathname + window.location.search;
  }

  async iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;

    window.addEventListener('popstate', () => {
      this.resolver(this.rutaActual(), { historial: true });
    });

    document.addEventListener('click', (evento) => this.interceptarEnlace(evento));

    await this.resolver(this.rutaActual(), { historial: true });
  }

  interceptarEnlace(evento) {
    if (evento.defaultPrevented || evento.button !== 0) return;
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;

    const enlace = evento.target.closest ? evento.target.closest('a[data-ruta]') : null;
    if (!enlace) return;
    if (enlace.target === '_blank' || enlace.hasAttribute('download')) return;

    const url = new URL(enlace.href, window.location.origin);
    if (url.origin !== window.location.origin) return;

    evento.preventDefault();
    this.navegar(url.pathname + url.search);
  }

  navegar(destino, { reemplazar = false } = {}) {
    const url = new URL(destino, window.location.origin);
    if (url.origin !== window.location.origin) return Promise.resolve(false);

    const objetivo = url.pathname + url.search;
    if (objetivo !== this.rutaActual()) {
      if (reemplazar) {
        window.history.replaceState({}, '', objetivo);
      } else {
        window.history.pushState({}, '', objetivo);
      }
    }

    return this.resolver(objetivo, { historial: false });
  }

  async resolver(destino, { historial = false } = {}) {
    const url = new URL(destino, window.location.origin);
    const turno = ++this.navegacionActual;

    const coincidencia = this.buscar(url.pathname);
    const item = coincidencia ? coincidencia.item : this.noEncontrada;
    const opciones = item ? item.opciones : {};
    const params = coincidencia ? coincidencia.params : {};
    const consulta = url.searchParams;

    document.title = opciones.titulo ? `${opciones.titulo} | NubaGlow` : 'NubaGlow';

    if (item && typeof opciones.acceso === 'function') {
      const destinoGuardado = opciones.acceso(this.obtenerUsuario(), {
        params,
        consulta,
        ruta: url.pathname
      });
      if (destinoGuardado) {
        const urlDestino = new URL(destinoGuardado, window.location.origin);
        const objetivo = urlDestino.pathname + urlDestino.search;
        if (objetivo !== url.pathname + url.search) {
          window.history.replaceState({}, '', objetivo);
          return this.resolver(objetivo, { historial: false });
        }
      }
    }

    const diseno = opciones.diseno || 'publico';
    const contextoDiseno = {
      usuario: this.obtenerUsuario(),
      ruta: url.pathname,
      router: this,
      params,
      titulo: opciones.titulo
    };

    this.contenedor.replaceChildren(
      el('div', { clase: 'cargando', atributos: { role: 'status' } }, 'Cargando...')
    );

    try {
      let vista = item ? item.vista : null;
      if (!vista) throw new Error('Ruta no encontrada');

      // Carga diferida dentro del try/catch: si este módulo tiene un error de
      // sintaxis o de ejecución, solo falla esta pantalla y se muestra el
      // mensaje de error en lugar de dejar todo el sitio en blanco.
      if (typeof vista === 'function') {
        const moduloCargado = await vista();
        vista = moduloCargado && moduloCargado.default
          ? moduloCargado.default
          : moduloCargado;
      }

      if (!vista || typeof vista.render !== 'function') {
        throw new Error('El módulo de la vista no expone render()');
      }

      const contenido = await vista.render({
        params,
        consulta,
        router: this,
        usuario: contextoDiseno.usuario,
        opciones
      });

      if (turno !== this.navegacionActual) return;

      const disenoRender = this.crearDiseno
        ? this.crearDiseno(diseno, contextoDiseno)
        : { raiz: el('div', { clase: 'app' }), contenido: el('main', { clase: 'contenido' }) };

      disenoRender.contenido.appendChild(contenido);
      this.contenedor.replaceChildren(disenoRender.raiz);

      if (!historial) window.scrollTo(0, 0);
    } catch (error) {
      if (turno !== this.navegacionActual) return;
      console.error('Error al renderizar la vista:', error);
      this.contenedor.replaceChildren(this.crearError(diseno, contextoDiseno, error));
    }
  }

  crearError(diseno, contextoDiseno, error) {
    const mensaje =
      error && error.estado === 404
        ? 'La página solicitada no existe.'
        : 'No se pudo cargar esta sección. Intenta nuevamente.';

    const contenido = el(
      'section',
      { clase: 'pagina' },
      el('h1', { texto: 'Ocurrió un problema' }),
      el('p', { clase: 'texto-suave', texto: mensaje }),
      el(
        'a',
        { clase: 'btn btn-primary', href: '/', atributos: { 'data-ruta': '' } },
        el('span', { texto: 'Volver al inicio' })
      )
    );

    if (!this.crearDiseno) {
      return el('div', { clase: 'app' }, contenido);
    }

    try {
      const disenoRender = this.crearDiseno(diseno, contextoDiseno);
      disenoRender.contenido.appendChild(contenido);
      return disenoRender.raiz;
    } catch {
      return el('div', { clase: 'app' }, contenido, texto(''));
    }
  }
}
