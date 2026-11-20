/**
 * ============================================================================
 * NUBAGLOW APP - PRUEBAS DE NOTIFICACIONES
 * ============================================================================
 * Usa transportes simulados: nunca envia correos ni mensajes reales.
 */

import { consultar, cerrarPool } from '../db';
import {
  NotificacionesService,
  notificacionesService
} from '../services/notificaciones.service';
import { pedidosService } from '../services/pedidos.service';

process.env.NODE_ENV = 'test';

const sufijo = Date.now().toString().slice(-6);

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

async function ejecutarPruebas() {
  console.log('Iniciando pruebas de notificaciones...');

  const correoExito = `notif_exito_${sufijo}@test.bo`;
  const chatExito = `chat_exito_${sufijo}`;
  const correoFallo = `notif_fallo_${sufijo}@test.bo`;
  const chatFallo = `chat_fallo_${sufijo}`;
  const correoOmitido = `notif_omitida_${sufijo}@test.bo`;
  const chatOmitido = `chat_omitido_${sufijo}`;
  const emailsPrueba = [correoExito, correoFallo, correoOmitido];

  let usuarioId: number | undefined;
  let productoId: number | undefined;
  let varianteId: number | undefined;
  const pedidoIds: number[] = [];

  try {
    // 1. Exito con transporte simulado
    const servicioExito = new NotificacionesService(
      () => async () => undefined,
      () => async () => undefined
    );

    const resultadoCorreo = await servicioExito.enviarCorreo({
      destinatario: correoExito,
      asunto: 'Prueba de correo',
      cuerpo: 'Cuerpo de prueba'
    });
    const resultadoTelegram = await servicioExito.enviarTelegram({
      destinatario: chatExito,
      asunto: 'Prueba de Telegram',
      cuerpo: 'Cuerpo de prueba'
    });

    asegurar(
      resultadoCorreo.estado === 'enviada',
      'El correo simulado exitoso queda como enviada'
    );
    asegurar(
      resultadoTelegram.estado === 'enviada',
      'El Telegram simulado exitoso queda como enviada'
    );

    const filasExito = await consultar(
      `SELECT estado, enviado_en FROM notificaciones
       WHERE destinatario = ANY($1::text[])`,
      [[correoExito, chatExito]]
    );
    asegurar(
      filasExito.rowCount === 2 &&
        filasExito.rows.every(
          (fila) => fila.estado === 'enviada' && fila.enviado_en !== null
        ),
      'La tabla notificaciones registra los envios exitosos'
    );

    // 2. Fallo del transporte simulado
    const servicioFallo = new NotificacionesService(
      () => async () => {
        throw new Error('SMTP caido');
      },
      () => async () => {
        throw new Error('Telegram caido');
      }
    );

    const falloCorreo = await servicioFallo.enviarCorreo({
      destinatario: correoFallo,
      asunto: 'Prueba de fallo',
      cuerpo: 'Cuerpo de prueba'
    });
    const falloTelegram = await servicioFallo.enviarTelegram({
      destinatario: chatFallo,
      asunto: 'Prueba de fallo',
      cuerpo: 'Cuerpo de prueba'
    });

    asegurar(
      falloCorreo.estado === 'fallida' &&
        String(falloCorreo.error).includes('SMTP caido'),
      'El fallo de SMTP queda como fallida sin lanzar excepcion'
    );
    asegurar(
      falloTelegram.estado === 'fallida' &&
        String(falloTelegram.error).includes('Telegram caido'),
      'El fallo de Telegram queda como fallida sin lanzar excepcion'
    );

    const filasFallo = await consultar(
      `SELECT estado, error FROM notificaciones
       WHERE destinatario = ANY($1::text[])`,
      [[correoFallo, chatFallo]]
    );
    asegurar(
      filasFallo.rowCount === 2 &&
        filasFallo.rows.every(
          (fila) => fila.estado === 'fallida' && Boolean(fila.error)
        ),
      'La tabla notificaciones registra el error del fallo'
    );

    // 3. Falta de configuracion
    const servicioOmitido = new NotificacionesService(
      () => null,
      () => null
    );

    const omitidoCorreo = await servicioOmitido.enviarCorreo({
      destinatario: correoOmitido,
      asunto: 'Prueba omitida',
      cuerpo: 'Cuerpo de prueba'
    });
    const omitidoTelegram = await servicioOmitido.enviarTelegram({
      destinatario: chatOmitido,
      cuerpo: 'Cuerpo de prueba'
    });

    asegurar(
      omitidoCorreo.estado === 'omitida' &&
        String(omitidoCorreo.error).includes('SMTP no configurado'),
      'Sin SMTP configurado la notificacion queda omitida'
    );
    asegurar(
      omitidoTelegram.estado === 'omitida' &&
        String(omitidoTelegram.error).includes('Telegram no configurado'),
      'Sin Telegram configurado la notificacion queda omitida'
    );

    // 4. La compra dispara la notificacion y no se rompe si falla
    const usuario = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Cliente Notificaciones', $1, 'hash_test', 'cliente', TRUE)
       RETURNING id`,
      [`notif_${sufijo}@test.bo`]
    );
    usuarioId = usuario.rows[0].id;

    const categoria = await consultar('SELECT id FROM categorias LIMIT 1');
    const producto = await consultar(
      `INSERT INTO productos
       (categoria_id, nombre, slug, marca, tipo_piel, descripcion,
        ingredientes, modo_uso, activo)
       VALUES ($1, $2, $3, 'Nuba Test', 'Todo tipo', 'Descripcion',
               'Ingredientes', 'Modo de uso', TRUE)
       RETURNING id`,
      [
        categoria.rows[0].id,
        `Producto Notificaciones ${sufijo}`,
        `producto-notificaciones-${sufijo}`
      ]
    );
    productoId = producto.rows[0].id;

    const variante = await consultar(
      `INSERT INTO variantes
       (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Variante Notificaciones', 40.00, 10, 2, TRUE)
       RETURNING id`,
      [productoId, `SKU-NOTIF-${sufijo}`]
    );
    varianteId = variante.rows[0].id;

    const pedidoBase = {
      nombre_cliente: 'Cliente Notificaciones',
      celular_cliente: '72860307',
      correo_cliente: `notif_compra_${sufijo}@test.bo`,
      ciudad: 'Sucre',
      direccion: 'Calle Notificaciones 123',
      metodo_pago: 'contra_entrega' as const,
      items: [{ variante_id: varianteId!, cantidad: 1 }]
    };

    const notificarOriginal = notificacionesService.notificarPedido;
    let notificacionesDisparadas = 0;

    (notificacionesService as any).notificarPedido = async () => {
      notificacionesDisparadas += 1;
      return {
        correo: {
          canal: 'correo',
          destinatario: 'simulado',
          estado: 'enviada',
          error: null
        },
        telegram: {
          canal: 'telegram',
          destinatario: 'simulado',
          estado: 'enviada',
          error: null
        }
      };
    };

    try {
      const pedido = await pedidosService.crearPedido(usuarioId!, pedidoBase);
      pedidoIds.push(pedido.id);
      asegurar(
        notificacionesDisparadas === 1 && Boolean(pedido.codigoRastreo),
        'La compra dispara la notificacion despues de confirmar'
      );
    } finally {
      (notificacionesService as any).notificarPedido = notificarOriginal;
    }

    (notificacionesService as any).notificarPedido = async () => {
      throw new Error('Falla simulada de notificacion');
    };

    try {
      const pedido = await pedidosService.crearPedido(usuarioId!, pedidoBase);
      pedidoIds.push(pedido.id);
      asegurar(
        Boolean(pedido.codigoRastreo),
        'Un fallo de notificacion no rompe ni revierte la compra'
      );
    } finally {
      (notificacionesService as any).notificarPedido = notificarOriginal;
    }

    console.log(`\nResultado: ${exitos} prueba(s) exitosa(s), ${fallos} fallo(s).`);
  } catch (error) {
    console.error('Error critico en las pruebas de notificaciones:', error);
    fallos++;
  } finally {
    try {
      if (pedidoIds.length > 0) {
        await consultar(
          'DELETE FROM notificaciones WHERE pedido_id = ANY($1::int[])',
          [pedidoIds]
        );
        await consultar(
          `DELETE FROM comprobantes_pago
           WHERE pago_id IN (
             SELECT id FROM pagos WHERE pedido_id = ANY($1::int[])
           )`,
          [pedidoIds]
        );
        await consultar(
          `DELETE FROM pago_eventos
           WHERE pago_id IN (
             SELECT id FROM pagos WHERE pedido_id = ANY($1::int[])
           )`,
          [pedidoIds]
        );
        await consultar(
          `DELETE FROM envio_eventos
           WHERE envio_id IN (
             SELECT id FROM envios WHERE pedido_id = ANY($1::int[])
           )`,
          [pedidoIds]
        );
        await consultar(
          'DELETE FROM entregas WHERE pedido_id = ANY($1::int[])',
          [pedidoIds]
        );
        await consultar(
          'DELETE FROM envios WHERE pedido_id = ANY($1::int[])',
          [pedidoIds]
        );
        await consultar(
          'DELETE FROM pedido_items WHERE pedido_id = ANY($1::int[])',
          [pedidoIds]
        );
        await consultar(
          'DELETE FROM movimientos_inventario WHERE pedido_id = ANY($1::int[])',
          [pedidoIds]
        );
        await consultar(
          'DELETE FROM facturas WHERE pedido_id = ANY($1::int[])',
          [pedidoIds]
        );
        await consultar(
          'DELETE FROM pagos WHERE pedido_id = ANY($1::int[])',
          [pedidoIds]
        );
        await consultar('DELETE FROM pedidos WHERE id = ANY($1::int[])', [
          pedidoIds
        ]);
      }

      if (usuarioId) {
        await consultar(
          'DELETE FROM notificaciones WHERE destinatario = ANY($1::text[])',
          [emailsPrueba]
        );
        await consultar(
          'DELETE FROM notificaciones WHERE destinatario LIKE $1',
          [`chat_%${sufijo}`]
        );
        await consultar(
          'DELETE FROM movimientos_inventario WHERE usuario_id = $1',
          [usuarioId]
        );
        await consultar('DELETE FROM carritos WHERE usuario_id = $1', [
          usuarioId
        ]);
        await consultar('DELETE FROM auditoria WHERE usuario_id = $1', [
          usuarioId
        ]);
        await consultar('DELETE FROM usuarios WHERE id = $1', [usuarioId]);
      }

      if (varianteId) {
        await consultar('DELETE FROM variantes WHERE id = $1', [varianteId]);
      }
      if (productoId) {
        await consultar('DELETE FROM productos WHERE id = $1', [productoId]);
      }
    } catch (error) {
      console.error('Error durante la limpieza de notificaciones:', error);
    }

    await cerrarPool();
    process.exit(fallos > 0 ? 1 : 0);
  }
}

ejecutarPruebas();
