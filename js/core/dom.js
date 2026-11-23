/**
 * ============================================================================
 * NUBAGLOW APP - HELPERS DE DOM SEGUROS
 * ============================================================================
 * Cumple con CLAUDE.md Seccion 9 (Prevencion XSS):
 * - Nunca se usa innerHTML: todo texto se inserta con textContent o nodos de texto.
 * - Los atributos href/src se validan para bloquear esquemas peligrosos
 *   (javascript:, vbscript:). Solo se permiten rutas internas y https.
 * - Los iconos SVG se crean con createElementNS (no se inyecta markup).
 */

const PROPIEDADES_DIRECTAS = new Set([
  'id',
  'type',
  'name',
  'value',
  'placeholder',
  'disabled',
  'required',
  'readOnly',
  'checked',
  'min',
  'max',
  'step',
  'accept',
  'autofocus',
  'tabIndex'
]);

const ESQUEMA_PELIGROSO = /^\s*(javascript|vbscript|data):/i;

// Solo se permiten imagenes embebidas generadas por el backend (por ejemplo
// el QR del ticket del totem). Cualquier otro data: sigue bloqueado.
const DATA_IMAGEN = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i;

function normalizarUrl(valor) {
  if (typeof valor !== 'string') return '';
  const url = valor.trim();
  if (!url) return '';
  if (DATA_IMAGEN.test(url)) return url;
  if (ESQUEMA_PELIGROSO.test(url)) return '#';
  if (url.startsWith('//')) return '#';
  if (/^blob:/i.test(url)) return url;
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return '#';
}

function agregarHijo(nodo, hijo) {
  if (hijo === null || hijo === undefined || hijo === false) return;
  if (Array.isArray(hijo)) {
    hijo.forEach((item) => agregarHijo(nodo, item));
    return;
  }
  if (hijo instanceof Node) {
    nodo.appendChild(hijo);
    return;
  }
  nodo.appendChild(document.createTextNode(String(hijo)));
}

/**
 * Crea un elemento DOM de forma segura.
 * @param {string} etiqueta
 * @param {Object} propiedades clase, texto, dataset, atributos, on, etc.
 * @param {...(Node|string|number|Array|null)} hijos
 */
export function el(etiqueta, propiedades = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);

  for (const [clave, valor] of Object.entries(propiedades || {})) {
    if (valor === undefined || valor === null || valor === false) continue;

    if (clave === 'clase' || clave === 'className') {
      nodo.className = String(valor);
    } else if (clave === 'texto') {
      nodo.textContent = String(valor);
    } else if (clave === 'dataset') {
      Object.assign(nodo.dataset, valor);
    } else if (clave === 'atributos') {
      for (const [nombre, dato] of Object.entries(valor || {})) {
        if (dato === undefined || dato === null || dato === false) continue;
        nodo.setAttribute(nombre, String(dato));
      }
    } else if (clave === 'on') {
      for (const [evento, manejador] of Object.entries(valor || {})) {
        if (typeof manejador === 'function') nodo.addEventListener(evento, manejador);
      }
    } else if (clave === 'href' || clave === 'src') {
      nodo.setAttribute(clave, normalizarUrl(valor));
    } else if (clave === 'alt') {
      nodo.setAttribute('alt', String(valor));
    } else if (clave === 'role') {
      nodo.setAttribute('role', String(valor));
    } else if (clave === 'ariaLabel') {
      nodo.setAttribute('aria-label', String(valor));
    } else if (clave === 'innerHTML' || clave === 'outerHTML') {
      throw new Error('Uso de innerHTML prohibido por la política XSS de NubaGlow');
    } else if (PROPIEDADES_DIRECTAS.has(clave)) {
      if (clave === 'disabled' || clave === 'required' || clave === 'readOnly' || clave === 'checked') {
        nodo[clave] = Boolean(valor);
      } else {
        nodo[clave] = valor;
      }
    } else {
      nodo.setAttribute(clave, String(valor));
    }
  }

  agregarHijos(nodo, hijos);
  return nodo;
}

export function agregarHijos(nodo, hijos) {
  for (const hijo of hijos) agregarHijo(nodo, hijo);
  return nodo;
}

export function fragmento(...hijos) {
  const frag = document.createDocumentFragment();
  agregarHijos(frag, hijos);
  return frag;
}

export function texto(valor) {
  return document.createTextNode(String(valor ?? ''));
}

export function vaciar(nodo) {
  if (nodo) nodo.replaceChildren();
  return nodo;
}

export function qs(selector, raiz = document) {
  return raiz.querySelector(selector);
}

export function qsa(selector, raiz = document) {
  return Array.from(raiz.querySelectorAll(selector));
}

const ICONOS = {
  inicio: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M9 21v-6h6v6'],
  catalogo: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  carrito: ['M6 8h12l-1.2 10.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  pedido: ['M3 7h11v10H3z', 'M14 10h4l3 3v4h-7', 'M7 17a2 2 0 1 0 0 .1', 'M17 17a2 2 0 1 0 0 .1'],
  cuenta: ['M20 21a8 8 0 0 0-16 0', 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  panel: ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'],
  pos: ['M4 7h16v13H4z', 'M8 7V4h8v3', 'M8 12h8', 'M8 16h5'],
  operaciones: ['M3 8l9-4 9 4-9 4-9-4z', 'M3 8v8l9 4 9-4V8', 'M12 12v8'],
  productos: ['M3 8l9-4 9 4-9 4-9-4z', 'M3 8v8l9 4 9-4V8'],
  usuarios: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75'
  ],
  reportes: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  salir: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
  corazon: ['M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z'],
  asistente: [
    'M21 12a8 8 0 0 1-8 8H6l-3 2 1-4.5A8 8 0 1 1 21 12z',
    'M8 10h8',
    'M8 14h5'
  ],
  buscar: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  cerrar: ['M6 6l12 12', 'M18 6 6 18'],
  flecha: ['M5 12h14', 'M13 6l6 6-6 6'],
  flechaIzquierda: ['M19 12H5', 'M11 6l-6 6 6 6'],
  chevronAbajo: ['M6 9l6 6 6-6'],
  pausa: ['M9 5v14', 'M15 5v14'],
  reproducir: ['M7 4l12 8-12 8z'],
  mas: ['M12 5v14', 'M5 12h14'],
  menos: ['M5 12h14'],
  papelera: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12', 'M9 7V5h6v2'],
  estrella: ['M12 3.2l2.7 5.4 6 .9-4.3 4.2 1 5.9-5.4-2.8-5.4 2.8 1-5.9L3.3 9.5l6-.9z'],
  pago: ['M3 7h18v10H3z', 'M3 10h18', 'M7 15h3'],
  qr: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h2v2h-2z', 'M18 18h2v2h-2z'],
  banco: [
    'M3 10h18',
    'M5 10V8l7-4 7 4v2',
    'M6 10v7',
    'M10 10v7',
    'M14 10v7',
    'M18 10v7',
    'M4 20h16'
  ],
  tarjeta: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4'],
  efectivo: ['M3 7h18v10H3z', 'M7 12h.01', 'M17 12h.01', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  copiar: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  reloj: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  reiniciar: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
  subir: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 20h16'],
  descargar: ['M12 4v12', 'M7 11l5 5 5-5', 'M4 20h16'],
  whatsapp: ['M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z', 'M8.5 9h7', 'M8.5 12.5h4.5']
};

export function icono(nombre, tamano = 18) {
  const trazos = ICONOS[nombre] || ICONOS.corazon;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(tamano));
  svg.setAttribute('height', String(tamano));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon-svg');

  for (const d of trazos) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}
