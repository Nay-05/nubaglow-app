/**
 * ============================================================================
 * NUBAGLOW APP - CANCELACION DE PEDIDOS Y REPOSICION DE STOCK
 * ============================================================================
 * Cancelar un pedido y reponer todas sus variantes ocurre en una sola
 * transaccion. La operacion es idempotente por el estado 'Cancelado' del pedido
 * y por el indice unico de movimientos de reposicion.
 */

import { PoolClient } from 'pg';
import { conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';

export interface ItemRepuesto {
  varianteId: number;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
}

export interface ResultadoCancelacion {
  pedidoId: number;
  codigoRastreo: string;
  yaCancelado: boolean;
  itemsRepuestos: ItemRepuesto[];
}

/**
 * Debe invocarse dentro de una transaccion abierta.
 */
export async function cancelarPedidoConReposicion(
  cliente: PoolClient,
  pedidoId: number,
  usuarioId: number | null,
  motivo: string
): Promise<ResultadoCancelacion> {
  const resPedido = await cliente.query(
    'SELECT id, codigo_rastreo, estado FROM pedidos WHERE id = $1 FOR UPDATE',
    [pedidoId]
  );

  if (resPedido.rows.length === 0) {
    throw new AppError('Pedido no encontrado', 404);
  }

  const pedido = resPedido.rows[0];

  // Idempotencia: una segunda cancelacion no vuelve a reponer stock.
  if (pedido.estado === 'Cancelado') {
    return {
      pedidoId,
      codigoRastreo: pedido.codigo_rastreo,
      yaCancelado: true,
      itemsRepuestos: []
    };
  }

  if (pedido.estado === 'En tránsito' || pedido.estado === 'Entregado') {
    throw new AppError(
      `No se puede cancelar un pedido en estado '${pedido.estado}': el envio ya fue despachado`,
      409
    );
  }

  const resItems = await cliente.query(
    `SELECT variante_id, cantidad
     FROM pedido_items
     WHERE pedido_id = $1
     ORDER BY variante_id ASC`,
    [pedidoId]
  );

  const items = resItems.rows.map((item) => ({
    varianteId: item.variante_id,
    cantidad: item.cantidad
  }));

  const varianteIds = items.map((item) => item.varianteId);
  const stocks = new Map<number, number>();

  if (varianteIds.length > 0) {
    const resVariantes = await cliente.query(
      `SELECT id, stock
       FROM variantes
       WHERE id = ANY($1::int[])
       ORDER BY id ASC
       FOR UPDATE`,
      [varianteIds]
    );
    resVariantes.rows.forEach((variante) => stocks.set(variante.id, variante.stock));
  }

  const itemsRepuestos: ItemRepuesto[] = [];

  for (const item of items) {
    const stockAnterior = stocks.get(item.varianteId);
    if (stockAnterior === undefined) {
      throw new AppError(`No se encontro la variante ${item.varianteId} para reponer stock`, 409);
    }

    const stockNuevo = stockAnterior + item.cantidad;

    await cliente.query('UPDATE variantes SET stock = $1 WHERE id = $2', [
      stockNuevo,
      item.varianteId
    ]);

    await cliente.query(
      `INSERT INTO movimientos_inventario
       (variante_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, pedido_id)
       VALUES ($1, 'reposicion_cancelacion', $2, $3, $4, $5, $6, $7)`,
      [
        item.varianteId,
        item.cantidad,
        stockAnterior,
        stockNuevo,
        motivo,
        usuarioId,
        pedidoId
      ]
    );

    await cliente.query(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'REPONER_STOCK', 'variantes', $2, $3)`,
      [
        usuarioId,
        item.varianteId,
        JSON.stringify({
          pedidoId,
          codigoRastreo: pedido.codigo_rastreo,
          cantidad: item.cantidad,
          stockAnterior,
          stockNuevo,
          motivo
        })
      ]
    );

    itemsRepuestos.push({
      varianteId: item.varianteId,
      cantidad: item.cantidad,
      stockAnterior,
      stockNuevo
    });
  }

  await cliente.query(
    `UPDATE pedidos
     SET estado = 'Cancelado', cancelado_at = NOW(), motivo_cancelacion = $1,
         actualizado_en = NOW()
     WHERE id = $2`,
    [motivo, pedidoId]
  );

  await cliente.query(
    `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
     VALUES ($1, 'CANCELAR_PEDIDO', 'pedidos', $2, $3)`,
    [
      usuarioId,
      pedidoId,
      JSON.stringify({
        codigoRastreo: pedido.codigo_rastreo,
        estadoAnterior: pedido.estado,
        motivo,
        itemsRepuestos
      })
    ]
  );

  return {
    pedidoId,
    codigoRastreo: pedido.codigo_rastreo,
    yaCancelado: false,
    itemsRepuestos
  };
}

export async function cancelarPedido(
  pedidoId: number,
  usuarioId: number | null,
  motivo: string
): Promise<ResultadoCancelacion> {
  const motivoLimpio = motivo.trim() || 'Cancelacion administrativa del pedido';
  return conTransaccion((cliente) =>
    cancelarPedidoConReposicion(cliente, pedidoId, usuarioId, motivoLimpio)
  );
}
