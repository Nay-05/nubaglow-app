/**
 * ============================================================================
 * NUBAGLOW APP - PRUEBA DE COMPROBANTE DE PAGO
 * ============================================================================
 * Valida:
 * 1. Carga valida del comprobante con referencia, fecha y monto declarado.
 * 2. Rechazo de un .exe renombrado a .png y de archivos sobre COMPROBANTE_MAX_MB.
 * 3. Fecha de deposito futura y monto invalido rechazados por Zod.
 * 4. GET del comprobante: sin sesion 401; almacen/logistica 403; dueno, vendedor
 *    y admin 200; otro cliente 403; cabeceras Content-Type, inline y nosniff.
 * 5. Detalle de pago con advertencia por monto distinto al total y por hash duplicado.
 * 6. Limpieza total de los datos de prueba.
 */

import jwt from 'jsonwebtoken';
import app from '../index';
import { consultar, cerrarPool } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_super_segura_nubaglow_2026';
process.env.JWT_SECRET = JWT_SECRET;

// PNG real de 1x1 transparente (firma PNG valida).
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
const PNG_BUFFER = Buffer.from(PNG_BASE64, 'base64');

function fechaHoy(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
    hoy.getDate()
  ).padStart(2, '0')}`;
}

function fechaManana(): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
    fecha.getDate()
  ).padStart(2, '0')}`;
}

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
  const pedidoIds: number[] = [];
  let productoId: number | undefined;

  try {
    // ------------------------------------------------------------------------
    // 1. Usuarios de prueba y tokens por rol
    // ------------------------------------------------------------------------
    const crearUsuario = async (nombre: string, rol: string, prefijo: string): Promise<number> => {
      const email = `${prefijo}_${sufijo}@nuba.bo`;
      const res = await consultar(
        `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
         VALUES ($1, $2, 'hash_test', $3, TRUE) RETURNING id`,
        [nombre, email, rol]
      );
      const id = res.rows[0].id;
      userIds.push(id);
      return id;
    };

    const tokenPara = (id: number, nombre: string, rol: string, prefijo: string): string =>
      jwt.sign(
        { id, nombre, email: `${prefijo}_${sufijo}@nuba.bo`, rol, activo: true },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

    const clienteAId = await crearUsuario('Cliente Comprobante A', 'cliente', 'comprobante_a');
    const clienteBId = await crearUsuario('Cliente Comprobante B', 'cliente', 'comprobante_b');
    const vendedorId = await crearUsuario('Vendedor Nuba', 'vendedor', 'comprobante_vend');
    const almacenId = await crearUsuario('Almacen Nuba', 'almacen', 'comprobante_alm');
    const logisticaId = await crearUsuario('Logistica Nuba', 'logistica', 'comprobante_log');
    const adminId = await crearUsuario('Admin Nuba', 'admin', 'comprobante_admin');

    const tokenClienteA = tokenPara(clienteAId, 'Cliente Comprobante A', 'cliente', 'comprobante_a');
    const tokenClienteB = tokenPara(clienteBId, 'Cliente Comprobante B', 'cliente', 'comprobante_b');
    const tokenVendedor = tokenPara(vendedorId, 'Vendedor Nuba', 'vendedor', 'comprobante_vend');
    const tokenAlmacen = tokenPara(almacenId, 'Almacen Nuba', 'almacen', 'comprobante_alm');
    const tokenLogistica = tokenPara(logisticaId, 'Logistica Nuba', 'logistica', 'comprobante_log');
    const tokenAdmin = tokenPara(adminId, 'Admin Nuba', 'admin', 'comprobante_admin');

    // ------------------------------------------------------------------------
    // 2. Producto y variante de prueba
    // ------------------------------------------------------------------------
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
       VALUES ($1, $2, 'Presentacion 30ml', 80.00, 20, 3, TRUE) RETURNING id`,
      [productoId, `SKU-COMP-${sufijo}`]
    );
    const varianteId = resVar.rows[0].id;

    const crearPedidoQr = async (token: string, nombre: string, prefijo: string): Promise<any> => {
      const res = await fetch(`${baseUrl}/api/pedidos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre_cliente: nombre,
          celular_cliente: '71234567',
          correo_cliente: `${prefijo}_${sufijo}@nuba.bo`,
          ciudad: 'Sucre',
          direccion: 'Calle Calvo #120, Zona Central',
          metodo_pago: 'qr_simple',
          items: [{ variante_id: varianteId, cantidad: 1 }]
        })
      });
      const data = (await res.json()) as any;
      asegurar(res.status === 201, `Pedido QR simple creado para ${nombre} (201)`);
      asegurar(
        data.datos?.pedido?.pago?.estado === 'Pendiente',
        `El pago de ${nombre} nace en estado Pendiente`
      );
      pedidoIds.push(data.datos.pedido.id);
      return data.datos.pedido;
    };

    const pedidoA = await crearPedidoQr(tokenClienteA, 'Cliente Comprobante A', 'comprobante_a');
    const pedidoB = await crearPedidoQr(tokenClienteB, 'Cliente Comprobante B', 'comprobante_b');
    const totalA = Number(pedidoA.total);
    const totalB = Number(pedidoB.total);
    const montoDistinto = Math.round((totalA - 5) * 100) / 100;

    const resPagoA = await consultar('SELECT id FROM pagos WHERE pedido_id = $1', [pedidoA.id]);
    const resPagoB = await consultar('SELECT id FROM pagos WHERE pedido_id = $1', [pedidoB.id]);
    const pagoAId = resPagoA.rows[0].id;
    const pagoBId = resPagoB.rows[0].id;

    const subir = (
      pedidoId: number,
      token: string,
      datos: {
        nombre_archivo?: string;
        mime_type?: string;
        contenido_base64?: string;
        referencia?: string;
        fecha_deposito?: string;
        monto_pagado?: number;
      }
    ) =>
      fetch(`${baseUrl}/api/pedidos/${pedidoId}/comprobante`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre_archivo: datos.nombre_archivo ?? 'comprobante-qr.png',
          mime_type: datos.mime_type ?? 'image/png',
          contenido_base64: datos.contenido_base64 ?? PNG_BASE64,
          referencia: datos.referencia ?? 'OP-123456',
          fecha_deposito: datos.fecha_deposito ?? fechaHoy(),
          monto_pagado: datos.monto_pagado ?? 90
        })
      });

    // ------------------------------------------------------------------------
    // 3. Carga valida con monto distinto al total (total del pedido: 95 Bs.)
    // ------------------------------------------------------------------------
    const resComprobante = await subir(pedidoA.id, tokenClienteA, {
      referencia: 'OP-QR-998877',
      fecha_deposito: fechaHoy(),
      monto_pagado: montoDistinto
    });
    const dataComprobante = (await resComprobante.json()) as any;
    asegurar(resComprobante.status === 201, 'El cliente dueno sube el comprobante (201)');
    asegurar(
      dataComprobante.datos?.comprobante?.estado === 'En verificación',
      'El pago pasa a En verificación al recibir el comprobante'
    );
    asegurar(
      dataComprobante.datos?.comprobante?.referencia === 'OP-QR-998877',
      'La referencia declarada se devuelve en la respuesta'
    );
    const comprobanteId = dataComprobante.datos.comprobante.comprobanteId;

    const resPagoDb = await consultar(
      `SELECT estado, comprobante_url AS "comprobanteUrl"
       FROM pagos WHERE pedido_id = $1`,
      [pedidoA.id]
    );
    asegurar(resPagoDb.rows[0].estado === 'En verificación', 'La BD registra el pago En verificación');
    asegurar(
      typeof resPagoDb.rows[0].comprobanteUrl === 'string' &&
        resPagoDb.rows[0].comprobanteUrl.startsWith('data:image/png;base64,'),
      'El comprobante queda guardado como data URL PNG'
    );

    const resComprobantes = await consultar(
      `SELECT id, nombre_archivo AS "nombreArchivo", mime_type AS "mimeType",
              tamano_bytes AS "tamanoBytes", hash_sha256 AS "hashSha256",
              referencia, TO_CHAR(fecha_deposito, 'YYYY-MM-DD') AS "fechaDeposito",
              monto_pagado AS "montoPagado", subido_por AS "subidoPor"
       FROM comprobantes_pago WHERE pago_id = $1`,
      [pagoAId]
    );
    asegurar(resComprobantes.rows.length === 1, 'Se guardo un registro en comprobantes_pago');
    asegurar(
      resComprobantes.rows[0].mimeType === 'image/png' &&
        resComprobantes.rows[0].tamanoBytes > 0 &&
        /^[a-f0-9]{64}$/.test(resComprobantes.rows[0].hashSha256) &&
        Number(resComprobantes.rows[0].subidoPor) === clienteAId,
      'El comprobante guarda MIME, tamano, hash SHA-256 y usuario que lo subio'
    );
    asegurar(
      resComprobantes.rows[0].referencia === 'OP-QR-998877' &&
        resComprobantes.rows[0].fechaDeposito === fechaHoy() &&
        Number(resComprobantes.rows[0].montoPagado) === montoDistinto,
      'Se guardan referencia, fecha de deposito y monto pagado declarados'
    );

    // ------------------------------------------------------------------------
    // 4. GET del comprobante y permisos
    // ------------------------------------------------------------------------
    const urlComprobante = `${baseUrl}/api/comprobantes/${comprobanteId}`;

    const resSinSesion = await fetch(urlComprobante);
    asegurar(resSinSesion.status === 401, 'Sin sesion el GET del comprobante responde 401');

    const resAlmacen = await fetch(urlComprobante, {
      headers: { Authorization: `Bearer ${tokenAlmacen}` }
    });
    asegurar(resAlmacen.status === 403, 'Almacen no puede ver el comprobante (403)');

    const resLogistica = await fetch(urlComprobante, {
      headers: { Authorization: `Bearer ${tokenLogistica}` }
    });
    asegurar(resLogistica.status === 403, 'Logistica no puede ver el comprobante (403)');

    const resOtroCliente = await fetch(urlComprobante, {
      headers: { Authorization: `Bearer ${tokenClienteB}` }
    });
    asegurar(resOtroCliente.status === 403, 'Otro cliente no puede ver el comprobante (403)');

    const resDueno = await fetch(urlComprobante, {
      headers: { Authorization: `Bearer ${tokenClienteA}` }
    });
    asegurar(resDueno.status === 200, 'El cliente dueno puede ver el comprobante (200)');
    asegurar(
      (resDueno.headers.get('content-type') || '').toLowerCase().startsWith('image/png') &&
        (resDueno.headers.get('content-disposition') || '').startsWith('inline;') &&
        (resDueno.headers.get('x-content-type-options') || '').toLowerCase() === 'nosniff',
      'El GET responde Content-Type validado, Content-Disposition inline y nosniff'
    );

    const resVendedor = await fetch(urlComprobante, {
      headers: { Authorization: `Bearer ${tokenVendedor}` }
    });
    asegurar(resVendedor.status === 200, 'Vendedor si puede ver el comprobante (200)');

    const resAdmin = await fetch(urlComprobante, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    asegurar(resAdmin.status === 200, 'Admin si puede ver el comprobante (200)');

    // ------------------------------------------------------------------------
    // 5. Detalle de pago para staff: monto distinto y datos declarados
    // ------------------------------------------------------------------------
    const resDetalleA = await fetch(`${baseUrl}/api/staff/pagos/${pagoAId}`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` }
    });
    const dataDetalleA = (await resDetalleA.json()) as any;
    const detalleA = dataDetalleA.datos?.pago;
    asegurar(resDetalleA.status === 200, 'Vendedor consulta el detalle del pago (200)');
    asegurar(
      detalleA?.totalPedido === totalA &&
        detalleA?.comprobantes?.[0]?.montoPagado === montoDistinto &&
        detalleA?.comprobantes?.[0]?.montoCoincide === false &&
        typeof detalleA?.comprobantes?.[0]?.advertenciaMonto === 'string',
      'El detalle muestra total, monto declarado distinto y su advertencia'
    );
    asegurar(
      detalleA?.comprobantes?.[0]?.referencia === 'OP-QR-998877' &&
        detalleA?.comprobantes?.[0]?.fechaDeposito === fechaHoy(),
      'El detalle muestra la referencia y la fecha del deposito'
    );

    // ------------------------------------------------------------------------
    // 6. Validaciones de archivo y datos declarados
    // ------------------------------------------------------------------------
    const exeRenombrado = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]).toString(
      'base64'
    );
    const resExe = await subir(pedidoA.id, tokenClienteA, {
      nombre_archivo: 'virus.png',
      mime_type: 'image/png',
      contenido_base64: exeRenombrado,
      monto_pagado: 90
    });
    asegurar(resExe.status === 400, 'Un .exe renombrado a .png es rechazado (400)');

    const archivoGrande = Buffer.concat([PNG_BUFFER, Buffer.alloc(2 * 1024 * 1024)]).toString(
      'base64'
    );
    const resGrande = await subir(pedidoA.id, tokenClienteA, {
      contenido_base64: archivoGrande,
      monto_pagado: 90
    });
    asegurar(
      resGrande.status === 400,
      'Un archivo mayor a COMPROBANTE_MAX_MB (2 MB) es rechazado (400)'
    );

    const resFechaFutura = await subir(pedidoA.id, tokenClienteA, {
      fecha_deposito: fechaManana(),
      monto_pagado: 90
    });
    asegurar(resFechaFutura.status === 400, 'Una fecha de deposito futura es rechazada (400)');

    const resMontoInvalido = await subir(pedidoA.id, tokenClienteA, {
      monto_pagado: 0
    });
    asegurar(resMontoInvalido.status === 400, 'Un monto pagado igual a cero es rechazado (400)');

    const resMimeFalso = await subir(pedidoA.id, tokenClienteA, {
      nombre_archivo: 'comprobante.pdf',
      mime_type: 'application/pdf',
      monto_pagado: 90
    });
    asegurar(
      resMimeFalso.status === 400,
      'Un archivo cuyo contenido no coincide con el MIME declarado es rechazado (400)'
    );

    // ------------------------------------------------------------------------
    // 7. Mismo archivo (SHA-256) en otro pedido: no se rechaza, se advierte
    // ------------------------------------------------------------------------
    const resDuplicado = await subir(pedidoB.id, tokenClienteB, {
      referencia: 'OP-QR-998877',
      fecha_deposito: fechaHoy(),
      monto_pagado: totalB
    });
    const dataDuplicado = (await resDuplicado.json()) as any;
    asegurar(resDuplicado.status === 201, 'El mismo archivo en otro pedido no se rechaza (201)');
    asegurar(
      dataDuplicado.datos?.comprobante?.hashDuplicado === true &&
        typeof dataDuplicado.datos?.comprobante?.advertenciaHash === 'string',
      'La respuesta marca el hash como duplicado en otro pedido'
    );

    const resDetalleB = await fetch(`${baseUrl}/api/staff/pagos/${pagoBId}`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` }
    });
    const dataDetalleB = (await resDetalleB.json()) as any;
    const detalleB = dataDetalleB.datos?.pago;
    asegurar(
      resDetalleB.status === 200 &&
        detalleB?.comprobantes?.[0]?.hashDuplicado === true &&
        typeof detalleB?.comprobantes?.[0]?.advertenciaHash === 'string',
      'El detalle del pago advierte que el archivo ya fue subido en otro pedido'
    );
    asegurar(
      detalleB?.comprobantes?.[0]?.montoCoincide === true &&
        detalleB?.comprobantes?.[0]?.advertenciaMonto === null,
      'Si el monto declarado coincide con el total, no hay advertencia de monto'
    );
  } finally {
    await limpiarDatos(server, pedidoIds, productoId, userIds);
    await cerrarPool();
  }

  console.log(`\nResultado: ${exitos} prueba(s) exitosa(s), ${fallos} fallo(s).`);
  process.exit(fallos > 0 ? 1 : 0);
}

async function limpiarDatos(
  server: any,
  pedidoIds: number[],
  productoId: number | undefined,
  userIds: number[]
): Promise<void> {
  try {
    if (pedidoIds.length > 0) {
      await consultar(
        'DELETE FROM comprobantes_pago WHERE pago_id IN (SELECT id FROM pagos WHERE pedido_id = ANY($1::int[]))',
        [pedidoIds]
      );
      await consultar(
        'DELETE FROM pago_eventos WHERE pago_id IN (SELECT id FROM pagos WHERE pedido_id = ANY($1::int[]))',
        [pedidoIds]
      );
      await consultar(
        'DELETE FROM envio_eventos WHERE envio_id IN (SELECT id FROM envios WHERE pedido_id = ANY($1::int[]))',
        [pedidoIds]
      );
      await consultar('DELETE FROM envios WHERE pedido_id = ANY($1::int[])', [pedidoIds]);
      await consultar('DELETE FROM pedido_items WHERE pedido_id = ANY($1::int[])', [pedidoIds]);
      await consultar('DELETE FROM movimientos_inventario WHERE pedido_id = ANY($1::int[])', [pedidoIds]);
      await consultar('DELETE FROM pagos WHERE pedido_id = ANY($1::int[])', [pedidoIds]);
      await consultar('DELETE FROM pedidos WHERE id = ANY($1::int[])', [pedidoIds]);
    }

    if (productoId) {
      const resVariantes = await consultar('SELECT id FROM variantes WHERE producto_id = $1', [
        productoId
      ]);
      const varianteIds = resVariantes.rows.map((v) => v.id);

      if (varianteIds.length > 0) {
        await consultar('DELETE FROM movimientos_inventario WHERE variante_id = ANY($1::int[])', [
          varianteIds
        ]);
        await consultar('DELETE FROM carrito_items WHERE variante_id = ANY($1::int[])', [
          varianteIds
        ]);
        await consultar('DELETE FROM pedido_items WHERE variante_id = ANY($1::int[])', [
          varianteIds
        ]);
        await consultar('DELETE FROM resenas WHERE producto_id = $1', [productoId]);
        await consultar('DELETE FROM imagenes_producto WHERE producto_id = $1', [productoId]);
        await consultar('DELETE FROM variantes WHERE id = ANY($1::int[])', [varianteIds]);
      }

      await consultar('DELETE FROM productos WHERE id = $1', [productoId]);
    }

    if (userIds.length > 0) {
      await consultar(
        'DELETE FROM carrito_items WHERE carrito_id IN (SELECT id FROM carritos WHERE usuario_id = ANY($1::int[]))',
        [userIds]
      );
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
