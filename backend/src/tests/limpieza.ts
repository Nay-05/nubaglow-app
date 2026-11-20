/**
 * ============================================================================
 * NUBAGLOW APP - LIMPIEZA COMUN DE DATOS DE PRUEBA
 * ============================================================================
 * Las suites crean productos, variantes, pedidos y usuarios reales en la base
 * de datos de Supabase. Estos helpers borran solo los registros de la corrida
 * y, si un producto ya tiene pedidos o movimientos asociados, lo dejan
 * inactivo en lugar de intentar borrar historiales protegidos por FK RESTRICT.
 */

import { consultar } from '../db';

// Las suites que crean pedidos usan el transporte de notificaciones simulado.
process.env.NODE_ENV = 'test';

/** Borra el historial de pedidos de prueba respetando el orden de las FK. */
export async function eliminarHistorialDePedidosDePrueba(
  pedidoIds: number[]
): Promise<void> {
  if (pedidoIds.length === 0) return;

  await consultar(
    `DELETE FROM comprobantes_pago
     WHERE pago_id IN (SELECT id FROM pagos WHERE pedido_id = ANY($1::int[]))`,
    [pedidoIds]
  );
  await consultar(
    `DELETE FROM pago_eventos
     WHERE pago_id IN (SELECT id FROM pagos WHERE pedido_id = ANY($1::int[]))`,
    [pedidoIds]
  );
  await consultar(
    `DELETE FROM envio_eventos
     WHERE envio_id IN (SELECT id FROM envios WHERE pedido_id = ANY($1::int[]))`,
    [pedidoIds]
  );
  await consultar('DELETE FROM entregas WHERE pedido_id = ANY($1::int[])', [pedidoIds]);
  await consultar('DELETE FROM envios WHERE pedido_id = ANY($1::int[])', [pedidoIds]);
  await consultar('DELETE FROM pedido_items WHERE pedido_id = ANY($1::int[])', [pedidoIds]);
  await consultar(
    'DELETE FROM movimientos_inventario WHERE pedido_id = ANY($1::int[])',
    [pedidoIds]
  );
  await consultar('DELETE FROM notificaciones WHERE pedido_id = ANY($1::int[])', [pedidoIds]);
  await consultar('DELETE FROM facturas WHERE pedido_id = ANY($1::int[])', [pedidoIds]);
  await consultar('DELETE FROM pagos WHERE pedido_id = ANY($1::int[])', [pedidoIds]);
  await consultar('DELETE FROM pedidos WHERE id = ANY($1::int[])', [pedidoIds]);
}

/**
 * Borra el producto de prueba y sus variantes (ON DELETE CASCADE). Si alguna
 * variante conserva pedidos, movimientos o resenas, la FK RESTRICT bloquea el
 * borrado: en ese caso se marca el producto y sus variantes como inactivos.
 */
export async function eliminarOInactivarProductoDePrueba(
  productoId: number
): Promise<'eliminado' | 'inactivado'> {
  try {
    await consultar('DELETE FROM productos WHERE id = $1', [productoId]);
    return 'eliminado';
  } catch (error) {
    if ((error as { code?: string }).code !== '23503') throw error;

    await consultar(
      'UPDATE variantes SET activo = FALSE WHERE producto_id = $1',
      [productoId]
    );
    await consultar('UPDATE productos SET activo = FALSE WHERE id = $1', [productoId]);
    return 'inactivado';
  }
}

/** Borra los movimientos y resenas creados por los usuarios de la prueba. */
export async function eliminarReferenciasDeUsuariosDePrueba(
  usuarioIds: number[]
): Promise<void> {
  if (usuarioIds.length === 0) return;

  await consultar(
    'DELETE FROM movimientos_inventario WHERE usuario_id = ANY($1::int[])',
    [usuarioIds]
  );
  await consultar('DELETE FROM resenas WHERE usuario_id = ANY($1::int[])', [usuarioIds]);
}
