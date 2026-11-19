/**
 * ============================================================================
 * NUBAGLOW APP - SUITE DE PRUEBAS AUTOMATIZADAS: BLOQUE E
 * ============================================================================
 * Valida:
 * 1. No preparar pedidos sin pago aprobado (salvo contra_entrega).
 * 2. Rechazo de pago cancela y repone stock una sola vez.
 * 3. Vencimiento configurable cancela y repone stock una sola vez.
 * 4. Verificacion de vencimiento al consultar el pedido.
 * 5. Idempotencia de cancelacion y bloqueo en transito/entregado.
 * 6. Rutas legacy y staff aplican los mismos permisos de rol y etapa.
 */

import jwt from 'jsonwebtoken';
import app from '../index';
import { consultar, cerrarPool } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_super_segura_nubaglow_2026';
process.env.JWT_SECRET = JWT_SECRET;
process.env.PAGO_VENCIMIENTO_HORAS = '24';

async function ejecutarPruebas() {
  console.log('Iniciando suite de pruebas automatizadas: Bloque E (Pagos, cancelacion y reposicion)...');

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  let exitos = 0;
  let fallos = 0;

  function asegurar(condicion: boolean, descripcion: string) {
    if (condicion) {
      console.log(`[PASS] ${descripcion}`);
      exitos++;
    } else {
      console.error(`[FAIL] ${descripcion}`);
      fallos++;
    }
  }

  const sufijo = Date.now().toString().slice(-6);

  let adminId: number;
  let vendedorId: number;
  let almacenId: number;
  let logisticaId: number;
  let clienteId: number;

  let tokenAdmin: string;
  let tokenVendedor: string;
  let tokenAlmacen: string;
  let tokenLogistica: string;
  let tokenCliente: string;

  let productoId: number;
  let varianteId: number;

  const pedidoIds: number[] = [];
  const pagoIds: number[] = [];

  const token = (id: number, nombre: string, email: string, rol: string) =>
    jwt.sign({ id, nombre, email, rol, activo: true }, JWT_SECRET, { expiresIn: '1h' });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const authJson = (t: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${t}`
  });

  async function stockActual(): Promise<number> {
    const res = await consultar('SELECT stock FROM variantes WHERE id = $1', [varianteId]);
    return res.rows[0].stock;
  }

  async function movimientosReposicion(pedidoId: number): Promise<number> {
    const res = await consultar(
      `SELECT COUNT(*)::int AS total
       FROM movimientos_inventario
       WHERE pedido_id = $1 AND tipo = 'reposicion_cancelacion'`,
      [pedidoId]
    );
    return res.rows[0].total;
  }

  async function crearPedido(metodo_pago: string, cantidad: number) {
    const res = await fetch(`${baseUrl}/api/pedidos`, {
      method: 'POST',
      headers: authJson(tokenCliente),
      body: JSON.stringify({
        nombre_cliente: 'Cliente Cancelaciones',
        celular_cliente: '71234567',
        correo_cliente: `cliente_e_${sufijo}@nuba.bo`,
        ciudad: 'Sucre',
        direccion: 'Calle Cancelaciones 123',
        metodo_pago,
        items: [{ variante_id: varianteId, cantidad }]
      })
    });
    const data = (await res.json()) as any;
    if (res.status !== 201) {
      throw new Error(`No se pudo crear el pedido de prueba: ${JSON.stringify(data)}`);
    }
    const pedido = data.datos.pedido;
    pedidoIds.push(pedido.id);

    const resPago = await consultar('SELECT id FROM pagos WHERE pedido_id = $1', [pedido.id]);
    pagoIds.push(resPago.rows[0].id);

    return { pedido, pagoId: resPago.rows[0].id as number };
  }

  try {
    const resAdmin = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Admin Bloque E', $1, 'hash_test', 'admin', TRUE) RETURNING id`,
      [`admin_e_${sufijo}@nuba.bo`]
    );
    adminId = resAdmin.rows[0].id;

    const resVendedor = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Vendedor Bloque E', $1, 'hash_test', 'vendedor', TRUE) RETURNING id`,
      [`vendedor_e_${sufijo}@nuba.bo`]
    );
    vendedorId = resVendedor.rows[0].id;

    const resAlmacen = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Almacen Bloque E', $1, 'hash_test', 'almacen', TRUE) RETURNING id`,
      [`almacen_e_${sufijo}@nuba.bo`]
    );
    almacenId = resAlmacen.rows[0].id;

    const resLogistica = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Logistica Bloque E', $1, 'hash_test', 'logistica', TRUE) RETURNING id`,
      [`logistica_e_${sufijo}@nuba.bo`]
    );
    logisticaId = resLogistica.rows[0].id;

    const resCliente = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Cliente Bloque E', $1, 'hash_test', 'cliente', TRUE) RETURNING id`,
      [`cliente_e_${sufijo}@nuba.bo`]
    );
    clienteId = resCliente.rows[0].id;

    tokenAdmin = token(adminId, 'Admin Bloque E', `admin_e_${sufijo}@nuba.bo`, 'admin');
    tokenVendedor = token(vendedorId, 'Vendedor Bloque E', `vendedor_e_${sufijo}@nuba.bo`, 'vendedor');
    tokenAlmacen = token(almacenId, 'Almacen Bloque E', `almacen_e_${sufijo}@nuba.bo`, 'almacen');
    tokenLogistica = token(logisticaId, 'Logistica Bloque E', `logistica_e_${sufijo}@nuba.bo`, 'logistica');
    tokenCliente = token(clienteId, 'Cliente Bloque E', `cliente_e_${sufijo}@nuba.bo`, 'cliente');

    const resCat = await consultar('SELECT id FROM categorias LIMIT 1');
    const resProd = await consultar(
      `INSERT INTO productos
       (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo)
       VALUES ($1, $2, $3, 'Nuba Test', 'Todo tipo', 'Desc E', 'Ing E', 'Modo E', TRUE)
       RETURNING id`,
      [resCat.rows[0].id, `Producto Cancelacion ${sufijo}`, `producto-cancelacion-${sufijo}`]
    );
    productoId = resProd.rows[0].id;

    const resVar = await consultar(
      `INSERT INTO variantes (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Variante Cancelacion 50ml', 50.00, 10, 2, TRUE)
       RETURNING id`,
      [productoId, `SKU-CANCEL-${sufijo}`]
    );
    varianteId = resVar.rows[0].id;

    // ------------------------------------------------------------------------
    // 1. PAGO NO APROBADO BLOQUEA PREPARACION Y RECHAZO REPONE STOCK
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Pago no aprobado, rechazo y reposicion ---');
    const pedidoA = await crearPedido('deposito_bancario', 2);
    asegurar((await stockActual()) === 8, 'Pedido A descuenta 2 unidades (stock 8)');

    const resPrepSinPago = await fetch(
      `${baseUrl}/api/staff/almacen/envios/${pedidoA.pedido.envio.id}/estado`,
      {
        method: 'PATCH',
        headers: authJson(tokenAlmacen),
        body: JSON.stringify({ estado: 'En preparación' })
      }
    );
    const dataPrepSinPago = (await resPrepSinPago.json()) as any;
    asegurar(
      resPrepSinPago.status === 409 && dataPrepSinPago.error.includes('no fue verificado'),
      'Almacen no prepara un pedido con pago Pendiente (409, mensaje claro)'
    );

    const resRechazo = await fetch(`${baseUrl}/api/staff/pagos/${pedidoA.pagoId}/rechazar`, {
      method: 'PATCH',
      headers: authJson(tokenVendedor),
      body: JSON.stringify({ motivo: 'Comprobante de deposito invalido' })
    });
    asegurar(resRechazo.status === 200, 'Rechazo de pago responde 200');

    const resPedidoA = await consultar(
      'SELECT estado, cancelado_at, motivo_cancelacion FROM pedidos WHERE id = $1',
      [pedidoA.pedido.id]
    );
    asegurar(
      resPedidoA.rows[0].estado === 'Cancelado' && resPedidoA.rows[0].cancelado_at !== null,
      'Rechazo cancela el pedido y registra fecha/motivo'
    );
    asegurar((await stockActual()) === 10, 'Rechazo repone exactamente las 2 unidades (stock 10)');
    asegurar(
      (await movimientosReposicion(pedidoA.pedido.id)) === 1,
      'Se registra un solo movimiento reposicion_cancelacion'
    );

    const resCancelarOtraVez = await fetch(
      `${baseUrl}/api/staff/pedidos/${pedidoA.pedido.id}/cancelar`,
      {
        method: 'POST',
        headers: authJson(tokenAdmin),
        body: JSON.stringify({ motivo: 'Segundo intento de cancelacion' })
      }
    );
    const dataCancelarOtraVez = (await resCancelarOtraVez.json()) as any;
    asegurar(
      resCancelarOtraVez.status === 200 && dataCancelarOtraVez.datos.cancelacion.yaCancelado === true,
      'Segunda cancelacion es idempotente (yaCancelado = true)'
    );
    asegurar((await stockActual()) === 10, 'Segunda cancelacion no repone stock de nuevo');
    asegurar(
      (await movimientosReposicion(pedidoA.pedido.id)) === 1,
      'El Kardex conserva un unico movimiento de reposicion'
    );

    const resRechazoRepetido = await fetch(`${baseUrl}/api/staff/pagos/${pedidoA.pagoId}/rechazar`, {
      method: 'PATCH',
      headers: authJson(tokenVendedor),
      body: JSON.stringify({ motivo: 'Reintento de rechazo' })
    });
    asegurar(resRechazoRepetido.status === 409, 'Rechazo repetido devuelve 409 sin tocar stock');

    const resAuditA = await consultar(
      `SELECT accion FROM auditoria
       WHERE (accion = 'RECHAZAR_PAGO' AND registro_id = $1)
          OR (accion = 'CANCELAR_PEDIDO' AND registro_id = $2)
          OR (accion = 'REPONER_STOCK' AND detalles->>'pedidoId' = $3)`,
      [pedidoA.pagoId, pedidoA.pedido.id, String(pedidoA.pedido.id)]
    );
    const accionesA = resAuditA.rows.map((r) => r.accion);
    asegurar(
      accionesA.includes('RECHAZAR_PAGO') &&
        accionesA.includes('CANCELAR_PEDIDO') &&
        accionesA.includes('REPONER_STOCK'),
      'Rechazo, cancelacion y reposicion quedan en auditoria'
    );

    // ------------------------------------------------------------------------
    // 2. CONTRA_ENTREGA PREPARA SIN PAGO APROBADO Y NO VENCE
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Contra entrega y bloqueo de cancelacion en transito ---');
    const pedidoB = await crearPedido('contra_entrega', 1);
    asegurar((await stockActual()) === 9, 'Pedido contra_entrega descuenta 1 unidad (stock 9)');

    const resVencidosB = await fetch(`${baseUrl}/api/staff/pagos/vencidos/cancelar`, {
      method: 'POST',
      headers: auth(tokenAdmin)
    });
    const dataVencidosB = (await resVencidosB.json()) as any;
    asegurar(
      resVencidosB.status === 200 && dataVencidosB.datos.total === 0,
      'El endpoint de vencidos no toca pagos contra_entrega'
    );

    // Bypass: almacen no puede entregar por la ruta vieja ni por la nueva
    const resEntregadoViejo = await fetch(
      `${baseUrl}/api/envios/${pedidoB.pedido.envio.id}/estado`,
      {
        method: 'PATCH',
        headers: authJson(tokenAlmacen),
        body: JSON.stringify({ estado: 'Entregado' })
      }
    );
    asegurar(resEntregadoViejo.status === 403, 'Ruta vieja bloquea Entregado para almacen (403)');

    const resEntregadoNuevo = await fetch(
      `${baseUrl}/api/staff/almacen/envios/${pedidoB.pedido.envio.id}/estado`,
      {
        method: 'PATCH',
        headers: authJson(tokenAlmacen),
        body: JSON.stringify({ estado: 'Entregado' })
      }
    );
    asegurar(resEntregadoNuevo.status === 403, 'Ruta nueva bloquea Entregado para almacen (403)');

    // Bypass: logistica no puede ajustar inventario por la ruta vieja ni la nueva
    const ajuste = JSON.stringify({
      tipo: 'entrada',
      cantidad: 1,
      motivo: 'Intento no autorizado de logistica'
    });
    const resAjusteViejo = await fetch(`${baseUrl}/api/inventario/ajustes/${varianteId}`, {
      method: 'POST',
      headers: authJson(tokenLogistica),
      body: ajuste
    });
    asegurar(resAjusteViejo.status === 403, 'Ruta vieja bloquea ajuste de inventario a logistica (403)');

    const resAjusteNuevo = await fetch(
      `${baseUrl}/api/staff/almacen/inventario/ajustes/${varianteId}`,
      {
        method: 'POST',
        headers: authJson(tokenLogistica),
        body: ajuste
      }
    );
    asegurar(resAjusteNuevo.status === 403, 'Ruta nueva bloquea ajuste de inventario a logistica (403)');

    const resPrepB = await fetch(
      `${baseUrl}/api/staff/almacen/envios/${pedidoB.pedido.envio.id}/estado`,
      {
        method: 'PATCH',
        headers: authJson(tokenAlmacen),
        body: JSON.stringify({ estado: 'En preparación' })
      }
    );
    asegurar(resPrepB.status === 200, 'Contra_entrega se prepara sin pago Aprobado (200)');

    const resEmpaqueB = await fetch(
      `${baseUrl}/api/staff/almacen/envios/${pedidoB.pedido.envio.id}/estado`,
      {
        method: 'PATCH',
        headers: authJson(tokenAlmacen),
        body: JSON.stringify({ estado: 'Empacado' })
      }
    );
    asegurar(resEmpaqueB.status === 200, 'Pedido contra_entrega avanza a Empacado');

    const resTransitoB = await fetch(
      `${baseUrl}/api/staff/logistica/envios/${pedidoB.pedido.envio.id}/estado`,
      {
        method: 'PATCH',
        headers: authJson(tokenLogistica),
        body: JSON.stringify({ estado: 'En tránsito' })
      }
    );
    asegurar(resTransitoB.status === 200, 'Pedido contra_entrega avanza a En transito');

    const resCancelarTransito = await fetch(
      `${baseUrl}/api/staff/pedidos/${pedidoB.pedido.id}/cancelar`,
      {
        method: 'POST',
        headers: authJson(tokenAdmin),
        body: JSON.stringify({ motivo: 'Intento de cancelar pedido ya despachado' })
      }
    );
    const dataCancelarTransito = (await resCancelarTransito.json()) as any;
    asegurar(
      resCancelarTransito.status === 409 && dataCancelarTransito.error.includes('despachado'),
      'No se puede cancelar un pedido En transito (409)'
    );
    asegurar((await stockActual()) === 9, 'El rechazo de cancelacion no altera el stock');

    // ------------------------------------------------------------------------
    // 3. VENCIMIENTO POR ENDPOINT ADMIN
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Vencimiento de pagos por endpoint admin ---');
    const pedidoC = await crearPedido('qr', 3);
    asegurar((await stockActual()) === 6, 'Pedido C descuenta 3 unidades (stock 6)');

    await consultar(
      "UPDATE pagos SET fecha_vencimiento = NOW() - interval '2 hours' WHERE id = $1",
      [pedidoC.pagoId]
    );

    const resVencidos = await fetch(`${baseUrl}/api/staff/pagos/vencidos/cancelar`, {
      method: 'POST',
      headers: auth(tokenAdmin)
    });
    const dataVencidos = (await resVencidos.json()) as any;
    asegurar(
      resVencidos.status === 200 && dataVencidos.datos.total === 1,
      'Endpoint admin cancela exactamente un pago vencido'
    );
    asegurar((await stockActual()) === 9, 'Vencimiento repone las 3 unidades (stock 9)');
    asegurar(
      (await movimientosReposicion(pedidoC.pedido.id)) === 1,
      'Vencimiento genera un unico movimiento de reposicion'
    );

    const resVencidosRepetido = await fetch(`${baseUrl}/api/staff/pagos/vencidos/cancelar`, {
      method: 'POST',
      headers: auth(tokenAdmin)
    });
    const dataVencidosRepetido = (await resVencidosRepetido.json()) as any;
    asegurar(
      dataVencidosRepetido.datos.total === 0 && (await stockActual()) === 9,
      'Segundo barrido de vencidos no vuelve a reponer stock'
    );

    const resAuditVencido = await consultar(
      "SELECT accion FROM auditoria WHERE accion = 'VENCER_PAGO' AND registro_id = $1",
      [pedidoC.pagoId]
    );
    asegurar(resAuditVencido.rows.length === 1, 'Vencimiento de pago queda auditado');

    // ------------------------------------------------------------------------
    // 4. VENCIMIENTO VERIFICADO AL CONSULTAR EL PEDIDO
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Verificacion de vencimiento al consultar pedido ---');
    const pedidoD = await crearPedido('deposito_bancario', 2);
    asegurar((await stockActual()) === 7, 'Pedido D descuenta 2 unidades (stock 7)');

    await consultar(
      "UPDATE pagos SET fecha_vencimiento = NOW() - interval '1 hour' WHERE id = $1",
      [pedidoD.pagoId]
    );

    const resDetalleD = await fetch(`${baseUrl}/api/pedidos/${pedidoD.pedido.id}`, {
      headers: auth(tokenCliente)
    });
    const dataDetalleD = (await resDetalleD.json()) as any;
    asegurar(
      resDetalleD.status === 200 && dataDetalleD.datos.pedido.estado === 'Cancelado',
      'Consultar el pedido detecta el vencimiento y lo muestra Cancelado'
    );
    asegurar((await stockActual()) === 9, 'La verificacion al consultar repone las 2 unidades');
    asegurar(
      (await movimientosReposicion(pedidoD.pedido.id)) === 1,
      'La verificacion al consultar registra una sola reposicion'
    );

    await fetch(`${baseUrl}/api/pedidos/${pedidoD.pedido.id}`, {
      headers: auth(tokenCliente)
    });
    asegurar(
      (await stockActual()) === 9 && (await movimientosReposicion(pedidoD.pedido.id)) === 1,
      'Consultar dos veces no duplica la reposicion'
    );

    console.log('\n============================================================');
    console.log(`Resultado final de la suite Bloque E: ${exitos} aprobadas, ${fallos} fallidas.`);
    console.log('============================================================\n');

    server.close(async () => {
      await limpiarDatosPrueba(
        productoId,
        varianteId,
        [adminId, vendedorId, almacenId, logisticaId, clienteId],
        pedidoIds,
        pagoIds
      );
      await cerrarPool();
      process.exit(fallos > 0 ? 1 : 0);
    });
  } catch (error) {
    console.error('Error critico durante la ejecucion de la suite Bloque E:', error);
    server.close(async () => {
      await limpiarDatosPrueba(
        productoId,
        varianteId,
        [adminId, vendedorId, almacenId, logisticaId, clienteId],
        pedidoIds,
        pagoIds
      );
      await cerrarPool();
      process.exit(1);
    });
  }
}

async function limpiarDatosPrueba(
  prodId: number | undefined,
  varId: number | undefined,
  userIds: number[],
  pedidos: number[],
  pagos: number[]
) {
  try {
    if (pedidos.length > 0) {
      const resEnvios = await consultar('SELECT id FROM envios WHERE pedido_id = ANY($1::int[])', [pedidos]);
      const envios = resEnvios.rows.map((e) => e.id);
      if (envios.length > 0) {
        await consultar('DELETE FROM entregas WHERE envio_id = ANY($1::int[])', [envios]);
        await consultar('DELETE FROM envio_eventos WHERE envio_id = ANY($1::int[])', [envios]);
        await consultar('DELETE FROM envios WHERE id = ANY($1::int[])', [envios]);
      }
      await consultar('DELETE FROM comprobantes_pago WHERE pago_id = ANY($1::int[])', [pagos]);
      await consultar('DELETE FROM pago_eventos WHERE pago_id = ANY($1::int[])', [pagos]);
      await consultar(
        `DELETE FROM auditoria
         WHERE usuario_id = ANY($1::int[])
            OR (tabla_afectada = 'pedidos' AND registro_id = ANY($2::int[]))
            OR (tabla_afectada = 'pagos' AND registro_id = ANY($3::int[]))
            OR (tabla_afectada = 'variantes' AND registro_id = $4)`,
        [userIds, pedidos, pagos, varId ?? -1]
      );
      await consultar('DELETE FROM pagos WHERE id = ANY($1::int[])', [pagos]);
      await consultar('DELETE FROM pedido_items WHERE pedido_id = ANY($1::int[])', [pedidos]);
      await consultar('DELETE FROM movimientos_inventario WHERE pedido_id = ANY($1::int[])', [pedidos]);
      await consultar('DELETE FROM pedidos WHERE id = ANY($1::int[])', [pedidos]);
    } else {
      await consultar('DELETE FROM auditoria WHERE usuario_id = ANY($1::int[])', [userIds]);
    }

    if (varId) {
      await consultar('DELETE FROM movimientos_inventario WHERE variante_id = $1', [varId]);
      await consultar('DELETE FROM variantes WHERE id = $1', [varId]);
    }
    if (prodId) {
      await consultar('DELETE FROM productos WHERE id = $1', [prodId]);
    }
    await consultar('DELETE FROM carritos WHERE usuario_id = ANY($1::int[])', [userIds]);
    await consultar('DELETE FROM auditoria WHERE usuario_id = ANY($1::int[])', [userIds]);
    await consultar('DELETE FROM usuarios WHERE id = ANY($1::int[])', [userIds]);
  } catch (err) {
    console.error('Nota: error menor durante la limpieza de datos de prueba E:', err);
  }
}

ejecutarPruebas();
