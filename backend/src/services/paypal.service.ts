/**
 * ============================================================================
 * NUBAGLOW APP - PAGOS CON PAYPAL
 * ============================================================================
 * Reglas de seguridad:
 * 1. Solo el cliente dueno del pedido puede crear, capturar o simular aprobar.
 * 2. El monto USD lo calcula el servidor desde el total en Bs.; el cliente
 *    nunca envia montos ni moneda.
 * 3. Un pago solo pasa a Aprobado despues de una captura verificada contra la
 *    pasarela (monto y moneda incluidos). La URL de retorno no aprueba nada.
 * 4. La captura es idempotente: repetirla no duplica pago_eventos ni auditoria.
 */

import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import {
  convertirBobAUsd,
  esPaypalSimulado,
  modoPaypal,
  tipoCambioBobUsd
} from '../config/paypal';
import { pagosService } from './pagos.service';
import { crearPasarelaPaypal, PasarelaPaypal } from './paypalPasarela.service';

interface PedidoPagoPaypal {
  pedidoId: number;
  usuarioId: number;
  codigoRastreo: string;
  total: number;
  pedidoEstado: string;
  pagoId: number;
  metodo: string;
  pagoEstado: string;
  paypalOrderId: string | null;
  capturaId: string | null;
  montoBob: number;
  montoUsd: number | null;
  tipoCambio: number | null;
}

export interface OrdenPaypalCreadaResultado {
  pedidoId: number;
  pagoId: number;
  ordenId: string;
  urlAprobacion: string;
  montoBob: number;
  montoUsd: number;
  tipoCambioBobUsd: number;
  monedaPaypal: 'USD';
  modo: string;
  simulado: boolean;
}

export interface CapturaPaypalResultado {
  pedidoId: number;
  pagoId: number;
  estadoPago: string;
  estadoOrden: string;
  montoBob: number;
  montoUsd: number;
  moneda: string;
  capturaId: string;
  idempotente: boolean;
}

interface CapturaConfirmada {
  capturaId: string;
  estado: string;
  monto: number;
  moneda: string;
}

export class PaypalService {
  constructor(
    private readonly pasarelaFactory: () => PasarelaPaypal = crearPasarelaPaypal
  ) {}

  private async cargarPedidoPago(pedidoId: number): Promise<PedidoPagoPaypal> {
    const res = await consultar(
      `SELECT
         p.id AS "pedidoId",
         p.usuario_id AS "usuarioId",
         p.codigo_rastreo AS "codigoRastreo",
         p.total,
         p.estado AS "pedidoEstado",
         pg.id AS "pagoId",
         pg.metodo,
         pg.estado AS "pagoEstado",
         pg.paypal_order_id AS "paypalOrderId",
         pg.referencia_externa AS "capturaId",
         pg.monto AS "montoBob",
         pg.monto_usd AS "montoUsd",
         pg.tipo_cambio_bob_usd AS "tipoCambio"
       FROM pedidos p
       INNER JOIN pagos pg ON pg.pedido_id = p.id
       WHERE p.id = $1`,
      [pedidoId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Pedido o pago no encontrado', 404);
    }

    const fila = res.rows[0];
    return {
      pedidoId: Number(fila.pedidoId),
      usuarioId: Number(fila.usuarioId),
      codigoRastreo: fila.codigoRastreo,
      total: Number(fila.total),
      pedidoEstado: fila.pedidoEstado,
      pagoId: Number(fila.pagoId),
      metodo: fila.metodo,
      pagoEstado: fila.pagoEstado,
      paypalOrderId: fila.paypalOrderId,
      capturaId: fila.capturaId,
      montoBob: Number(fila.montoBob),
      montoUsd: fila.montoUsd === null ? null : Number(fila.montoUsd),
      tipoCambio: fila.tipoCambio === null ? null : Number(fila.tipoCambio)
    };
  }

  private validarPropietario(pedido: PedidoPagoPaypal, usuarioId: number): void {
    if (pedido.usuarioId !== Number(usuarioId)) {
      throw new AppError('Acceso denegado: el pedido no pertenece a su cuenta', 403);
    }
  }

  private validarMetodoPaypal(pedido: PedidoPagoPaypal): void {
    if (pedido.metodo !== 'paypal') {
      throw new AppError('El pedido no fue creado con el metodo de pago PayPal', 409);
    }
  }

  private async asegurarPedidoNoVencido(pedidoId: number): Promise<void> {
    // Reutiliza la regla existente: un pago vencido se rechaza y repone stock.
    await pagosService.cancelarVencidos(null, { pedidoId });
  }

  /**
   * Crea (o reemplaza) la orden PayPal del pedido. La orden vieja queda
   * huerfana si el cliente vuelve a intentar; el pago sigue Pendiente.
   */
  async crear(pedidoId: number, usuarioId: number): Promise<OrdenPaypalCreadaResultado> {
    await this.asegurarPedidoNoVencido(pedidoId);

    const pedido = await this.cargarPedidoPago(pedidoId);
    this.validarPropietario(pedido, usuarioId);
    this.validarMetodoPaypal(pedido);

    if (pedido.pedidoEstado === 'Cancelado') {
      throw new AppError('No se puede pagar un pedido cancelado', 409);
    }
    if (pedido.pagoEstado !== 'Pendiente') {
      throw new AppError(
        `Solo se puede crear una orden PayPal para pagos Pendientes. Estado actual: '${pedido.pagoEstado}'`,
        409
      );
    }

    let montoUsd: number;
    try {
      montoUsd = convertirBobAUsd(pedido.total);
    } catch (error: any) {
      throw new AppError(error.message || 'No se pudo convertir el monto a USD', 400);
    }

    const pasarela = this.pasarelaFactory();
    const orden = await pasarela.crearOrden(
      { id: pedido.pedidoId, codigoRastreo: pedido.codigoRastreo },
      montoUsd
    );

    return conTransaccion(async (cliente) => {
      const resPago = await cliente.query(
        `SELECT pg.id, pg.estado, pg.metodo, p.estado AS "pedidoEstado"
         FROM pagos pg
         INNER JOIN pedidos p ON p.id = pg.pedido_id
         WHERE pg.id = $1
         FOR UPDATE`,
        [pedido.pagoId]
      );

      const pagoActual = resPago.rows[0];
      if (!pagoActual || pagoActual.metodo !== 'paypal') {
        throw new AppError('El pago ya no esta disponible para PayPal', 409);
      }
      if (pagoActual.estado !== 'Pendiente' || pagoActual.pedidoEstado === 'Cancelado') {
        throw new AppError('El pago dejo de estar Pendiente durante la creacion de la orden', 409);
      }

      const tipoCambio = Math.round(tipoCambioBobUsd() * 10000) / 10000;
      const simulado = esPaypalSimulado() ? true : false;

      await cliente.query(
        `UPDATE pagos
         SET paypal_order_id = $1,
             monto_usd = $2,
             tipo_cambio_bob_usd = $3,
             simulado = $4,
             referencia_externa = NULL,
             actualizado_en = NOW()
         WHERE id = $5`,
        [orden.ordenId, montoUsd, tipoCambio, simulado, pedido.pagoId]
      );

      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'CREAR_ORDEN_PAYPAL', 'pagos', $2, $3)`,
        [
          usuarioId,
          pedido.pagoId,
          JSON.stringify({
            pedidoId: pedido.pedidoId,
            ordenId: orden.ordenId,
            montoBob: pedido.total,
            montoUsd,
            tipoCambio,
            modo: modoPaypal()
          })
        ]
      );

      return {
        pedidoId: pedido.pedidoId,
        pagoId: pedido.pagoId,
        ordenId: orden.ordenId,
        urlAprobacion: orden.urlAprobacion,
        montoBob: pedido.total,
        montoUsd,
        tipoCambioBobUsd: tipoCambio,
        monedaPaypal: 'USD' as const,
        modo: modoPaypal(),
        simulado
      };
    });
  }

  /**
   * Captura la orden en la pasarela y solo entonces aprueba el pago.
   * Verifica pertenencia, estado de la orden, monto y moneda.
   */
  async capturar(
    pedidoId: number,
    ordenId: string,
    usuarioId: number
  ): Promise<CapturaPaypalResultado> {
    await this.asegurarPedidoNoVencido(pedidoId);

    const pedido = await this.cargarPedidoPago(pedidoId);
    this.validarPropietario(pedido, usuarioId);
    this.validarMetodoPaypal(pedido);

    // La orden debe pertenecer a este pedido incluso si el pago ya esta aprobado.
    if (pedido.paypalOrderId !== ordenId) {
      const resOtraOrden = await consultar(
        'SELECT pedido_id FROM pagos WHERE paypal_order_id = $1',
        [ordenId]
      );
      if (resOtraOrden.rows.length > 0) {
        throw new AppError('Acceso denegado: la orden PayPal pertenece a otro pedido', 403);
      }
      if (pedido.pagoEstado === 'Aprobado') {
        throw new AppError('El pago ya fue aprobado con otra orden PayPal', 409);
      }
      throw new AppError('La orden PayPal no corresponde a este pedido', 404);
    }

    if (pedido.pagoEstado === 'Aprobado') {
      return {
        pedidoId: pedido.pedidoId,
        pagoId: pedido.pagoId,
        estadoPago: 'Aprobado',
        estadoOrden: 'COMPLETED',
        montoBob: pedido.montoBob,
        montoUsd: pedido.montoUsd ?? 0,
        moneda: 'USD',
        capturaId: pedido.capturaId ?? '',
        idempotente: true
      };
    }

    if (pedido.pagoEstado !== 'Pendiente') {
      throw new AppError(
        `Solo se puede capturar un pago Pendiente. Estado actual: '${pedido.pagoEstado}'`,
        409
      );
    }
    if (!pedido.paypalOrderId) {
      throw new AppError('El pedido aun no tiene una orden PayPal creada', 409);
    }

    const esperadoUsd = pedido.montoUsd;
    if (esperadoUsd === null) {
      throw new AppError('El pago no tiene monto USD registrado; cree la orden nuevamente', 409);
    }

    const pasarela = this.pasarelaFactory();
    const captura = await pasarela.capturarOrden(ordenId);
    const estadoOrden = String(captura.estado || '').toUpperCase();

    if (!['COMPLETED', 'APPROVED'].includes(estadoOrden)) {
      throw new AppError(
        `La orden PayPal no esta aprobada. Estado actual: '${captura.estado || 'desconocido'}'`,
        409
      );
    }
    if (captura.moneda !== 'USD') {
      throw new AppError('La moneda capturada por PayPal no coincide con USD', 409);
    }
    if (!Number.isFinite(captura.monto) || Math.abs(captura.monto - esperadoUsd) > 0.005) {
      throw new AppError(
        `El monto capturado (${Number(captura.monto).toFixed(2)} USD) no coincide con el esperado (${esperadoUsd.toFixed(2)} USD)`,
        409
      );
    }
    if (!captura.capturaId) {
      throw new AppError('PayPal no devolvio el identificador de captura', 502);
    }

    return this.confirmarCaptura(pedido, ordenId, usuarioId, {
      capturaId: captura.capturaId,
      estado: estadoOrden,
      monto: captura.monto,
      moneda: captura.moneda
    });
  }

  private async confirmarCaptura(
    pedido: PedidoPagoPaypal,
    ordenId: string,
    usuarioId: number,
    captura: CapturaConfirmada
  ): Promise<CapturaPaypalResultado> {
    return conTransaccion(async (cliente) => {
      const resPago = await cliente.query(
        `SELECT pg.id, pg.estado, pg.metodo, pg.paypal_order_id AS "paypalOrderId",
                pg.referencia_externa AS "capturaId", pg.monto, pg.monto_usd AS "montoUsd",
                p.estado AS "pedidoEstado"
         FROM pagos pg
         INNER JOIN pedidos p ON p.id = pg.pedido_id
         WHERE pg.id = $1
         FOR UPDATE`,
        [pedido.pagoId]
      );

      const pago = resPago.rows[0];
      if (!pago || pago.metodo !== 'paypal') {
        throw new AppError('El pago ya no esta disponible para PayPal', 409);
      }

      if (pago.estado === 'Aprobado') {
        if (pago.paypalOrderId !== ordenId) {
          throw new AppError('El pago ya fue aprobado con otra orden PayPal', 409);
        }
        return {
          pedidoId: pedido.pedidoId,
          pagoId: pedido.pagoId,
          estadoPago: 'Aprobado',
          estadoOrden: captura.estado,
          montoBob: Number(pago.monto),
          montoUsd: Number(pago.montoUsd),
          moneda: 'USD',
          capturaId: pago.capturaId ?? captura.capturaId,
          idempotente: true
        };
      }

      if (pago.estado !== 'Pendiente') {
        throw new AppError(
          `El pago dejo de estar Pendiente. Estado actual: '${pago.estado}'`,
          409
        );
      }
      if (pago.pedidoEstado === 'Cancelado') {
        throw new AppError('No se puede aprobar el pago de un pedido cancelado', 409);
      }
      if (pago.paypalOrderId !== ordenId) {
        throw new AppError('La orden PayPal cambio durante la captura; intente nuevamente', 409);
      }
      if (Number(pago.montoUsd) !== Number(pedido.montoUsd)) {
        throw new AppError('El monto USD del pago cambio durante la captura', 409);
      }

      await cliente.query(
        `UPDATE pagos
         SET estado = 'Aprobado',
             referencia_externa = $1,
             fecha_verificacion = NOW(),
             pagado_en = NOW(),
             motivo_rechazo = NULL,
             actualizado_en = NOW()
         WHERE id = $2`,
        [captura.capturaId, pedido.pagoId]
      );

      await cliente.query(
        `INSERT INTO pago_eventos
         (pago_id, estado_anterior, estado_nuevo, descripcion, usuario_id)
         VALUES ($1, 'Pendiente', 'Aprobado', $2, $3)`,
        [
          pedido.pagoId,
          `Pago capturado y verificado en PayPal (orden ${ordenId}, captura ${captura.capturaId}).`,
          usuarioId
        ]
      );

      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'APROBAR_PAGO_PAYPAL', 'pagos', $2, $3)`,
        [
          usuarioId,
          pedido.pagoId,
          JSON.stringify({
            pedidoId: pedido.pedidoId,
            ordenId,
            capturaId: captura.capturaId,
            montoBob: Number(pago.monto),
            montoUsd: Number(pago.montoUsd),
            moneda: captura.moneda,
            modo: modoPaypal()
          })
        ]
      );

      return {
        pedidoId: pedido.pedidoId,
        pagoId: pedido.pagoId,
        estadoPago: 'Aprobado',
        estadoOrden: captura.estado,
        montoBob: Number(pago.monto),
        montoUsd: Number(pago.montoUsd),
        moneda: captura.moneda,
        capturaId: captura.capturaId,
        idempotente: false
      };
    });
  }

  /**
   * Solo disponible en modo simulado y fuera de produccion. Simula la
   * aprobacion que el comprador haria en el checkout de PayPal.
   */
  async aprobarSimulado(
    pedidoId: number,
    ordenId: string,
    usuarioId: number
  ): Promise<{ pedidoId: number; ordenId: string; estado: string }> {
    if (!esPaypalSimulado() || process.env.NODE_ENV === 'production') {
      throw new AppError('No encontrado', 404);
    }

    const pedido = await this.cargarPedidoPago(pedidoId);
    this.validarPropietario(pedido, usuarioId);
    this.validarMetodoPaypal(pedido);

    if (pedido.pagoEstado !== 'Pendiente') {
      throw new AppError(
        `Solo se puede simular la aprobacion de un pago Pendiente. Estado actual: '${pedido.pagoEstado}'`,
        409
      );
    }
    if (pedido.paypalOrderId !== ordenId) {
      const resOtraOrden = await consultar(
        'SELECT pedido_id FROM pagos WHERE paypal_order_id = $1',
        [ordenId]
      );
      if (resOtraOrden.rows.length > 0) {
        throw new AppError('Acceso denegado: la orden PayPal pertenece a otro pedido', 403);
      }
      throw new AppError('La orden PayPal no corresponde a este pedido', 404);
    }

    const pasarela = this.pasarelaFactory();
    if (!pasarela.aprobarOrdenSimulada) {
      throw new AppError('No encontrado', 404);
    }

    const resultado = await pasarela.aprobarOrdenSimulada(ordenId);

    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'SIMULAR_APROBACION_PAYPAL', 'pagos', $2, $3)`,
      [
        usuarioId,
        pedido.pagoId,
        JSON.stringify({
          pedidoId: pedido.pedidoId,
          ordenId,
          estado: resultado.estado,
          modo: modoPaypal()
        })
      ]
    );

    return { pedidoId: pedido.pedidoId, ordenId, estado: resultado.estado };
  }
}

export const paypalService = new PaypalService();
