/**
 * ============================================================================
 * NUBAGLOW APP - LAYOUT DE AUTENTICACION
 * ============================================================================
 * Tarjeta centrada para /login y /staff/login. Usa el logo oficial y no
 * incluye enlaces de navegacion de la tienda ni atajos de credenciales.
 */

import { el } from '../core/dom.js';

export function crearLayoutAutenticacion({ titulo }) {
  const raiz = el('div', { clase: 'layout-auth' });

  const tarjeta = el(
    'div',
    { clase: 'tarjeta-auth' },
    el(
      'header',
      { clase: 'auth-cabecera' },
      el('img', {
        clase: 'auth-logo',
        src: '/assets/brand/logo-nubaglow.png',
        alt: 'NubaGlow'
      }),
      el('h1', { clase: 'auth-titulo', texto: 'NubaGlow' }),
      el('p', { clase: 'auth-subtitulo', texto: titulo || 'Acceso al sistema' })
    )
  );

  const contenido = el('main', { clase: 'auth-contenido', atributos: { id: 'contenido' } });
  const pie = el(
    'p',
    { clase: 'auth-pie' },
    'Proyecto academico - Grupo 11. No compartas tus credenciales.'
  );

  tarjeta.append(contenido, pie);
  raiz.appendChild(tarjeta);
  return { raiz, contenido };
}
