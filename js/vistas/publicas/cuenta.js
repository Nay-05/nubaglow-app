/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: CUENTA (/cuenta)
 * ============================================================================
 * Muestra el perfil que devuelve el backend desde la cookie HttpOnly y permite
 * cerrar sesion. El historial de pedidos se completa en la Fase 7.
 */

import { el } from '../../core/dom.js';
import { obtenerUsuario, cerrarSesion } from '../../core/sesion.js';
import { ETIQUETA_ROL } from '../../core/permisos.js';
import { encabezadoPagina, alerta, enlaceInterno } from '../comunes.js';

export const vistaCuenta = {
  async render({ router }) {
    const usuario = obtenerUsuario();
    const seccion = el('section', { clase: 'pagina' });

    if (!usuario) {
      seccion.append(
        encabezadoPagina('Mi cuenta'),
        alerta('Necesitas iniciar sesion para ver tu cuenta.'),
        enlaceInterno('/login', 'Iniciar sesion', { clase: 'btn btn-primary' })
      );
      return seccion;
    }

    seccion.appendChild(
      encabezadoPagina('Mi cuenta', 'Datos de tu sesion actual en NubaGlow.')
    );

    seccion.appendChild(
      el(
        'div',
        { clase: 'tarjeta-cuenta' },
        el(
          'dl',
          { clase: 'datos-cuenta' },
          el('div', {}, el('dt', { texto: 'Nombre' }), el('dd', { texto: usuario.nombre })),
          el('div', {}, el('dt', { texto: 'Correo' }), el('dd', { texto: usuario.email })),
          el(
            'div',
            {},
            el('dt', { texto: 'Tipo de cuenta' }),
            el('dd', { texto: ETIQUETA_ROL[usuario.rol] || usuario.rol })
          )
        ),
        el(
          'div',
          { clase: 'cuenta-acciones' },
          enlaceInterno('/pedidos', 'Rastrear un pedido', { clase: 'btn btn-outline', nombreIcono: 'pedido' }),
          enlaceInterno('/carrito', 'Ver carrito', { clase: 'btn btn-outline', nombreIcono: 'carrito' }),
          el(
            'button',
            {
              clase: 'btn btn-secondary',
              atributos: { type: 'button' },
              on: {
                click: async (evento) => {
                  const disparador = evento.currentTarget;
                  disparador.disabled = true;
                  try {
                    await cerrarSesion();
                  } finally {
                    router.navegar('/', { reemplazar: true });
                  }
                }
              }
            },
            el('span', { texto: 'Cerrar sesion' })
          )
        )
      )
    );

    return seccion;
  }
};
