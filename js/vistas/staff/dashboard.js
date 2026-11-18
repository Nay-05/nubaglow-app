/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: PANEL (/staff/dashboard)
 * ============================================================================
 * Landing del rol admin. Muestra tarjetas hacia los modulos permitidos.
 * Los permisos reales se validan en el backend en cada llamada a la API.
 */

import { el, icono } from '../../core/dom.js';
import { modulosPermitidos, ETIQUETA_ROL } from '../../core/permisos.js';
import { encabezadoPagina } from '../comunes.js';

function tarjetaModulo(modulo) {
  return el(
    'a',
    {
      clase: 'tarjeta-modulo',
      href: modulo.ruta,
      atributos: { 'data-ruta': '' }
    },
    el('span', { clase: 'tarjeta-modulo-icono' }, icono(modulo.icono, 22)),
    el('strong', { clase: 'tarjeta-modulo-titulo', texto: modulo.etiqueta }),
    el('span', { clase: 'texto-suave', texto: modulo.descripcion })
  );
}

export const vistaDashboard = {
  async render({ usuario }) {
    const rol = usuario ? usuario.rol : '';
    const modulos = modulosPermitidos(rol);

    return el(
      'section',
      { clase: 'pagina' },
      encabezadoPagina(
        `Hola, ${usuario?.nombre || 'equipo'}`,
        `Sesion activa como ${ETIQUETA_ROL[rol] || rol}. Elige un modulo para trabajar.`
      ),
      el(
        'div',
        { clase: 'grilla-modulos' },
        ...modulos.map(tarjetaModulo)
      ),
      el(
        'div',
        { clase: 'panel-nota' },
        el('h2', { clase: 'panel-nota-titulo', texto: 'Seguridad del portal' }),
        el('p', {
          texto:
            'El sidebar solo muestra los modulos permitidos para tu rol, pero cada accion se valida otra vez en el servidor con JWT, RBAC y proteccion CSRF.'
        })
      )
    );
  }
};
