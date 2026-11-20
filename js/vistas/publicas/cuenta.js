/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: CUENTA (/cuenta)
 * ============================================================================
 * Muestra el perfil que devuelve el backend desde la cookie HttpOnly y permite
 * cerrar sesion. El historial de pedidos se completa en la Fase 7.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs, formatearFecha } from '../../core/formato.js';
import { obtenerUsuario, cerrarSesion } from '../../core/sesion.js';
import { ETIQUETA_ROL } from '../../core/permisos.js';
import {
  encabezadoPagina,
  alerta,
  enlaceInterno,
  estadoVacio
} from '../comunes.js';

function claseEstadoPago(estado) {
  if (estado === 'Aprobado') return 'estado-aprobado';
  if (estado === 'Rechazado') return 'estado-rechazado';
  if (estado === 'En verificación') return 'estado-verificacion';
  return 'estado-pendiente';
}

function claseEstadoEnvio(estado) {
  if (estado === 'Entregado') return 'estado-entregado';
  if (estado === 'En tránsito') return 'estado-transito';
  if (estado === 'Empacado') return 'estado-empacado';
  if (estado === 'En preparación') return 'estado-preparacion';
  return 'estado-pendiente';
}

function crearTarjetaPedido(pedido) {
  const codigo = String(pedido.codigoRastreo || '');
  const ruta = `/pedido/${encodeURIComponent(codigo)}`;
  const totalArticulos = Number(pedido.totalArticulos) || 0;

  return el(
    'article',
    { clase: 'cuenta-pedido' },
    el(
      'div',
      { clase: 'cuenta-pedido-principal' },
      el(
        'div',
        { clase: 'cuenta-pedido-codigo-linea' },
        el('a', {
          clase: 'cuenta-pedido-codigo',
          href: ruta,
          atributos: { 'data-ruta': '' },
          texto: codigo
        }),
        el('span', {
          clase: 'texto-suave',
          texto:
            `${formatearFecha(pedido.creadoEn)} · ` +
            `${totalArticulos} artículo(s)`
        })
      ),
      el(
        'div',
        { clase: 'cuenta-pedido-badges' },
        el('span', {
          clase: `estado-badge ${claseEstadoPago(pedido.estadoPago)}`,
          texto: `Pago: ${pedido.estadoPago || 'Sin registrar'}`
        }),
        el('span', {
          clase: `estado-badge ${claseEstadoEnvio(pedido.estado)}`,
          texto: `Envío: ${pedido.estado || 'Pendiente'}`
        })
      )
    ),
    el(
      'div',
      { clase: 'cuenta-pedido-acciones' },
      el('strong', {
        clase: 'cuenta-pedido-total',
        texto: formatearBs(pedido.total)
      }),
      el(
        'div',
        { clase: 'cuenta-pedido-botones' },
        el(
          'a',
          {
            clase: 'btn btn-outline btn-pequeno',
            href: `/api/pedidos/${encodeURIComponent(codigo)}/comprobante-pdf`,
            atributos: {
              download: '',
              'aria-label': 'Descargar comprobante PDF'
            }
          },
          icono('descargar', 14),
          el('span', { texto: 'Descargar comprobante' })
        ),
        enlaceInterno(ruta, 'Ver detalle', {
          clase: 'btn btn-outline btn-pequeno'
        })
      )
    )
  );
}

export const vistaCuenta = {
  async render({ router }) {
    const usuario = obtenerUsuario();
    const seccion = el('section', { clase: 'pagina' });

    if (!usuario) {
      seccion.append(
        encabezadoPagina('Mi cuenta'),
        alerta('Necesitas iniciar sesión para ver tu cuenta.'),
        enlaceInterno('/login', 'Iniciar sesión', { clase: 'btn btn-primary' })
      );
      return seccion;
    }

    seccion.appendChild(
      encabezadoPagina('Mi cuenta', 'Datos de tu sesión actual en NubaGlow.')
    );

    const pedidosSeccion = el('section', { clase: 'cuenta-pedidos' });
    const cabeceraPedidos = el(
      'div',
      { clase: 'cuenta-pedidos-cabecera' },
      el('h2', { clase: 'cuenta-pedidos-titulo', texto: 'Mis pedidos' }),
      enlaceInterno('/pedidos', 'Rastrear con código', {
        clase: 'btn btn-outline btn-pequeno'
      })
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
          enlaceInterno('/pedidos', 'Rastrear un pedido', {
            clase: 'btn btn-outline',
            nombreIcono: 'pedido'
          }),
          enlaceInterno('/carrito', 'Ver carrito', {
            clase: 'btn btn-outline',
            nombreIcono: 'carrito'
          }),
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
            el('span', { texto: 'Cerrar sesión' })
          )
        )
      )
    );

    pedidosSeccion.appendChild(cabeceraPedidos);
    pedidosSeccion.appendChild(
      el('p', {
        clase: 'cargando',
        texto: 'Cargando tus pedidos...'
      })
    );
    seccion.appendChild(pedidosSeccion);

    try {
      const respuesta = await api.obtener('/pedidos');
      const pedidos = respuesta?.datos?.pedidos || [];
      const contenidoPedidos = pedidos.length
        ? el(
            'div',
            { clase: 'cuenta-pedidos-lista' },
            ...pedidos.map((pedido) => crearTarjetaPedido(pedido))
          )
        : estadoVacio(
            'Todavía no tienes pedidos. Explora el catálogo para iniciar tu primer ritual.'
          );

      pedidosSeccion.replaceChildren(cabeceraPedidos, contenidoPedidos);
    } catch (error) {
      pedidosSeccion.replaceChildren(
        cabeceraPedidos,
        alerta(
          error instanceof Error && error.message
            ? error.message
            : 'No se pudieron cargar tus pedidos.'
        )
      );
    }

    return seccion;
  }
};
