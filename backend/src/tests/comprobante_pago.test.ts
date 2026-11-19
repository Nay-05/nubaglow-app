/**
 * ============================================================================
 * NUBAGLOW APP - PRUEBA DE COMPROBANTE DE PAGO
 * ============================================================================
 * Valida el flujo de carga del comprobante para QR simple / deposito:
 * 1. El cliente dueno sube un PNG valido y el pago pasa a 'En verificación'.
 * 2. Se guarda el archivo en comprobantes_pago con hash y auditoria.
 * 3. Otro cliente no puede cargar el comprobante de un pedido ajeno (403).
 * 4. Un archivo cuyo contenido no coincide con el MIME declarado se rechaza (400).
 * 5. Limpieza total de los datos de prueba.
 */

import jwt from 'jsonwebtoken';
import app from '../index';
import { consultar, cerrarPool } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_super_segura_nubaglow_2026';
process.env.JWT_SECRET = JWT_SECRET;

// PNG real de 1x1 transparente (firma PNG valida).
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';

async function ejecutarPruebas(): Promise<void> {
  console.log('Iniciando prueba de comprobante de pago...');

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  let exitos = 0;
  let fallos = 0;

  function asegurar(condicion: boolean, descripcion: string): void {
    if (condicion) {
      console.log(`[PASS] ${descripcion}`);
      exitos++;
    } else {
      console.error(`[FAIL] ${descripcion}`);
      fallos++;
    }
  }

  const sufijo = Date.now().toString().slice(-6);
  const userIds: number[] = [];
  let productoId: number | undefined;
  let pedidoId: number | undefined;

  try {
    // 1. Usuarios de prueba
    const resClienteA = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Cliente Comprobante A', $1, 'hash_test', 'cliente', TRUE) RETURNING id`,
      [`comprobante_a_${sufijo}@nuba.bo`]
    );
    const clienteAId = resClienteA.rows[0].id;
    userIds.push(clienteAId);

    const resClienteB = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Cliente Comprobante B', $1, 'hash_test', 'cliente', TRUE) RETURNING id`,
      [`comprobante_b_${sufijo}@nuba.bo`]
    );
    const clienteBId = resClienteB.rows[0].id;
    userIds.push(clienteBId);

    const tokenClienteA = jwt.sign(
      {
        id: clienteAId,
        nombre: 'Cliente Comprobante A',
        email: `comprobante_a_${sufijo}@nuba.bo`,
        rol: 'cliente',
        activo: true
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const tokenClienteB = jwt.sign(
      {
        id: clienteBId,
        nombre: 'Cliente Comprobante B',
        email: `comprobante_b_${sufijo}@nuba.bo`,
        rol: 'cliente',
        activo: true
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Producto y variante de prueba
    const resCat = await consultar('SELECT id FROM categorias LIMIT 1');
    if (resCat.rows.length === 0) {
      throw new Error('No hay categorias en la BD para ejecutar la prueba');
    }

    const resProd = await consultar(
      `INSERT INTO productos
       (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo)
       VALUES ($1, $2, $3, 'Nuba Test', 'Todo tipo', 'Descripcion test', 'Ingredientes test', 'Modo test', TRUE)
       RETURNING id`,
      [resCat.rows[0].id, `Producto Comprobante ${sufijo}`, `producto-comprobante-${sufijo}`]
    );
    productoId = resProd.rows[0].id;

    const resVar = await consultar(
      `INSERT INTO variantes (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Presentacion 30ml', 80.00, 10, 3, TRUE) RETURNING id`,
      [productoId, `SKU-COMP-${sufijo}`]
    );
    const varianteId = resVar.rows[0].id;

    // 3. Crear pedido con pago QR simple (queda Pendiente hasta subir comprobante)
    const resPedido = await fetch(`${baseUrl}/api/pedidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClienteA}`
      },
      body: JSON.stringify({
        nombre_cliente: 'Cliente Comprobante A',
        celular_cliente: '71234567',
        correo_cliente: `comprobante_a_${sufijo}@nuba.bo`,
        ciudad: 'Sucre',
        direccion: 'Calle Calvo #120, Zona Central',
        metodo_pago: 'qr_simple',
        items: [{ variante_id: varianteId, cantidad: 1 }]
      })
    });
    const dataPedido = (await resPedido.json()) as any;
    asegurar(resPedido.status === 201, 'Pedido QR simple creado (201)');
    asegurar(
      dataPedido.datos?.pedido?.pago?.estado === 'Pendiente',
      'El pago nace en estado Pendiente hasta recibir el comprobante'
    );

    pedidoId = dataPedido.datos.pedido.id;

    // 4. Cliente B intenta cargar el comprobante del pedido de A -> 403
    const resAjeno = await fetch(`${baseUrl}/api/pedidos/${pedidoId}/comprobante`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClienteB}`
      },
      body: JSON.stringify({
        nombre_archivo: 'comprobante.png',
        mime_type: 'image/png',
        contenido_base64: PNG_BASE64
      })
    });
    asegurar(resAjeno.status === 403, 'Otro cliente no puede subir el comprobante de un pedido ajeno (403)');

    // 5. MIME declarado distinto al contenido real -> 400
    const resMimeFalso = await fetch(`${baseUrl}/api/pedidos/${pedidoId}/comprobante`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClienteA}`
      },
      body: JSON.stringify({
        nombre_archivo: 'comprobante.pdf',
        mime_type: 'application/pdf',
        contenido_base64: PNG_BASE64
      })
    });
    asegurar(resMimeFalso.status === 400, 'Se rechaza un archivo cuyo contenido no coincide con el MIME declarado (400)');

    // 6. Carga valida del comprobante
    const resComprobante = await fetch(`${baseUrl}/api/pedidos/${pedidoId}/comprobante`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClienteA}`
      },
      body: JSON.stringify({
        nombre_archivo: 'comprobante-qr.png',
        mime_type: 'image/png',
        contenido_base64: PNG_BASE64
      })
    });
    const dataComprobante = (await resComprobante.json()) as any;
    asegurar(resComprobante.status === 201, 'El cliente dueno sube el comprobante (201)');
    asegurar(
      dataComprobante.datos?.comprobante?.estado === 'En verificación',
      'El pago pasa a En verificación al recibir el comprobante'
    );

    const resPago = await consultar(
      `SELECT estado, comprobante_url AS "comprobanteUrl"
       FROM pagos WHERE pedido_id = $1`,
      [pedidoId]
    );
    asegurar(
      resPago.rows[0].estado === 'En verificación',
      'La BD registra el pago En verificación'
    );
    asegurar(
      typeof resPago.rows[0].comprobanteUrl === 'string' &&
        resPago.rows[0].comprobanteUrl.startsWith('data:image/png;base64,'),
      'El comprobante queda guardado como data URL PNG'
    );

    const resComprobantes = await consultar(
      `SELECT id, nombre_archivo AS "nombreArchivo", mime_type AS "mimeType",
              tamano_bytes AS "tamanoBytes", hash_sha256 AS "hashSha256", subido_por AS "subidoPor"
       FROM comprobantes_pago WHERE pago_id = (SELECT id FROM pagos WHERE pedido_id = $1)`,
      [pedidoId]
    );
    asegurar(resComprobantes.rows.length === 1, 'Se guardo un registro en comprobantes_pago');
    asegurar(
      resComprobantes.rows[0].mimeType === 'image/png' &&
        resComprobantes.rows[0].tamanoBytes > 0 &&
        /^[a-f0-9]{64}$/.test(resComprobantes.rows[0].hashSha256) &&
        Number(resComprobantes.rows[0].subidoPor) === clienteAId,
      'El comprobante guarda MIME, tamano, hash SHA-256 y usuario que lo subio'
    );

    const resEvento = await consultar(
      `SELECT pe.estado_nuevo AS "estadoNuevo", pe.usuario_id AS "usuarioId"
       FROM pago_eventos pe
       WHERE pe.pago_id = (SELECT id FROM pagos WHERE pedido_id = $1)
       ORDER BY pe.id DESC LIMIT 1`,
      [pedidoId]
    );
    asegurar(
      resEvento.rows[0]?.estadoNuevo === 'En verificación' &&
        Number(resEvento.rows[0]?.usuarioId) === clienteAId,
      'pago_eventos registra la transicion a En verificación con el usuario'
    );

    const resAuditoria = await consultar(
      `SELECT accion, usuario_id AS "usuarioId"
       FROM auditoria
       WHERE accion = 'SUBIR_COMPROBANTE_PAGO' AND usuario_id = $1
       ORDER BY id DESC LIMIT 1`,
      [clienteAId]
    );
    asegurar(
      resAuditoria.rows.length === 1,
      'La accion SUBIR_COMPROBANTE_PAGO queda registrada en auditoria'
    );
  } finally {
    await limpiarDatos(server, pedidoId, productoId, userIds);
    await cerrarPool();
  }

  console.log(`\nResultado: ${exitos} prueba(s) exitosa(s), ${fallos} fallo(s).`);
  process.exit(fallos > 0 ? 1 : 0);
}

async function limpiarDatos(
  server: any,
  pedidoId: number | undefined,
  productoId: number | undefined,
  userIds: number[]
): Promise<void> {
  try {
    if (pedidoId) {
      await consultar(
        'DELETE FROM comprobantes_pago WHERE pago_id IN (SELECT id FROM pagos WHERE pedido_id = $1)',
        [pedidoId]
      );
      await consultar(
        'DELETE FROM pago_eventos WHERE pago_id IN (SELECT id FROM pagos WHERE pedido_id = $1)',
        [pedidoId]
      );
      await consultar('DELETE FROM envio_eventos WHERE envio_id IN (SELECT id FROM envios WHERE pedido_id = $1)', [pedidoId]);
      await consultar('DELETE FROM envios WHERE pedido_id = $1', [pedidoId]);
      await consultar('DELETE FROM pedido_items WHERE pedido_id = $1', [pedidoId]);
      await consultar('DELETE FROM movimientos_inventario WHERE pedido_id = $1', [pedidoId]);
      await consultar('DELETE FROM pagos WHERE pedido_id = $1', [pedidoId]);
      await consultar('DELETE FROM pedidos WHERE id = $1', [pedidoId]);
    }

    if (productoId) {
      const resVariantes = await consultar('SELECT id FROM variantes WHERE producto_id = $1', [productoId]);
      const varianteIds = resVariantes.rows.map((v) => v.id);

      if (varianteIds.length > 0) {
        await consultar('DELETE FROM movimientos_inventario WHERE variante_id = ANY($1::int[])', [varianteIds]);
        await consultar('DELETE FROM carrito_items WHERE variante_id = ANY($1::int[])', [varianteIds]);
        await consultar('DELETE FROM pedido_items WHERE variante_id = ANY($1::int[])', [varianteIds]);
        await consultar('DELETE FROM resenas WHERE producto_id = $1', [productoId]);
        await consultar('DELETE FROM imagenes_producto WHERE producto_id = $1', [productoId]);
        await consultar('DELETE FROM variantes WHERE id = ANY($1::int[])', [varianteIds]);
      }

      await consultar('DELETE FROM productos WHERE id = $1', [productoId]);
    }

    if (userIds.length > 0) {
      await consultar('DELETE FROM carrito_items WHERE carrito_id IN (SELECT id FROM carritos WHERE usuario_id = ANY($1::int[]))', [userIds]);
      await consultar('DELETE FROM carritos WHERE usuario_id = ANY($1::int[])', [userIds]);
      await consultar('DELETE FROM auditoria WHERE usuario_id = ANY($1::int[])', [userIds]);
      await consultar('DELETE FROM usuarios WHERE id = ANY($1::int[])', [userIds]);
    }
  } catch (error) {
    console.error('Nota: error durante la limpieza de la prueba de comprobante:', error);
  } finally {
    server.close();
  }
}

ejecutarPruebas().catch((error) => {
  console.error('Error critico en la prueba de comprobante:', error);
  process.exit(1);
});
