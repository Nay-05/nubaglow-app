/**
 * ============================================================================
 * NUBAGLOW APP - RETORNO DE PAYPAL (/pago/paypal/retorno)
 * ============================================================================
 * El resultado que se muestra depende exclusivamente de la captura confirmada
 * por el servidor. La URL de retorno no aprueba nada por si misma.
 */

import { el } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs, formatearUsd } from '../../core/formato.js';
import { alerta, enlaceInterno } from '../comunes.js';

const RUTA_CUENTA = '/cuenta';

function crearTarjeta({ titulo, mensaje, tono, detalles = [], acciones }) {
  return el(
    'section',
    { clase: 'pagina pago-retorno' },
    el(
      'div',
      { clase: `pago-retorno-tarjeta pago-retorno-tarjeta--${tono}` },
      el('h1', { clase: 'titulo-pagina', texto: titulo }),
      alerta(mensaje, tono === 'exito' ? 'exito' : 'error'),
      ...detalles.map((detalle) =>
        el('p', { clase: 'pago-retorno-detalle', texto: detalle })
      ),
      el('div', { clase: 'pago-retorno-acciones' }, ...acciones)
    )
  );
}

export const vistaPagoPaypalRetorno = {
  async render({ consulta, router }) {
    const pedidoId = Number(consulta.get('pedido'));
    const codigo = String(consulta.get('codigo') || '');
    const token = String(consulta.get('token') || '');
    const rutaPedido = codigo
      ? `/pedido/${encodeURIComponent(codigo)}`
      : RUTA_CUENTA;

    const volver = enlaceInterno(rutaPedido, 'Volver al pedido', {
      clase: 'btn btn-primary'
    });

    if (!Number.isInteger(pedidoId) || pedidoId <= 0 || !token) {
      return crearTarjeta({
        titulo: 'No se pudo confirmar el pago',
        mensaje:
          'No recibimos la confirmación completa de PayPal. ' +
          'Puedes volver al pedido e intentar nuevamente.',
        tono: 'error',
        acciones: [volver]
      });
    }

    const seccion = el(
      'section',
      { clase: 'pagina pago-retorno' },
      el(
        'div',
        { clase: 'pago-retorno-tarjeta' },
        el('p', {
          clase: 'cargando',
          texto: 'Confirmando el pago con PayPal...'
        })
      )
    );

    try {
      const respuesta = await api.crear('/pagos/paypal/capturar', {
        pedido_id: pedidoId,
        orden_id: token
      });
      const captura = respuesta?.datos?.captura;

      if (!captura || captura.estadoPago !== 'Aprobado') {
        throw new Error(
          'El servidor no confirmó el pago como aprobado. Intenta nuevamente.'
        );
      }

      const detalles = [
        `Monto en bolivianos: ${formatearBs(captura.montoBob)}`,
        `Monto cobrado en PayPal: ${formatearUsd(captura.montoUsd)}`,
        `Moneda confirmada: ${captura.moneda}`
      ];

      if (captura.idempotente) {
        detalles.push('La captura ya estaba registrada previamente.');
      }

      return crearTarjeta({
        titulo: 'Pago aprobado',
        mensaje: 'PayPal confirmó el pago de tu pedido.',
        tono: 'exito',
        detalles,
        acciones: [
          enlaceInterno(rutaPedido, 'Ver mi pedido', {
            clase: 'btn btn-primary'
          }),
          enlaceInterno(RUTA_CUENTA, 'Ir a mi cuenta', {
            clase: 'btn btn-secondary'
          })
        ]
      });
    } catch (error) {
      return crearTarjeta({
        titulo: 'No se pudo confirmar el pago',
        mensaje:
          error instanceof Error && error.message
            ? error.message
            : 'No se pudo confirmar el pago con PayPal.',
        tono: 'error',
        detalles: [
          'El pago podría seguir Pendiente. Revisa el estado del pedido ' +
            'antes de intentar nuevamente.'
        ],
        acciones: [volver]
      });
    }
  }
};
