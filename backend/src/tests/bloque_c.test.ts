/**
 * ============================================================================
 * NUBAGLOW APP - SUITE DE PRUEBAS AUTOMATIZADAS: BLOQUE C
 * ============================================================================
 * Valida:
 * 1. Carrito persistente en BD para clientes (agregar, modificar, eliminar, vaciar).
 * 2. Creacion de pedido exitoso en UNA sola transaccion atomica con conTransaccion.
 * 3. Descuento de stock en BD y codigo unico NB-2026-XXXX.
 * 4. Precios manipulados enviados por el cliente son totalmente ignorados (calculo en servidor).
 * 5. Stock insuficiente produce error 400 y rollback integro sin cambios residuales.
 * 6. Concurrencia: compras simultaneas del ultimo articulo en stock con SELECT ... FOR UPDATE.
 * 7. Privacidad: un cliente nunca puede ver pedidos de otro (403).
 * 8. Transiciones de envio estrictas (Pendiente -> En preparacion -> En transito -> Entregado),
 *    bloqueo de saltos y retrocesos, proteccion RBAC (cliente no puede cambiar estados).
 * 9. Resenas: solo para clientes con pedido Entregado, maximo una por producto y cliente.
 * 10. Limpieza final de datos de prueba sin contaminar la BD.
 */

import jwt from 'jsonwebtoken';
import app from '../index';
import { consultar, conTransaccion, cerrarPool } from '../db';
import {
  eliminarHistorialDePedidosDePrueba,
  eliminarOInactivarProductoDePrueba,
  eliminarReferenciasDeUsuariosDePrueba
} from './limpieza';

const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_super_segura_nubaglow_2026';
process.env.JWT_SECRET = JWT_SECRET;

async function ejecutarPruebas() {
  console.log('Iniciando suite de pruebas automatizadas: Bloque C (Compra, Pedidos, Envio y Resenas)...');

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

  // 1. Usuarios para pruebas
  let clienteAId: number;
  let clienteBId: number;
  let almacenId: number;
  let logisticaId: number;

  let tokenClienteA: string;
  let tokenClienteB: string;
  let tokenAlmacen: string;
  let tokenLogistica: string;

  // 2. Articulos para pruebas
  let productoTestId: number;
  let varianteConcurrenteId: number; // Stock = 1
  let varianteNormalId: number;      // Stock = 10

  let pedidoCreadoId: number;
  let codigoRastreoCreado: string;
  let envioCreadoId: number;

  try {
    // ------------------------------------------------------------------------
    // PREPARACION DE DATOS TEMPORALES
    // ------------------------------------------------------------------------
    // Clientes y Staff de prueba
    const resUserA = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Camila Test A', $1, 'hash_test', 'cliente', TRUE) RETURNING id`,
      [`cliente_a_${sufijo}@nuba.bo`]
    );
    clienteAId = resUserA.rows[0].id;

    const resUserB = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Laura Test B', $1, 'hash_test', 'cliente', TRUE) RETURNING id`,
      [`cliente_b_${sufijo}@nuba.bo`]
    );
    clienteBId = resUserB.rows[0].id;

    const resUserAlmacen = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Almacen Nuba', $1, 'hash_test', 'almacen', TRUE) RETURNING id`,
      [`almacen_${sufijo}@nuba.bo`]
    );
    almacenId = resUserAlmacen.rows[0].id;

    const resUserLogistica = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Logistica Nuba', $1, 'hash_test', 'logistica', TRUE) RETURNING id`,
      [`logistica_${sufijo}@nuba.bo`]
    );
    logisticaId = resUserLogistica.rows[0].id;

    tokenClienteA = jwt.sign(
      { id: clienteAId, nombre: 'Camila Test A', email: `cliente_a_${sufijo}@nuba.bo`, rol: 'cliente', activo: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    tokenClienteB = jwt.sign(
      { id: clienteBId, nombre: 'Laura Test B', email: `cliente_b_${sufijo}@nuba.bo`, rol: 'cliente', activo: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    tokenAlmacen = jwt.sign(
      { id: almacenId, nombre: 'Almacen Nuba', email: `almacen_${sufijo}@nuba.bo`, rol: 'almacen', activo: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    tokenLogistica = jwt.sign(
      { id: logisticaId, nombre: 'Logistica Nuba', email: `logistica_${sufijo}@nuba.bo`, rol: 'logistica', activo: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Obtener una categoria existente
    const resCat = await consultar('SELECT id FROM categorias LIMIT 1');
    const categoriaId = resCat.rows[0].id;

    // Crear producto y variantes de prueba
    const resProd = await consultar(
      `INSERT INTO productos 
       (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo)
       VALUES ($1, $2, $3, 'Nuba Test', 'Todo tipo', 'Descripcion test', 'Ingredientes test', 'Modo test', TRUE)
       RETURNING id`,
      [categoriaId, `Serum Test ${sufijo}`, `serum-test-${sufijo}`]
    );
    productoTestId = resProd.rows[0].id;

    // Variante 1: Stock = 1 (para prueba de concurrencia)
    const resVar1 = await consultar(
      `INSERT INTO variantes (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Edicion Unica 30ml', 150.00, 1, 2, TRUE) RETURNING id`,
      [productoTestId, `SKU-UNICO-${sufijo}`]
    );
    varianteConcurrenteId = resVar1.rows[0].id;

    // Variante 2: Stock = 10, Precio = 60.00 Bs
    const resVar2 = await consultar(
      `INSERT INTO variantes (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Presentacion Regular 50ml', 60.00, 10, 3, TRUE) RETURNING id`,
      [productoTestId, `SKU-REGULAR-${sufijo}`]
    );
    varianteNormalId = resVar2.rows[0].id;

    // ------------------------------------------------------------------------
    // 1. PRUEBAS DE CARRITO PERSISTENTE
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Pruebas de Carrito Persistente ---');
    // Agregar item al carrito
    const resAddCart = await fetch(`${baseUrl}/api/carrito/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClienteA}`
      },
      body: JSON.stringify({ variante_id: varianteNormalId, cantidad: 2 })
    });
    const dataAddCart = (await resAddCart.json()) as any;
    asegurar(resAddCart.status === 200, 'Cliente A agrega variante al carrito (200 OK)');
    asegurar(
      dataAddCart.datos.carrito.items.length === 1 && dataAddCart.datos.carrito.items[0].cantidad === 2,
      'El item figura en el carrito con cantidad 2'
    );
    asegurar(
      dataAddCart.datos.carrito.subtotal === 120.00,
      'El subtotal del carrito se calcula exactamente: 2 * 60.00 = 120.00 Bs'
    );
    const cartItemId = dataAddCart.datos.carrito.items[0].id;

    // Modificar cantidad a 4
    const resPatchCart = await fetch(`${baseUrl}/api/carrito/items/${cartItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClienteA}`
      },
      body: JSON.stringify({ cantidad: 4 })
    });
    const dataPatchCart = (await resPatchCart.json()) as any;
    asegurar(resPatchCart.status === 200, 'Cliente A actualiza cantidad en carrito');
    asegurar(
      dataPatchCart.datos.carrito.subtotal === 240.00,
      'Subtotal actualizado a 4 * 60.00 = 240.00 Bs'
    );

    // Intentar superar el stock disponible (stock es 10, pedir 15) -> 400
    const resExcesoStock = await fetch(`${baseUrl}/api/carrito/items/${cartItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClienteA}`
      },
      body: JSON.stringify({ cantidad: 15 })
    });
    asegurar(resExcesoStock.status === 400, 'Rechazo al intentar solicitar cantidad mayor al stock en carrito (400)');

    // ------------------------------------------------------------------------
    // 2. CREACION DE PEDIDO Y PRECIOS MANIPULADOS IGNORADOS
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Creacion de Pedido y Calculo Servidor ---');
    // Cliente envia intencionalmente precios adulterados en el payload (precio 1.00 Bs y total 5.00 Bs)
    const payloadCompraManipulada = {
      nombre_cliente: 'Camila Test A',
      celular_cliente: '71234567',
      correo_cliente: `cliente_a_${sufijo}@nuba.bo`,
      ciudad: 'Sucre',
      direccion: 'Calle Calvo #120, Zona Central',
      metodo_pago: 'contra_entrega',
      items: [{ variante_id: varianteNormalId, cantidad: 2 }],
      // Campos adulterados que el servidor DEBE ignorar por completo
      precio_unitario: 1.00,
      subtotal: 2.00,
      costo_envio: 0.00,
      total: 2.00
    };

    const resCrearPedido = await fetch(`${baseUrl}/api/pedidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClienteA}`
      },
      body: JSON.stringify(payloadCompraManipulada)
    });
    const dataCrearPedido = (await resCrearPedido.json()) as any;
    asegurar(resCrearPedido.status === 201, 'Pedido creado exitosamente (201 Creado)');

    const pedido = dataCrearPedido.datos.pedido;
    pedidoCreadoId = pedido.id;
    codigoRastreoCreado = pedido.codigoRastreo;
    envioCreadoId = pedido.envio.id;

    // Validar formato del codigo de rastreo NB-2026-XXXX
    const regexRastreo = /^NB-2026-\d{4,5}$/;
    asegurar(
      regexRastreo.test(codigoRastreoCreado),
      `Codigo de rastreo generado cumple formato estricto: ${codigoRastreoCreado}`
    );

    // Validar calculo estricto del servidor (2 * 60 = 120 + 15 envio = 135 Bs)
    asegurar(
      pedido.subtotal === 120.00 && pedido.total === 135.00,
      `Precios manipulados fueron ignorados: subtotal real es ${pedido.subtotal} Bs y total es ${pedido.total} Bs`
    );

    // Validar que el stock se haya descontado en la BD (estaba en 10, ahora debe estar en 8)
    const resStockPost = await consultar('SELECT stock FROM variantes WHERE id = $1', [varianteNormalId]);
    asegurar(
      resStockPost.rows[0].stock === 8,
      'Stock en base de datos descontado atómicamente de 10 a 8'
    );

    // Validar registro en Kardex movimientos_inventario
    const resKardex = await consultar(
      'SELECT tipo, cantidad, stock_anterior, stock_nuevo FROM movimientos_inventario WHERE variante_id = $1 ORDER BY id DESC LIMIT 1',
      [varianteNormalId]
    );
    asegurar(
      resKardex.rows[0].tipo === 'venta_web' && resKardex.rows[0].stock_nuevo === 8,
      'Movimiento Kardex registrado correctamente como venta_web'
    );

    // Validar que el carrito del cliente A haya quedado vacio tras la compra
    const resCarritoVacio = await fetch(`${baseUrl}/api/carrito`, {
      headers: { Authorization: `Bearer ${tokenClienteA}` }
    });
    const dataCarritoVacio = (await resCarritoVacio.json()) as any;
    asegurar(
      dataCarritoVacio.datos.carrito.items.length === 0,
      'El carrito persistente del cliente se vació automáticamente tras la compra'
    );

    // ------------------------------------------------------------------------
    // 3. STOCK INSUFICIENTE Y ROLLBACK VERIFICADO
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Pruebas de Stock Insuficiente y Rollback ---');
    // Variante tiene 8 en stock, cliente solicita 12
    const resStockFalla = await fetch(`${baseUrl}/api/pedidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClienteA}`
      },
      body: JSON.stringify({
        nombre_cliente: 'Camila Test A',
        celular_cliente: '71234567',
        correo_cliente: `cliente_a_${sufijo}@nuba.bo`,
        ciudad: 'Sucre',
        direccion: 'Calle Calvo #120',
        metodo_pago: 'contra_entrega',
        items: [{ variante_id: varianteNormalId, cantidad: 12 }]
      })
    });
    const dataStockFalla = (await resStockFalla.json()) as any;
    asegurar(resStockFalla.status === 400, 'Compra con stock insuficiente rechazada con 400');
    asegurar(dataStockFalla.error.includes('Stock insuficiente'), 'Mensaje claro de stock insuficiente');

    // Verificar que el stock se mantuvo intacto en 8 (Rollback exitoso)
    const resStockIntacto = await consultar('SELECT stock FROM variantes WHERE id = $1', [varianteNormalId]);
    asegurar(
      resStockIntacto.rows[0].stock === 8,
      'Verificacion de Rollback: el stock en BD permanece intacto en 8 sin cambios residuales'
    );

    // ------------------------------------------------------------------------
    // 4. CONCURRENCIA: COMPRAS SIMULTANEAS DEL ULTIMO ITEM (SELECT FOR UPDATE)
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Prueba de Concurrencia (SELECT ... FOR UPDATE) ---');
    // Variante varianteConcurrenteId tiene stock = 1
    // Dos clientes (A y B) compran 1 unidad al mismo instante exacto
    const payloadConcurrenteA = {
      nombre_cliente: 'Camila Test A',
      celular_cliente: '71234567',
      correo_cliente: `cliente_a_${sufijo}@nuba.bo`,
      ciudad: 'Sucre',
      direccion: 'Calle Calvo #120',
      metodo_pago: 'qr',
      items: [{ variante_id: varianteConcurrenteId, cantidad: 1 }]
    };
    const payloadConcurrenteB = {
      nombre_cliente: 'Laura Test B',
      celular_cliente: '79876543',
      correo_cliente: `cliente_b_${sufijo}@nuba.bo`,
      ciudad: 'Sucre',
      direccion: 'Av. Hernando Siles #450',
      metodo_pago: 'qr',
      items: [{ variante_id: varianteConcurrenteId, cantidad: 1 }]
    };

    const [compra1, compra2] = await Promise.all([
      fetch(`${baseUrl}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenClienteA}` },
        body: JSON.stringify(payloadConcurrenteA)
      }),
      fetch(`${baseUrl}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenClienteB}` },
        body: JSON.stringify(payloadConcurrenteB)
      })
    ]);

    const status1 = compra1.status;
    const status2 = compra2.status;

    const unoAprobado = (status1 === 201 && status2 === 400) || (status1 === 400 && status2 === 201);
    asegurar(
      unoAprobado,
      `Concurrencia resuelta atómicamente: Una peticion respondio 201 y la otra 400 (Status: [${status1}, ${status2}])`
    );

    const resStockFinal = await consultar('SELECT stock FROM variantes WHERE id = $1', [varianteConcurrenteId]);
    asegurar(
      resStockFinal.rows[0].stock === 0,
      'El stock final es exactamente 0 (no hubo sobreventa ni stock negativo)'
    );

    // ------------------------------------------------------------------------
    // 5. PRIVACIDAD: UN CLIENTE NO PUEDE VER PEDIDOS DE OTRO
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Pruebas de Privacidad y Segregacion de Pedidos ---');
    // Cliente B intentando consultar el detalle del pedido creado por Cliente A -> 403
    const resAcosoPedido = await fetch(`${baseUrl}/api/pedidos/${pedidoCreadoId}`, {
      headers: { Authorization: `Bearer ${tokenClienteB}` }
    });
    const dataAcoso = (await resAcosoPedido.json()) as any;
    asegurar(resAcosoPedido.status === 403, 'Cliente B intentando acceder a pedido de Cliente A recibe 403 Prohibido');
    asegurar(dataAcoso.error.includes('Acceso denegado'), 'Mensaje explicito de autorizacion denegada');

    // Cliente A consultando su propio pedido -> 200 OK
    const resPropio = await fetch(`${baseUrl}/api/pedidos/${pedidoCreadoId}`, {
      headers: { Authorization: `Bearer ${tokenClienteA}` }
    });
    asegurar(resPropio.status === 200, 'Cliente A accede correctamente a su propio pedido (200 OK)');

    // ------------------------------------------------------------------------
    // 6. ENVIOS, RASTREO Y TRANSICION DE ESTADOS
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Pruebas de Envíos, Rastreo y Transición de Estados ---');
    // Cliente intentando cambiar estado de envio -> 403
    const resClienteCambiaEnvio = await fetch(`${baseUrl}/api/envios/${envioCreadoId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenClienteA}` },
      body: JSON.stringify({ estado: 'En preparación' })
    });
    asegurar(resClienteCambiaEnvio.status === 403, 'Cliente intentando alterar estado de envio recibe 403 Prohibido');

    // Logistica intentando saltar de 'Pendiente' a 'Entregado' directamente -> 400
    const resSaltoInvalido = await fetch(`${baseUrl}/api/staff/logistica/envios/${envioCreadoId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLogistica}` },
      body: JSON.stringify({ estado: 'Entregado' })
    });
    asegurar(resSaltoInvalido.status === 400, 'Logistica intentando saltar estados de envio recibe 400 Bad Request');

    // Almacen intentando despachar (En tránsito) -> 403 por rol
    const resAlmacenDespacha = await fetch(`${baseUrl}/api/staff/almacen/envios/${envioCreadoId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlmacen}` },
      body: JSON.stringify({ estado: 'En tránsito' })
    });
    asegurar(resAlmacenDespacha.status === 403, 'Almacen no puede despachar un envio (403)');

    // Logistica intentando preparar -> 403 por rol
    const resLogisticaPrepara = await fetch(`${baseUrl}/api/staff/logistica/envios/${envioCreadoId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLogistica}` },
      body: JSON.stringify({ estado: 'En preparación' })
    });
    asegurar(resLogisticaPrepara.status === 403, 'Logistica no puede preparar un envio (403)');

    // Transicion valida 1: Pendiente -> En preparación (almacen)
    const resPrep = await fetch(`${baseUrl}/api/staff/almacen/envios/${envioCreadoId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlmacen}` },
      body: JSON.stringify({ estado: 'En preparación' })
    });
    asegurar(resPrep.status === 200, 'Almacen avanza envio a "En preparación" (200 OK)');

    // Transicion valida 2: En preparación -> Empacado (almacen)
    const resEmpacado = await fetch(`${baseUrl}/api/staff/almacen/envios/${envioCreadoId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlmacen}` },
      body: JSON.stringify({ estado: 'Empacado' })
    });
    asegurar(resEmpacado.status === 200, 'Almacen avanza envio a "Empacado" (200 OK)');

    // Transicion valida 3: Empacado -> En tránsito (logistica)
    const resTrans = await fetch(`${baseUrl}/api/staff/logistica/envios/${envioCreadoId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLogistica}` },
      body: JSON.stringify({ estado: 'En tránsito' })
    });
    asegurar(resTrans.status === 200, 'Logistica avanza envio a "En tránsito" (200 OK)');

    // Entregar sin datos de acta por la ruta legacy -> 400
    const resEntregaSinActa = await fetch(`${baseUrl}/api/envios/${envioCreadoId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLogistica}` },
      body: JSON.stringify({ estado: 'Entregado' })
    });
    asegurar(resEntregaSinActa.status === 400, 'Entregar sin receptor, fecha, hora y nota es rechazado (400)');

    // Transicion valida 4: En tránsito -> Entregado con acta de entrega obligatoria
    const hoy = new Date().toISOString().slice(0, 10);
    const resEntrega = await fetch(`${baseUrl}/api/staff/logistica/envios/${envioCreadoId}/entrega`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLogistica}` },
      body: JSON.stringify({
        receptor: 'Camila Morales',
        documento: 'CI 9876543',
        fecha_entrega: hoy,
        hora_entrega: '15:30',
        nota: 'Entrega recibida conforme en puerta principal.'
      })
    });
    asegurar(resEntrega.status === 200, 'Logistica cierra la entrega con receptor, fecha, hora y nota (200 OK)');

    // Verificar que el pago contra-entrega paso a 'Aprobado'
    const resPagoVerif = await consultar('SELECT estado, pagado_en FROM pagos WHERE pedido_id = $1', [pedidoCreadoId]);
    asegurar(
      resPagoVerif.rows[0].estado === 'Aprobado' && resPagoVerif.rows[0].pagado_en !== null,
      'Pago contra-entrega liquidado a Aprobado con fecha al cerrar la entrega'
    );

    const resActa = await consultar(
      `SELECT e.receptor, e.fecha_entrega, e.hora_entrega, e.nota
       FROM entregas e
       INNER JOIN envios en ON en.id = e.envio_id
       WHERE en.id = $1`,
      [envioCreadoId]
    );
    asegurar(
      resActa.rows.length === 1 && resActa.rows[0].receptor === 'Camila Morales',
      'Acta de entrega persistida con receptor y datos obligatorios'
    );

    // Intentar retroceder de Entregado a En tránsito -> 400
    const resRetroceso = await fetch(`${baseUrl}/api/staff/logistica/envios/${envioCreadoId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLogistica}` },
      body: JSON.stringify({ estado: 'En tránsito' })
    });
    asegurar(resRetroceso.status === 400, 'Intento de retroceder un envio entregado es rechazado (400)');

    // Consulta publica de rastreo por codigo unico
    const resRastreo = await fetch(`${baseUrl}/api/envios/rastreo/${codigoRastreoCreado}`);
    const dataRastreo = (await resRastreo.json()) as any;
    asegurar(resRastreo.status === 200, 'Consulta publica de rastreo por codigo responde 200');
    asegurar(
      dataRastreo.datos.rastreo.estado === 'Entregado',
      'El estado devuelto en rastreo publico es Entregado'
    );
    asegurar(
      dataRastreo.datos.rastreo.lineaDeTiempo.length === 5,
      'La linea de tiempo contiene los 5 hitos secuenciales registrados'
    );
    asegurar(
      dataRastreo.datos.rastreo.destinatarioProtegido.celular.includes('****'),
      'Los datos personales del destinatario estan debidamente anonimizados'
    );

    // ------------------------------------------------------------------------
    // 7. PRUEBAS DE RESEÑAS VERIFICADAS
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Pruebas de Reseñas Verificadas ---');
    // Cliente B (que no compro el producto) intenta publicar resena -> 403
    const resResenaNoCompro = await fetch(`${baseUrl}/api/resenas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenClienteB}` },
      body: JSON.stringify({
        producto_id: productoTestId,
        calificacion: 5,
        comentario: 'Resena no autorizada sin haber comprado el articulo.'
      })
    });
    asegurar(
      resResenaNoCompro.status === 403,
      'Cliente sin pedido Entregado es bloqueado al intentar publicar resena (403)'
    );

    // Cliente A (con pedido Entregado) publica resena -> 201
    const resResenaValida = await fetch(`${baseUrl}/api/resenas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenClienteA}` },
      body: JSON.stringify({
        producto_id: productoTestId,
        calificacion: 5,
        comentario: 'Producto excelente. Mi piel se siente notablemente hidratada y luminosa.'
      })
    });
    asegurar(resResenaValida.status === 201, 'Cliente verificado publica resena exitosamente (201)');

    // Cliente A intenta publicar una segunda resena sobre el mismo producto -> 409
    const resSegundaResena = await fetch(`${baseUrl}/api/resenas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenClienteA}` },
      body: JSON.stringify({
        producto_id: productoTestId,
        calificacion: 4,
        comentario: 'Intento de segunda resena.'
      })
    });
    asegurar(resSegundaResena.status === 409, 'Segunda resena del mismo cliente es bloqueada con 409 Conflicto');

    // Listado publico de resenas del producto
    const resListaResenas = await fetch(`${baseUrl}/api/resenas/producto/${productoTestId}`);
    const dataListaResenas = (await resListaResenas.json()) as any;
    asegurar(resListaResenas.status === 200, 'Listado de resenas del producto responde 200');
    asegurar(
      dataListaResenas.datos.total === 1 && dataListaResenas.datos.promedio === 5,
      'Estadisticas de resenas calculan promedio 5 y total 1'
    );

    console.log(`\n============================================================`);
    console.log(`Resultado final de la suite Bloque C: ${exitos} aprobadas, ${fallos} fallidas.`);
    console.log(`============================================================\n`);

    server.close(async () => {
      await limpiarDatosPrueba(productoTestId, [clienteAId, clienteBId, almacenId, logisticaId]);
      await cerrarPool();
      process.exit(fallos > 0 ? 1 : 0);
    });
  } catch (error) {
    console.error('Error critico durante la ejecucion de la suite Bloque C:', error);
    server.close(async () => {
      await limpiarDatosPrueba(productoTestId, [clienteAId, clienteBId, almacenId, logisticaId]);
      await cerrarPool();
      process.exit(1);
    });
  }
}

async function limpiarDatosPrueba(prodId?: number, userIds?: number[]) {
  const idsUsuarios = userIds && userIds.length > 0 ? userIds : [];

  try {
    if (idsUsuarios.length > 0) {
      const pedidos = await consultar(
        'SELECT id FROM pedidos WHERE usuario_id = ANY($1::int[])',
        [idsUsuarios]
      );
      await eliminarHistorialDePedidosDePrueba(pedidos.rows.map((p) => p.id));

      await eliminarReferenciasDeUsuariosDePrueba(idsUsuarios);
      await consultar('DELETE FROM carritos WHERE usuario_id = ANY($1::int[])', [
        idsUsuarios
      ]);
      await consultar('DELETE FROM auditoria WHERE usuario_id = ANY($1::int[])', [
        idsUsuarios
      ]);
      await consultar('DELETE FROM usuarios WHERE id = ANY($1::int[])', [idsUsuarios]);
    }

    if (prodId) {
      await eliminarOInactivarProductoDePrueba(prodId);
    }
  } catch (err) {
    console.error('Nota: error menor durante la limpieza de datos de prueba:', err);
  }
}

ejecutarPruebas();
