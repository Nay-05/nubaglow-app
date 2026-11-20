/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE VERIFICACION DE PAGOS
 * ============================================================================
 * Cola de pagos 'En verificación' y aprobación/rechazo manual por vendedor o admin.
 * Cada transición se registra en pago_eventos y auditoria dentro de una transacción.
 */

import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import { horasVencimientoPago } from '../config/pagos';
import {
  cancelarPedidoConReposicion,
  ResultadoCancelacion
} from './cancelaciones.service';

export interface PagoVerificacion {
  id: number;
  pedidoId: number;
  codigoRastreo: string;
  metodo: string;
  monto: number;
  moneda: string;
  estado: string;
  referenciaExterna: string | null;
  referenciaDeclarada: string | null;
  comprobanteUrl: string | null;
  fechaVencimiento: string | null;
  fechaDeposito: string | null;
  montoPagado: number | null;
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
  async listarEnVerificacion(
    estado: string = 'En verificación'
  ): Promise<PagoVerificacion[]> {
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
        (
          SELECT cp.referencia
          FROM comprobantes_pago cp
          WHERE cp.pago_id = pg.id
          ORDER BY cp.creado_en DESC
          LIMIT 1
        ) AS "referenciaDeclarada",
        (
          SELECT cp.monto_pagado
          FROM comprobantes_pago cp
          WHERE cp.pago_id = pg.id
          ORDER BY cp.creado_en DESC
          LIMIT 1
        ) AS "montoPagado",
        (
          SELECT cp.fecha_deposito
          FROM comprobantes_pago cp
          WHERE cp.pago_id = pg.id
          ORDER BY cp.creado_en DESC
          LIMIT 1
        ) AS "fechaDeposito",
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
      WHERE pg.estado = $1
      ORDER BY pg.creado_en ASC`,
      [estado]
    );

    return res.rows.map((pago) => ({
      ...pago,
      monto: Number(pago.monto),
      montoPagado:
        pago.montoPagado === null ? null : Number(pago.montoPagado),
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
        pg.monto_usd AS "montoUsd",
        pg.tipo_cambio_bob_usd AS "tipoCambioBobUsd",
        pg.simulado,
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
        `SELECT cp.id,
                cp.nombre_archivo AS "nombreArchivo",
                cp.url,
                cp.mime_type AS "mimeType",
                cp.tamano_bytes AS "tamanoBytes",
                cp.hash_sha256 AS "hashSha256",
                cp.referencia,
                TO_CHAR(cp.fecha_deposito, 'YYYY-MM-DD') AS "fechaDeposito",
                cp.monto_pagado AS "montoPagado",
                cp.creado_en AS "creadoEn",
                EXISTS (
                  SELECT 1
                  FROM comprobantes_pago cp2
                  INNER JOIN pagos p2 ON p2.id = cp2.pago_id
                  WHERE cp2.hash_sha256 = cp.hash_sha256
                    AND cp2.id <> cp.id
                    AND p2.pedido_id <> $2
                ) AS "hashDuplicado"
         FROM comprobantes_pago cp
         WHERE cp.pago_id = $1
         ORDER BY cp.creado_en ASC`,
        [pagoId, resPago.rows[0].pedidoId]
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

    const totalPedido = Number(resPago.rows[0].totalPedido);

    const comprobantes = resComprobantes.rows.map((comprobante) => {
      const montoPagado =
        comprobante.montoPagado === null || comprobante.montoPagado === undefined
          ? null
          : Number(comprobante.montoPagado);
      const montoCoincide =
        montoPagado === null ? null : Math.abs(montoPagado - totalPedido) < 0.005;
      const hashDuplicado = Boolean(comprobante.hashDuplicado);

      return {
        ...comprobante,
        montoPagado,
        montoCoincide,
        hashDuplicado,
        advertenciaMonto:
          montoPagado !== null && !montoCoincide
            ? `El monto declarado (${montoPagado.toFixed(2)} Bs.) ` +
              `no coincide con el total del pedido ` +
              `(${totalPedido.toFixed(2)} Bs.)`
            : null,
        advertenciaHash: hashDuplicado
          ? 'El mismo archivo (SHA-256) ya fue subido en otro pedido'
          : null
      };
    });

    const ultimoComprobante = comprobantes.length > 0
      ? comprobantes[comprobantes.length - 1]
      : null;

    return {
      ...resPago.rows[0],
      monto: Number(resPago.rows[0].monto),
      montoUsd:
        resPago.rows[0].montoUsd === null ? null : Number(resPago.rows[0].montoUsd),
      tipoCambioBobUsd:
        resPago.rows[0].tipoCambioBobUsd === null
          ? null
          : Number(resPago.rows[0].tipoCambioBobUsd),
      totalPedido,
      referenciaDeclarada: ultimoComprobante?.referencia ?? null,
      fechaDeposito: ultimoComprobante?.fechaDeposito ?? null,
      montoPagado: ultimoComprobante?.montoPagado ?? null,
      montoCoincide: ultimoComprobante?.montoCoincide ?? null,
      advertenciaMonto: ultimoComprobante?.advertenciaMonto ?? null,
      comprobantes,
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
      if (!['Pendiente', 'En verificación'].includes(pago.estado)) {
        throw new AppError(
          `Solo se pueden rechazar pagos 'Pendiente' o 'En verificación'. Estado actual: '${pago.estado}'`,
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
         VALUES ($1, $2, 'Rechazado', $3, $4)`,
        [pagoId, pago.estado, motivoLimpio, usuarioId]
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

      const cancelacion = await cancelarPedidoConReposicion(
        cliente,
        pago.pedido_id,
        usuarioId,
        `Pago rechazado: ${motivoLimpio}`
      );

      return {
        id: pagoId,
        pedidoId: pago.pedido_id,
        estado: 'Rechazado',
        motivo: motivoLimpio,
        cancelacion
      };
    });
  }

  /**
   * Cancela los pagos vencidos y repone el stock de sus pedidos.
   * Sin cron: se invoca desde el endpoint admin y al consultar pedidos.
   */
  async cancelarVencidos(
    usuarioId: number | null,
    filtro: { pedidoId?: number; usuarioId?: number } = {}
  ): Promise<Array<ResultadoCancelacion & { pagoId: number }>> {
    const horas = horasVencimientoPago();
    const resVencidos = await consultar(
      `SELECT pg.id AS "pagoId", pg.pedido_id AS "pedidoId"
       FROM pagos pg
       INNER JOIN pedidos p ON p.id = pg.pedido_id
       WHERE pg.estado IN ('Pendiente', 'En verificación')
         AND pg.metodo <> 'contra_entrega'
         AND p.estado NOT IN ('Cancelado', 'En tránsito', 'Entregado')
         AND COALESCE(
           pg.fecha_vencimiento,
           pg.creado_en + ($1::numeric * interval '1 hour')
         ) <= NOW()
         AND ($2::int IS NULL OR pg.pedido_id = $2)
         AND ($3::int IS NULL OR p.usuario_id = $3)
       ORDER BY pg.id ASC`,
      [horas, filtro.pedidoId ?? null, filtro.usuarioId ?? null]
    );

    const cancelados: Array<ResultadoCancelacion & { pagoId: number }> = [];

    for (const vencido of resVencidos.rows) {
      const resultado = await conTransaccion(async (cliente) => {
        const resPago = await cliente.query(
          `SELECT id, pedido_id, estado, metodo
           FROM pagos
           WHERE id = $1
           FOR UPDATE`,
          [vencido.pagoId]
        );

        if (resPago.rows.length === 0) return null;

        const pago = resPago.rows[0];
        if (
          !['Pendiente', 'En verificación'].includes(pago.estado) ||
          pago.metodo === 'contra_entrega'
        ) {
          return null;
        }

        const resVencido = await cliente.query(
          `SELECT (
             COALESCE(fecha_vencimiento, creado_en + ($2::numeric * interval '1 hour')) <= NOW()
           ) AS vencido
           FROM pagos WHERE id = $1`,
          [vencido.pagoId, horas]
        );

        if (!resVencido.rows[0]?.vencido) return null;

        const motivo = `Pago vencido: supero el plazo de ${horas} horas para acreditar el pago`;

        await cliente.query(
          `UPDATE pagos
           SET estado = 'Rechazado', verificado_por = $1, fecha_verificacion = NOW(),
               motivo_rechazo = $2, actualizado_en = NOW()
           WHERE id = $3`,
          [usuarioId, motivo, vencido.pagoId]
        );

        await cliente.query(
          `INSERT INTO pago_eventos (pago_id, estado_anterior, estado_nuevo, descripcion, usuario_id)
           VALUES ($1, $2, 'Rechazado', $3, $4)`,
          [vencido.pagoId, pago.estado, motivo, usuarioId]
        );

        await cliente.query(
          `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
           VALUES ($1, 'VENCER_PAGO', 'pagos', $2, $3)`,
          [
            usuarioId,
            vencido.pagoId,
            JSON.stringify({ pedidoId: pago.pedido_id, motivo, horasVencimiento: horas })
          ]
        );

        const cancelacion = await cancelarPedidoConReposicion(
          cliente,
          pago.pedido_id,
          usuarioId,
          motivo
        );

        return { ...cancelacion, pagoId: vencido.pagoId };
      });

      if (resultado && !resultado.yaCancelado) {
        cancelados.push(resultado);
      }
    }

    return cancelados;
  }
}

export const pagosService = new PagosService();
