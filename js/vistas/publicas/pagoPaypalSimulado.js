/**
 * ============================================================================
 * NUBAGLOW APP - PAYPAL SIMULADO (/pago/paypal/simulado)
 * ============================================================================
 * Solo se usa con PAYPAL_MODO=simulado. Simula la pantalla de aprobacion de
 * PayPal y llama al endpoint interno de aprobacion simulada.
 */

import { el } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { alerta, enlaceInterno } from '../comunes.js';

const RUTA_CUENTA = '/cuenta';

export const vistaPagoPaypalSimulado = {
  async render({ consulta, router }) {
    const pedidoId = Number(consulta.get('pedido'));
    const codigo = String(consulta.get('codigo') || '');
    const ordenId = String(consulta.get('orden') || '');
    const rutaPedido = codigo
      ? `/pedido/${encodeURIComponent(codigo)}`
      : RUTA_CUENTA;

    if (!Number.isInteger(pedidoId) || pedidoId <= 0 || !ordenId) {
      return el(
        'section',
        { clase: 'pagina pago-simulado' },
        el('h1', { clase: 'titulo-pagina', texto: 'Simulación de PayPal' }),
        alerta(
          'No se recibieron los datos necesarios para simular el pago.'
        ),
        el(
          'div',
          { clase: 'pago-simulado-acciones' },
          enlaceInterno(rutaPedido, 'Volver al pedido', {
            clase: 'btn btn-primary'
          })
        )
      );
    }

    const mensajes = el('div', { clase: 'mensajes' });
    const aprobar = el(
      'button',
      {
        clase: 'btn btn-primary',
        atributos: { type: 'button' }
      },
      el('span', { texto: 'Aprobar pago' })
    );
    const cancelar = el(
      'button',
      {
        clase: 'btn btn-secondary',
        atributos: { type: 'button' }
      },
      el('span', { texto: 'Cancelar' })
    );

    aprobar.addEventListener('click', async () => {
      aprobar.disabled = true;
      cancelar.disabled = true;
      aprobar.textContent = 'Aprobando...';
      mensajes.replaceChildren();

      try {
        await api.crear('/pagos/paypal/simulado/aprobar', {
          pedido_id: pedidoId,
          orden_id: ordenId
        });

        router.navegar(
          `/pago/paypal/retorno?pedido=${pedidoId}` +
            `&codigo=${encodeURIComponent(codigo)}` +
            `&token=${encodeURIComponent(ordenId)}`
        );
      } catch (error) {
        mensajes.replaceChildren(
          alerta(
            error instanceof Error && error.message
              ? error.message
              : 'No se pudo aprobar la orden simulada.'
          )
        );
        aprobar.disabled = false;
        cancelar.disabled = false;
        aprobar.textContent = 'Aprobar pago';
      }
    });

    cancelar.addEventListener('click', () => {
      router.navegar(
        `${rutaPedido}?paypal=cancelado`,
        { reemplazar: true }
      );
    });

    return el(
      'section',
      { clase: 'pagina pago-simulado' },
      el(
        'div',
        { clase: 'pago-simulado-tarjeta' },
        el('p', {
          clase: 'pago-simulado-etiqueta',
          texto: 'Entorno de pruebas'
        }),
        el('h1', {
          clase: 'titulo-pagina',
          texto: 'Simulación de PayPal'
        }),
        el('p', {
          clase: 'texto-suave',
          texto:
            'Esta pantalla reemplaza a PayPal en modo simulado. ' +
            'No se realizará ningún cobro real.'
        }),
        el(
          'dl',
          { clase: 'pago-simulado-datos' },
          el(
            'div',
            {},
            el('dt', { texto: 'Pedido' }),
            el('dd', { texto: codigo || String(pedidoId) })
          ),
          el(
            'div',
            {},
            el('dt', { texto: 'Orden simulada' }),
            el('dd', { texto: ordenId })
          )
        ),
        mensajes,
        el('div', { clase: 'pago-simulado-acciones' }, aprobar, cancelar)
      )
    );
  }
};
