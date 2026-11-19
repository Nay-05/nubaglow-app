/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE VERIFICACION DE PAGOS
 * ============================================================================
 * Cola de pagos 'En verificación' y aprobación/rechazo manual por vendedor o admin.
 * Cada transición se registra en pago_eventos y auditoria dentro de una transacción.
 */

import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';

export interface PagoVerificacion {
  id: number;
  pedidoId: number;
  codigoRastreo: string;
  metodo: string;
  monto: number;
  moneda: string;
  estado: string;
  referenciaExterna: string | null;
  comprobanteUrl: string | null;
  fechaVencimiento: string | null;
  creadoEn: string;
  nombreCliente: string;
  ciudad: string;
  totalPedido: number;
  comprobantes: Array<{
    id: number;
    nombreArchivo: string;
    url: string;
    mimeType: string;
    subidoEn: string;
  }>;
}

export class PagosService {
  /**
   * Lista los pagos que esperan verificacion manual.
   */
  async listarEnVerificacion(): Promise<PagoVerificacion[]> {
    const res = await consultar(
      `SELECT
        pg.id,
        pg.pedido_id AS "pedidoId",
        p.codigo_rastreo AS "codigoRastreo",
        pg.metodo,
        pg.monto,
        pg.moneda,
        pg.estado,
        pg.referencia_externa AS "referenciaExterna",
        pg.comprobante_url AS "comprobanteUrl",
        pg.fecha_vencimiento AS "fechaVencimiento",
        pg.creado_en AS "creadoEn",
        p.nombre_cliente AS "nombreCliente",
        p.ciudad,
        p.total AS "totalPedido",
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', cp.id,
              'nombreArchivo', cp.nombre_archivo,
              'url', cp.url,
              'mimeType', cp.mime_type,
              'subidoEn', cp.creado_en
            ) ORDER BY cp.creado_en ASC)
            FROM comprobantes_pago cp
            WHERE cp.pago_id = pg.id
          ),
          '[]'::json
        ) AS comprobantes
      FROM pagos pg
      INNER JOIN pedidos p ON p.id = pg.pedido_id
      WHERE pg.estado = 'En verificación'
      ORDER BY pg.creado_en ASC`,
      []
    );

    return res.rows.map((pago) => ({
      ...pago,
      monto: Number(pago.monto),
      totalPedido: Number(pago.totalPedido)
    }));
  }

  /**
   * Detalle de un pago con su historial de eventos.
   */
  async obtenerDetalle(pagoId: number) {
    const resPago = await consultar(
      `SELECT
        pg.id,
        pg.pedido_id AS "pedidoId",
        p.codigo_rastreo AS "codigoRastreo",
        pg.metodo,
        pg.monto,
        pg.moneda,
        pg.estado,
        pg.referencia,
        pg.referencia_externa AS "referenciaExterna",
        pg.paypal_order_id AS "paypalOrderId",
        pg.comprobante_url AS "comprobanteUrl",
        pg.fecha_vencimiento AS "fechaVencimiento",
        pg.verificado_por AS "verificadoPor",
        pg.fecha_verificacion AS "fechaVerificacion",
        pg.motivo_rechazo AS "motivoRechazo",
        pg.pagado_en AS "pagadoEn",
        pg.creado_en AS "creadoEn",
        p.nombre_cliente AS "nombreCliente",
        p.celular_cliente AS "celularCliente",
        p.correo_cliente AS "correoCliente",
        p.ciudad,
        p.direccion,
        p.total AS "totalPedido"
      FROM pagos pg
      INNER JOIN pedidos p ON p.id = pg.pedido_id
      WHERE pg.id = $1`,
      [pagoId]
    );

    if (resPago.rows.length === 0) {
      throw new AppError('Pago no encontrado', 404);
    }

    const [resComprobantes, resEventos] = await Promise.all([
      consultar(
        `SELECT id, nombre_archivo AS "nombreArchivo", url, mime_type AS "mimeType",
                tamano_bytes AS "tamanoBytes", creado_en AS "creadoEn"
         FROM comprobantes_pago
         WHERE pago_id = $1
         ORDER BY creado_en ASC`,
        [pagoId]
      ),
      consultar(
        `SELECT pe.id, pe.estado_anterior AS "estadoAnterior", pe.estado_nuevo AS "estadoNuevo",
                pe.descripcion, pe.creado_en AS "creadoEn", u.nombre AS "usuarioNombre"
         FROM pago_eventos pe
         LEFT JOIN usuarios u ON u.id = pe.usuario_id
         WHERE pe.pago_id = $1
         ORDER BY pe.creado_en ASC`,
        [pagoId]
      )
    ]);

    return {
      ...resPago.rows[0],
      monto: Number(resPago.rows[0].monto),
      totalPedido: Number(resPago.rows[0].totalPedido),
      comprobantes: resComprobantes.rows,
      eventos: resEventos.rows
    };
  }

  /**
   * Aprueba un pago que se encuentra En verificación.
   */
  async aprobar(pagoId: number, usuarioId: number) {
    return conTransaccion(async (cliente) => {
      const resPago = await cliente.query(
        'SELECT id, pedido_id, estado FROM pagos WHERE id = $1 FOR UPDATE',
        [pagoId]
      );

      if (resPago.rows.length === 0) {
        throw new AppError('Pago no encontrado', 404);
      }

      const pago = resPago.rows[0];
      if (pago.estado !== 'En verificación') {
        throw new AppError(
          `Solo se pueden aprobar pagos 'En verificación'. Estado actual: '${pago.estado}'`,
          409
        );
      }

      await cliente.query(
        `UPDATE pagos
         SET estado = 'Aprobado', verificado_por = $1, fecha_verificacion = NOW(),
             pagado_en = NOW(), motivo_rechazo = NULL, actualizado_en = NOW()
         WHERE id = $2`,
        [usuarioId, pagoId]
      );

      await cliente.query(
        `INSERT INTO pago_eventos (pago_id, estado_anterior, estado_nuevo, descripcion, usuario_id)
         VALUES ($1, 'En verificación', 'Aprobado', $2, $3)`,
        [pagoId, 'Pago verificado y aprobado manualmente.', usuarioId]
      );

      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'APROBAR_PAGO', 'pagos', $2, $3)`,
        [usuarioId, pagoId, JSON.stringify({ pedidoId: pago.pedido_id, estadoNuevo: 'Aprobado' })]
      );

      return { id: pagoId, pedidoId: pago.pedido_id, estado: 'Aprobado' };
    });
  }

  /**
   * Rechaza un pago En verificación con motivo obligatorio.
   */
  async rechazar(pagoId: number, motivo: string, usuarioId: number) {
    return conTransaccion(async (cliente) => {
      const resPago = await cliente.query(
        'SELECT id, pedido_id, estado FROM pagos WHERE id = $1 FOR UPDATE',
        [pagoId]
      );

      if (resPago.rows.length === 0) {
        throw new AppError('Pago no encontrado', 404);
      }

      const pago = resPago.rows[0];
      if (pago.estado !== 'En verificación') {
        throw new AppError(
          `Solo se pueden rechazar pagos 'En verificación'. Estado actual: '${pago.estado}'`,
          409
        );
      }

      const motivoLimpio = motivo.trim();

      await cliente.query(
        `UPDATE pagos
         SET estado = 'Rechazado', verificado_por = $1, fecha_verificacion = NOW(),
             motivo_rechazo = $2, actualizado_en = NOW()
         WHERE id = $3`,
        [usuarioId, motivoLimpio, pagoId]
      );

      await cliente.query(
        `INSERT INTO pago_eventos (pago_id, estado_anterior, estado_nuevo, descripcion, usuario_id)
         VALUES ($1, 'En verificación', 'Rechazado', $2, $3)`,
        [pagoId, motivoLimpio, usuarioId]
      );

      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'RECHAZAR_PAGO', 'pagos', $2, $3)`,
        [
          usuarioId,
          pagoId,
          JSON.stringify({ pedidoId: pago.pedido_id, estadoNuevo: 'Rechazado', motivo: motivoLimpio })
        ]
      );

      return { id: pagoId, pedidoId: pago.pedido_id, estado: 'Rechazado', motivo: motivoLimpio };
    });
  }
}

export const pagosService = new PagosService();
