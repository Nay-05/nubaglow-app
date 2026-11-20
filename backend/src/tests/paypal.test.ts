/**
 * ============================================================================
 * NUBAGLOW APP - PRUEBA DE PAYPAL (MODO SIMULADO)
 * ============================================================================
 * Valida:
 * 1. Crear orden PayPal convierte Bs. a USD y guarda monto/tipo de cambio.
 * 2. Capturar sin aprobacion falla; capturar aprobada marca el pago Aprobado.
 * 3. Captura idempotente: no duplica pago_eventos ni auditoria.
 * 4. Orden de otro pedido da 403; monto o moneda manipulados se rechazan.
 * 5. Pedidos que no son PayPal y usuarios sin sesion son rechazados.
 * 6. simulado/aprobar responde 404 en sandbox y en produccion.
 * 7. Se puede crear otra orden si el cliente cancela/expira la anterior.
 */

import jwt from 'jsonwebtoken';
import app from '../index';
import { consultar, cerrarPool } from '../db';
import { PaypalService } from '../services/paypal.service';
import { PasarelaPaypal } from '../services/paypalPasarela.service';
import {
  eliminarHistorialDePedidosDePrueba,
  eliminarOInactivarProductoDePrueba,
  eliminarReferenciasDeUsuariosDePrueba
} from './limpieza';

const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_super_segura_nubaglow_2026';
process.env.JWT_SECRET = JWT_SECRET;

const TIPO_CAMBIO = 6.96;

function restaurarVariable(clave: string, valor: string | undefined): void {
  if (valor === undefined) {
    delete process.env[clave];
  } else {
    process.env[clave] = valor;
  }
}

async function ejecutarPruebas(): Promise<void> {
  console.log('Iniciando prueba de PayPal (modo simulado)...');

  const modoOriginal = process.env.PAYPAL_MODO;
  const tipoCambioOriginal = process.env.PAYPAL_TIPO_CAMBIO_BOB_USD;
  const nodeEnvOriginal = process.env.NODE_ENV;
  const appUrlOriginal = process.env.APP_URL;

  process.env.PAYPAL_MODO = 'simulado';
  process.env.PAYPAL_TIPO_CAMBIO_BOB_USD = String(TIPO_CAMBIO);
  process.env.NODE_ENV = 'test';
  process.env.APP_URL = 'http://localhost:3000';

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

  const authJson = (token: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  });

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

  try {
    const clienteAId = await crearUsuario('Cliente PayPal A', 'cliente', 'paypal_a');
    const clienteBId = await crearUsuario('Cliente PayPal B', 'cliente', 'paypal_b');
    const vendedorId = await crearUsuario('Vendedor PayPal', 'vendedor', 'paypal_vend');

    const tokenClienteA = tokenPara(clienteAId, 'Cliente PayPal A', 'cliente', 'paypal_a');
    const tokenClienteB = tokenPara(clienteBId, 'Cliente PayPal B', 'cliente', 'paypal_b');
    const tokenVendedor = tokenPara(vendedorId, 'Vendedor PayPal', 'vendedor', 'paypal_vend');

    const resCat = await consultar('SELECT id FROM categorias LIMIT 1');
    if (resCat.rows.length === 0) {
      throw new Error('No hay categorias en la BD para ejecutar la prueba');
    }

    const resProd = await consultar(
      `INSERT INTO productos
       (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo)
       VALUES ($1, $2, $3, 'Nuba Test', 'Todo tipo', 'Descripcion test', 'Ingredientes test', 'Modo test', TRUE)
       RETURNING id`,
      [resCat.rows[0].id, `Producto PayPal ${sufijo}`, `producto-paypal-${sufijo}`]
    );
    productoId = resProd.rows[0].id;

    const resVar = await consultar(
      `INSERT INTO variantes (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Presentacion 50ml', 100.00, 50, 3, TRUE) RETURNING id`,
      [productoId, `SKU-PAYPAL-${sufijo}`]
    );
    const varianteId = resVar.rows[0].id;

    const crearPedido = async (token: string, metodo: string, nombre: string) => {
      const res = await fetch(`${baseUrl}/api/pedidos`, {
        method: 'POST',
        headers: authJson(token),
        body: JSON.stringify({
          nombre_cliente: nombre,
          celular_cliente: '71234567',
          correo_cliente: `paypal_${sufijo}_${Math.random().toString(36).slice(2, 6)}@nuba.bo`,
          ciudad: 'Sucre',
          direccion: 'Calle PayPal 123, Zona Central',
          metodo_pago: metodo,
          items: [{ variante_id: varianteId, cantidad: 1 }]
        })
      });
      const data = (await res.json()) as any;
      if (res.status !== 201) {
        throw new Error(`No se pudo crear el pedido PayPal: ${JSON.stringify(data)}`);
      }

      const pedido = data.datos.pedido;
      pedidoIds.push(pedido.id);

      const resPago = await consultar(
        `SELECT id, monto, paypal_order_id AS "paypalOrderId"
         FROM pagos WHERE pedido_id = $1`,
        [pedido.id]
      );
      return { pedido, pago: resPago.rows[0] };
    };

    const crearOrden = (token: string, pedidoId: number) =>
      fetch(`${baseUrl}/api/pagos/paypal/crear`, {
        method: 'POST',
        headers: authJson(token),
        body: JSON.stringify({ pedido_id: pedidoId })
      });

    const capturarOrden = (token: string, pedidoId: number, ordenId: string) =>
      fetch(`${baseUrl}/api/pagos/paypal/capturar`, {
        method: 'POST',
        headers: authJson(token),
        body: JSON.stringify({ pedido_id: pedidoId, orden_id: ordenId })
      });

    const aprobarSimulado = (token: string, pedidoId: number, ordenId: string) =>
      fetch(`${baseUrl}/api/pagos/paypal/simulado/aprobar`, {
        method: 'POST',
        headers: authJson(token),
        body: JSON.stringify({ pedido_id: pedidoId, orden_id: ordenId })
      });

    const pedidoA = await crearPedido(tokenClienteA, 'paypal', 'Cliente PayPal A');
    const pedidoB = await crearPedido(tokenClienteB, 'paypal', 'Cliente PayPal B');
    const pedidoQR = await crearPedido(tokenClienteA, 'qr_simple', 'Cliente PayPal QR');
    const pedidoC = await crearPedido(tokenClienteA, 'paypal', 'Cliente PayPal C');

    const totalA = Number(pedidoA.pedido.total);
    const montoUsdA = Math.round((totalA / TIPO_CAMBIO) * 100) / 100;

    // ------------------------------------------------------------------------
    // 1. Autenticacion y rol
    // ------------------------------------------------------------------------
    const resSinSesionCrear = await fetch(`${baseUrl}/api/pagos/paypal/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoA.pedido.id })
    });
    asegurar(resSinSesionCrear.status === 401, 'Crear orden sin sesion responde 401');

    const resSinSesionCapturar = await fetch(`${baseUrl}/api/pagos/paypal/capturar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoA.pedido.id, orden_id: 'SIM-X' })
    });
    asegurar(resSinSesionCapturar.status === 401, 'Capturar orden sin sesion responde 401');

    const resSinSesionAprobar = await fetch(
      `${baseUrl}/api/pagos/paypal/simulado/aprobar`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedidoA.pedido.id, orden_id: 'SIM-X' })
      }
    );
    asegurar(resSinSesionAprobar.status === 401, 'Simulado/aprobar sin sesion responde 401');

    const resVendedorCrear = await crearOrden(tokenVendedor, pedidoA.pedido.id);
    asegurar(
      resVendedorCrear.status === 403,
      'Un usuario que no es cliente no puede crear ordenes PayPal (403)'
    );

    // ------------------------------------------------------------------------
    // 2. Crear orden: conversion Bs. a USD y persistencia
    // ------------------------------------------------------------------------
    const resCrearA = await crearOrden(tokenClienteA, pedidoA.pedido.id);
    const dataCrearA = (await resCrearA.json()) as any;
    const ordenA = dataCrearA.datos?.orden;

    asegurar(resCrearA.status === 201, 'Cliente dueno crea la orden PayPal (201)');
    asegurar(
      typeof ordenA?.ordenId === 'string' && ordenA.ordenId.startsWith('SIM-PAYPAL-'),
      'La orden simulada devuelve un identificador'
    );
    asegurar(
      typeof ordenA?.urlAprobacion === 'string' &&
        ordenA.urlAprobacion.startsWith(
          'http://localhost:3000/pago/paypal/simulado'
        ),
      'La orden devuelve una urlAprobacion de retorno'
    );
    asegurar(
      ordenA?.montoBob === totalA &&
        ordenA?.montoUsd === montoUsdA &&
        ordenA?.tipoCambioBobUsd === TIPO_CAMBIO &&
        ordenA?.monedaPaypal === 'USD',
      'El servidor convierte el total Bs. a USD con dos decimales'
    );

    const resPagoA = await consultar(
      `SELECT estado, moneda, monto, monto_usd AS "montoUsd",
              tipo_cambio_bob_usd AS "tipoCambio", paypal_order_id AS "ordenId", simulado
       FROM pagos WHERE id = $1`,
      [pedidoA.pago.id]
    );
    const pagoA = resPagoA.rows[0];
    asegurar(
      pagoA.estado === 'Pendiente' &&
        pagoA.ordenId === ordenA.ordenId &&
        Number(pagoA.montoUsd) === montoUsdA &&
        Number(pagoA.tipoCambio) === TIPO_CAMBIO &&
        pagoA.moneda === 'BOB' &&
        pagoA.simulado === true,
      'La BD guarda monto Bs., tipo de cambio, monto USD y orden PayPal'
    );

    // ------------------------------------------------------------------------
    // 3. Capturar sin aprobar: rechazo y pago Pendiente
    // ------------------------------------------------------------------------
    const resNoAprobada = await capturarOrden(
      tokenClienteA,
      pedidoA.pedido.id,
      ordenA.ordenId
    );
    asegurar(resNoAprobada.status === 409, 'Capturar una orden no aprobada es rechazado (409)');

    const resEstadoA = await consultar('SELECT estado FROM pagos WHERE id = $1', [
      pedidoA.pago.id
    ]);
    asegurar(
      resEstadoA.rows[0].estado === 'Pendiente',
      'El pago sigue Pendiente si la orden no esta aprobada'
    );
    const resEventosA = await consultar(
      'SELECT COUNT(*)::int AS total FROM pago_eventos WHERE pago_id = $1',
      [pedidoA.pago.id]
    );
    asegurar(
      resEventosA.rows[0].total === 0,
      'Una captura rechazada no registra eventos de pago'
    );

    // ------------------------------------------------------------------------
    // 4. Monto y moneda manipulados: rechazo con una pasarela falsa
    // ------------------------------------------------------------------------
    const capturaMontoAlterado: PasarelaPaypal = {
      crearOrden: async () => ({ ordenId: 'FAKE-ORDER', urlAprobacion: 'http://fake' }),
      capturarOrden: async () => ({
        estado: 'COMPLETED',
        monto: montoUsdA + 1,
        moneda: 'USD',
        capturaId: 'FAKE-CAPTURA-MONTO'
      })
    };
    const servicioMontoAlterado = new PaypalService(() => capturaMontoAlterado);
    let errorMonto: any = null;
    try {
      await servicioMontoAlterado.capturar(pedidoA.pedido.id, ordenA.ordenId, clienteAId);
    } catch (error) {
      errorMonto = error;
    }
    asegurar(
      errorMonto?.statusCode === 409,
      'Un monto capturado distinto al esperado es rechazado (409)'
    );

    const capturaMonedaAlterada: PasarelaPaypal = {
      crearOrden: async () => ({ ordenId: 'FAKE-ORDER', urlAprobacion: 'http://fake' }),
      capturarOrden: async () => ({
        estado: 'COMPLETED',
        monto: montoUsdA,
        moneda: 'EUR',
        capturaId: 'FAKE-CAPTURA-MONEDA'
      })
    };
    const servicioMonedaAlterada = new PaypalService(() => capturaMonedaAlterada);
    let errorMoneda: any = null;
    try {
      await servicioMonedaAlterada.capturar(pedidoA.pedido.id, ordenA.ordenId, clienteAId);
    } catch (error) {
      errorMoneda = error;
    }
    asegurar(
      errorMoneda?.statusCode === 409,
      'Una moneda capturada distinta a USD es rechazada (409)'
    );

    // ------------------------------------------------------------------------
    // 5. Aprobar simuladamente y capturar una sola vez
    // ------------------------------------------------------------------------
    const resAprobarOtro = await aprobarSimulado(
      tokenClienteB,
      pedidoA.pedido.id,
      ordenA.ordenId
    );
    asegurar(
      resAprobarOtro.status === 403,
      'Otro cliente no puede aprobar una orden ajena (403)'
    );

    const resAprobarA = await aprobarSimulado(
      tokenClienteA,
      pedidoA.pedido.id,
      ordenA.ordenId
    );
    asegurar(resAprobarA.status === 200, 'El dueno aprueba la orden simulada (200)');

    const resCapturarA = await capturarOrden(
      tokenClienteA,
      pedidoA.pedido.id,
      ordenA.ordenId
    );
    const dataCapturarA = (await resCapturarA.json()) as any;
    const capturaA = dataCapturarA.datos?.captura;
    asegurar(resCapturarA.status === 200, 'Capturar la orden aprobada responde 200');
    asegurar(
      capturaA?.estadoPago === 'Aprobado' &&
        capturaA?.moneda === 'USD' &&
        capturaA?.montoUsd === montoUsdA &&
        capturaA?.idempotente === false &&
        typeof capturaA?.capturaId === 'string' &&
        capturaA.capturaId.startsWith('SIM-CAPTURA-'),
      'La captura devuelve estado, monto, moneda y capturaId'
    );

    const resPagoAprobado = await consultar(
      `SELECT estado, referencia_externa AS "capturaId", pagado_en AS "pagadoEn"
       FROM pagos WHERE id = $1`,
      [pedidoA.pago.id]
    );
    asegurar(
      resPagoAprobado.rows[0].estado === 'Aprobado' &&
        resPagoAprobado.rows[0].capturaId === capturaA.capturaId &&
        resPagoAprobado.rows[0].pagadoEn !== null,
      'El pago queda Aprobado con captura y fecha de pago'
    );

    const resEventosAprobado = await consultar(
      `SELECT COUNT(*)::int AS total
       FROM pago_eventos
       WHERE pago_id = $1 AND estado_nuevo = 'Aprobado'`,
      [pedidoA.pago.id]
    );
    const resAuditoriaAprobado = await consultar(
      `SELECT COUNT(*)::int AS total
       FROM auditoria
       WHERE registro_id = $1 AND accion = 'APROBAR_PAGO_PAYPAL'`,
      [pedidoA.pago.id]
    );
    asegurar(
      resEventosAprobado.rows[0].total === 1 &&
        resAuditoriaAprobado.rows[0].total === 1,
      'La captura registra un pago_evento y una auditoria'
    );

    const resCapturarDos = await capturarOrden(
      tokenClienteA,
      pedidoA.pedido.id,
      ordenA.ordenId
    );
    const dataCapturarDos = (await resCapturarDos.json()) as any;
    const resEventosDos = await consultar(
      `SELECT COUNT(*)::int AS total
       FROM pago_eventos
       WHERE pago_id = $1 AND estado_nuevo = 'Aprobado'`,
      [pedidoA.pago.id]
    );
    const resAuditoriaDos = await consultar(
      `SELECT COUNT(*)::int AS total
       FROM auditoria
       WHERE registro_id = $1 AND accion = 'APROBAR_PAGO_PAYPAL'`,
      [pedidoA.pago.id]
    );
    asegurar(
      resCapturarDos.status === 200 &&
        dataCapturarDos.datos?.captura?.idempotente === true &&
        dataCapturarDos.datos?.captura?.capturaId === capturaA.capturaId,
      'Capturar dos veces devuelve la misma captura sin duplicar el pago'
    );
    asegurar(
      resEventosDos.rows[0].total === 1 && resAuditoriaDos.rows[0].total === 1,
      'La segunda captura no duplica pago_eventos ni auditoria'
    );

    // ------------------------------------------------------------------------
    // 6. Orden de otro pedido
    // ------------------------------------------------------------------------
    const resCrearB = await crearOrden(tokenClienteB, pedidoB.pedido.id);
    const dataCrearB = (await resCrearB.json()) as any;
    const ordenB = dataCrearB.datos?.orden;
    const resOrdenAjena = await capturarOrden(
      tokenClienteA,
      pedidoA.pedido.id,
      ordenB.ordenId
    );
    asegurar(
      resOrdenAjena.status === 403,
      'Usar la orden de otro pedido responde 403'
    );

    // ------------------------------------------------------------------------
    // 7. Metodo de pago distinto de PayPal
    // ------------------------------------------------------------------------
    const resMetodoInvalido = await crearOrden(tokenClienteA, pedidoQR.pedido.id);
    asegurar(
      resMetodoInvalido.status === 409,
      'Crear una orden PayPal para un pedido QR es rechazado (409)'
    );

    // ------------------------------------------------------------------------
    // 8. Cancelar/expirar la orden anterior y crear otra
    // ------------------------------------------------------------------------
    const resCrearC1 = await crearOrden(tokenClienteA, pedidoC.pedido.id);
    const dataCrearC1 = (await resCrearC1.json()) as any;
    const ordenC1 = dataCrearC1.datos?.orden;

    const resCrearC2 = await crearOrden(tokenClienteA, pedidoC.pedido.id);
    const dataCrearC2 = (await resCrearC2.json()) as any;
    const ordenC2 = dataCrearC2.datos?.orden;

    asegurar(
      resCrearC1.status === 201 &&
        resCrearC2.status === 201 &&
        ordenC1.ordenId !== ordenC2.ordenId,
      'Se puede crear una nueva orden PayPal para el mismo pago Pendiente'
    );

    const resPagoC = await consultar(
      'SELECT paypal_order_id AS "ordenId", estado FROM pagos WHERE id = $1',
      [pedidoC.pago.id]
    );
    asegurar(
      resPagoC.rows[0].ordenId === ordenC2.ordenId &&
        resPagoC.rows[0].estado === 'Pendiente',
      'La orden mas reciente reemplaza a la anterior sin aprobar el pago'
    );

    const resAprobarC = await aprobarSimulado(
      tokenClienteA,
      pedidoC.pedido.id,
      ordenC2.ordenId
    );
    const resCapturarC = await capturarOrden(
      tokenClienteA,
      pedidoC.pedido.id,
      ordenC2.ordenId
    );
    asegurar(
      resAprobarC.status === 200 && resCapturarC.status === 200,
      'La orden regenerada se puede aprobar y capturar'
    );

    // ------------------------------------------------------------------------
    // 9. Endpoint simulado deshabilitado en sandbox y produccion
    // ------------------------------------------------------------------------
    process.env.PAYPAL_MODO = 'sandbox';
    const resSimuladoSandbox = await aprobarSimulado(
      tokenClienteB,
      pedidoB.pedido.id,
      ordenB.ordenId
    );
    asegurar(
      resSimuladoSandbox.status === 404,
      'simulado/aprobar responde 404 con PAYPAL_MODO=sandbox'
    );

    process.env.PAYPAL_MODO = 'simulado';
    process.env.NODE_ENV = 'production';
    const resSimuladoProduccion = await aprobarSimulado(
      tokenClienteB,
      pedidoB.pedido.id,
      ordenB.ordenId
    );
    asegurar(
      resSimuladoProduccion.status === 404,
      'simulado/aprobar responde 404 en produccion'
    );
  } finally {
    restaurarVariable('PAYPAL_MODO', modoOriginal);
    restaurarVariable('PAYPAL_TIPO_CAMBIO_BOB_USD', tipoCambioOriginal);
    restaurarVariable('NODE_ENV', nodeEnvOriginal);
    restaurarVariable('APP_URL', appUrlOriginal);

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
    await eliminarHistorialDePedidosDePrueba(pedidoIds);

    if (userIds.length > 0) {
      await consultar(
        'DELETE FROM carrito_items WHERE carrito_id IN (SELECT id FROM carritos WHERE usuario_id = ANY($1::int[]))',
        [userIds]
      );
      await consultar('DELETE FROM carritos WHERE usuario_id = ANY($1::int[])', [userIds]);
      await eliminarReferenciasDeUsuariosDePrueba(userIds);
      await consultar('DELETE FROM auditoria WHERE usuario_id = ANY($1::int[])', [userIds]);
      await consultar('DELETE FROM usuarios WHERE id = ANY($1::int[])', [userIds]);
    }

    if (productoId) {
      await eliminarOInactivarProductoDePrueba(productoId);
    }
  } catch (error) {
    console.error('Nota: error durante la limpieza de la prueba PayPal:', error);
  } finally {
    server.close();
  }
}

ejecutarPruebas().catch((error) => {
  console.error('Error critico en la prueba PayPal:', error);
  process.exit(1);
});

