/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE PEDIDOS Y TRANSACCION DE COMPRA
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 7, 8 y 9:
 * 1. Transaccion atomica con conTransaccion (BEGIN / COMMIT / ROLLBACK).
 * 2. Bloqueo de filas con SELECT ... FOR UPDATE en orden ascendente de id (anti-deadlock).
 * 3. Precios y totales calculados EXCLUSIVAMENTE en el servidor desde la BD.
 * 4. Descuento de stock y registro en movimientos_inventario (Kardex).
 * 5. Registro de pedido, items congelados, pago, envio y evento inicial.
 * 6. Vaciado del carrito del cliente.
 * 7. Segregacion estricta: un cliente nunca puede acceder a pedidos de terceros (403/404).
 */

import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import { RolUsuario } from '../types';
import { CrearPedidoInput } from '../schemas/compra.schema';
import { fechaVencimientoPago } from '../config/pagos';
import { esPaypalSimulado } from '../config/paypal';
import { obtenerDatosCobro } from '../config/cobro';
import { calcularCostoEnvio } from './cotizaciones.service';
import { generarQrSimulado } from './qr.service';
import { pagosService } from './pagos.service';
import { notificacionesService } from './notificaciones.service';

export interface ItemPedidoResumen {
  id: number;
  varianteId: number;
  productoNombre: string;
  varianteNombre: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  imagen: string | null;
}

export interface PedidoCompleto {
  id: number;
  usuarioId: number;
  codigoRastreo: string;
  subtotal: number;
  costoEnvio: number;
  total: number;
  estado: string;
  nombreCliente: string;
  celularCliente: string;
  correoCliente: string;
  ciudad: string;
  direccion: string;
  notas: string | null;
  creadoEn: string;
  items: ItemPedidoResumen[];
  pago?: {
    metodo: string;
    monto: number;
    moneda?: string;
    montoUsd?: number | null;
    tipoCambioBobUsd?: number | null;
    paypalOrderId?: string | null;
    estado: string;
    referencia: string | null;
    pagadoEn: string | null;
    fechaVencimiento?: string | null;
    comprobanteUrl?: string | null;
    motivoRechazo?: string | null;
    qrDataUrl?: string;
    avisoSimulacion?: string;
  };
  envio?: {
    id: number;
    codigoRastreo: string;
    estado: string;
    transportista: string;
    fechaDespacho: string | null;
    fechaEntrega: string | null;
    eventos: Array<{
      id: number;
      estado: string;
      descripcion: string;
      creadoEn: string;
      usuarioNombre?: string;
    }>;
  };
}

export class PedidosService {
  /**
   * Genera un codigo de rastreo unico con formato NB-2026-XXXX
   */
  private async generarCodigoRastreoUnico(clienteSql: any): Promise<string> {
    for (let intento = 0; intento < 10; intento++) {
      const aleatorio = Math.floor(1000 + Math.random() * 9000);
      const candidato = `NB-2026-${aleatorio}`;
      const res = await clienteSql.query('SELECT id FROM pedidos WHERE codigo_rastreo = $1', [candidato]);
      if (res.rows.length === 0) {
        return candidato;
      }
    }
    // Si hubiese colisiones sucesivas, se extiende a 5 digitos
    const aleatorioExtendido = Math.floor(10000 + Math.random() * 90000);
    return `NB-2026-${aleatorioExtendido}`;
  }

  /**
   * Crea un pedido web en UNA SOLA TRANSACCION atomica
   */
  async crearPedido(usuarioId: number, datos: CrearPedidoInput): Promise<PedidoCompleto> {
    // 1. Determinar los articulos a comprar
    let itemsAComprar: Array<{ variante_id: number; cantidad: number }> = [];

    if (datos.items && datos.items.length > 0) {
      itemsAComprar = datos.items;
    } else {
      // Obtener del carrito persistente del usuario
      const resCart = await consultar(
        `SELECT ci.variante_id, ci.cantidad 
         FROM carrito_items ci
         INNER JOIN carritos c ON c.id = ci.carrito_id
         WHERE c.usuario_id = $1`,
        [usuarioId]
      );
      if (resCart.rows.length === 0) {
        throw new AppError('El carrito de compras esta vacio. Agregue articulos antes de finalizar el pedido', 400);
      }
      itemsAComprar = resCart.rows;
    }

    // 2. Ordenar IDs de variantes de forma ascendente para evitar bloqueos mutuos (Deadlocks)
    const itemsOrdenados = [...itemsAComprar].sort((a, b) => a.variante_id - b.variante_id);
    const idsVariantes = itemsOrdenados.map((i) => i.variante_id);

    // 3. Ejecucion de la transaccion
    const pedidoCreado = await conTransaccion(async (cliente) => {
      // 3.1. Bloquear filas con SELECT ... FOR UPDATE en orden ascendente
      const resBloqueo = await cliente.query(
        `SELECT 
          v.id, 
          v.producto_id, 
          v.nombre AS "varianteNombre", 
          v.sku, 
          v.precio, 
          v.stock, 
          v.activo AS "varianteActiva",
          p.nombre AS "productoNombre", 
          p.activo AS "productoActivo"
         FROM variantes v
         INNER JOIN productos p ON p.id = v.producto_id
         WHERE v.id = ANY($1::int[])
         ORDER BY v.id ASC
         FOR UPDATE OF v`,
        [idsVariantes]
      );

      const mapaVariantes = new Map<number, any>();
      resBloqueo.rows.forEach((row) => mapaVariantes.set(row.id, row));

      // 3.2. Validar existencia, estado activo y disponibilidad de stock
      let subtotalCalculado = 0;
      const itemsProcesados: Array<{
        varianteId: number;
        productoNombre: string;
        varianteNombre: string;
        sku: string;
        cantidad: number;
        precioUnitario: number;
        subtotal: number;
        stockAnterior: number;
        stockNuevo: number;
      }> = [];

      for (const item of itemsOrdenados) {
        const infoVar = mapaVariantes.get(item.variante_id);
        if (!infoVar || !infoVar.varianteActiva || !infoVar.productoActivo) {
          throw new AppError(
            `El producto '${infoVar ? infoVar.productoNombre : item.variante_id}' ya no esta disponible en tienda`,
            400
          );
        }

        if (infoVar.stock < item.cantidad) {
          throw new AppError(
            `Stock insuficiente para '${infoVar.productoNombre} - ${infoVar.varianteNombre}'. Disponible: ${infoVar.stock}, solicitado: ${item.cantidad}`,
            400
          );
        }

        const precioReal = Number(infoVar.precio);
        const subtotalItem = Math.round(precioReal * item.cantidad * 100) / 100;
        subtotalCalculado += subtotalItem;

        itemsProcesados.push({
          varianteId: item.variante_id,
          productoNombre: infoVar.productoNombre,
          varianteNombre: infoVar.varianteNombre,
          sku: infoVar.sku,
          cantidad: item.cantidad,
          precioUnitario: precioReal,
          subtotal: subtotalItem,
          stockAnterior: infoVar.stock,
          stockNuevo: infoVar.stock - item.cantidad
        });
      }

      subtotalCalculado = Math.round(subtotalCalculado * 100) / 100;
      // Misma regla que la cotizacion: sin subtotal no hay envio; desde 200 Bs. es gratis.
      const costoEnvio = calcularCostoEnvio(subtotalCalculado);
      const totalCalculado = Math.round((subtotalCalculado + costoEnvio) * 100) / 100;

      // 3.3. Generar codigo unico de rastreo NB-2026-XXXX
      const codigoRastreo = await this.generarCodigoRastreoUnico(cliente);

      // 3.4. Insertar Pedido
      const resPedido = await cliente.query(
        `INSERT INTO pedidos 
         (usuario_id, codigo_rastreo, subtotal, costo_envio, total, estado, 
          nombre_cliente, celular_cliente, correo_cliente, ciudad, direccion, notas)
         VALUES ($1, $2, $3, $4, $5, 'Pendiente', $6, $7, $8, $9, $10, $11)
         RETURNING id, codigo_rastreo, creado_en`,
        [
          usuarioId,
          codigoRastreo,
          subtotalCalculado,
          costoEnvio,
          totalCalculado,
          datos.nombre_cliente.trim(),
          datos.celular_cliente.trim(),
          datos.correo_cliente.trim().toLowerCase(),
          datos.ciudad.trim(),
          datos.direccion.trim(),
          datos.notas?.trim() || null
        ]
      );
      const pedidoId = resPedido.rows[0].id;

      // 3.5. Insertar Pedido Items, Descontar Stock y Registrar Kardex
      for (const item of itemsProcesados) {
        await cliente.query(
          `INSERT INTO pedido_items (pedido_id, variante_id, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [pedidoId, item.varianteId, item.cantidad, item.precioUnitario, item.subtotal]
        );

        // Descontar inventario
        await cliente.query('UPDATE variantes SET stock = stock - $1 WHERE id = $2', [
          item.cantidad,
          item.varianteId
        ]);

        // Registrar movimiento en el Kardex
        await cliente.query(
          `INSERT INTO movimientos_inventario 
           (variante_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id)
           VALUES ($1, 'venta_web', $2, $3, $4, $5, $6)`,
          [
            item.varianteId,
            item.cantidad,
            item.stockAnterior,
            item.stockNuevo,
            `Venta web en pedido ${codigoRastreo}`,
            usuarioId
          ]
        );
      }

      // 3.6. Registrar Pago
      // 'qr' se conserva como alias legado; en BD se normaliza a 'qr_simple'.
      const metodoPago = datos.metodo_pago === 'qr' ? 'qr_simple' : datos.metodo_pago;
      const esQR = metodoPago === 'qr_simple';
      const esContraEntrega = metodoPago === 'contra_entrega';
      const refPago = esQR
        ? `QR-DEMO-${Math.floor(100000 + Math.random() * 900000)}`
        : null;
      const venceEn = esContraEntrega ? null : fechaVencimientoPago();
      const pagoSimulado = metodoPago === 'paypal' ? esPaypalSimulado() : true;

      await cliente.query(
        `INSERT INTO pagos
         (pedido_id, metodo, monto, estado, referencia, simulado, pagado_en, fecha_vencimiento)
         VALUES ($1, $2, $3, 'Pendiente', $4, $5, NULL, $6)`,
        [pedidoId, metodoPago, totalCalculado, refPago, pagoSimulado, venceEn]
      );

      // 3.7. Registrar Envio
      const resEnvio = await cliente.query(
        `INSERT INTO envios (pedido_id, codigo_rastreo, estado, transportista)
         VALUES ($1, $2, 'Pendiente', 'Nuba Express Sucre')
         RETURNING id`,
        [pedidoId, codigoRastreo]
      );
      const envioId = resEnvio.rows[0].id;

      // 3.8. Registrar Evento Inicial de Envio
      await cliente.query(
        `INSERT INTO envio_eventos (envio_id, estado, descripcion, usuario_id)
         VALUES ($1, 'Pendiente', 'Orden recibida y confirmada en sistema NubaGlow.', $2)`,
        [envioId, usuarioId]
      );

      // 3.9. Vaciar el carrito de compras del usuario
      await cliente.query(
        `DELETE FROM carrito_items ci
         USING carritos c
         WHERE ci.carrito_id = c.id AND c.usuario_id = $1`,
        [usuarioId]
      );

      // 3.10. Registrar auditoria de la compra
      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'CREAR_PEDIDO_WEB', 'pedidos', $2, $3)`,
        [usuarioId, pedidoId, JSON.stringify({ codigoRastreo, total: totalCalculado, metodoPago })]
      );

      return { id: pedidoId, codigoRastreo };
    });

    const pedidoCompleto = await this.obtenerDetalle(
      pedidoCreado.id,
      usuarioId,
      'cliente'
    );

    // Las notificaciones se disparan fuera de la transaccion ya confirmada.
    // En produccion no bloquean la respuesta del checkout: corren en segundo
    // plano y cualquier fallo inesperado queda registrado en el log.
    console.log(
      `[Pedido #${pedidoCompleto.id}] Disparando notificaciones ` +
        `(correo a ${pedidoCompleto.correoCliente} + Telegram admin)...`
    );

    const notificacion = notificacionesService
      .notificarPedido(pedidoCompleto)
      .then((resultado) => {
        console.log(
          `[Pedido #${pedidoCompleto.id}] Resultado notificaciones -> ` +
            `correo=${resultado.correo.estado}` +
            `${resultado.correo.error ? ` (${resultado.correo.error})` : ''}; ` +
            `telegram=${resultado.telegram.estado}` +
            `${resultado.telegram.error ? ` (${resultado.telegram.error})` : ''}.`
        );
        return resultado;
      });

    const manejarErrorNotificacion = (error: unknown) => {
      console.error(
        `[NubaGlow][Notificaciones] Fallo inesperado al notificar ` +
          `el pedido ${pedidoCompleto.codigoRastreo}:`,
        error
      );
    };

    if (process.env.NODE_ENV === 'test') {
      // En pruebas se espera para que las aserciones sean deterministas.
      await notificacion.catch(manejarErrorNotificacion);
    } else {
      void notificacion.catch(manejarErrorNotificacion);
    }

    return pedidoCompleto;
  }

  /**
   * Lista los pedidos pertenecientes al usuario autenticado
   */
  async listarMisPedidos(usuarioId: number): Promise<any[]> {
    await pagosService.cancelarVencidos(null, { usuarioId });

    const consulta = `
      SELECT 
        p.id,
        p.codigo_rastreo AS "codigoRastreo",
        p.subtotal,
        p.costo_envio AS "costoEnvio",
        p.total,
        p.estado,
        p.ciudad,
        p.creado_en AS "creadoEn",
        (SELECT COUNT(*)::int FROM pedido_items pi WHERE pi.pedido_id = p.id) AS "totalArticulos",
        pg.metodo AS "metodoPago",
        pg.estado AS "estadoPago"
      FROM pedidos p
      LEFT JOIN pagos pg ON pg.pedido_id = p.id
      WHERE p.usuario_id = $1
      ORDER BY p.creado_en DESC;
    `;
    const res = await consultar(consulta, [usuarioId]);
    return res.rows.map((r) => ({
      ...r,
      subtotal: Number(r.subtotal),
      costoEnvio: Number(r.costoEnvio),
      total: Number(r.total)
    }));
  }

  /**
   * Obtiene la ficha completa de un pedido por codigo de rastreo.
   * Reutiliza obtenerDetalle para aplicar exactamente la misma regla de
   * propiedad: el cliente solo puede leer pedidos de su propia cuenta.
   */
  async obtenerDetallePorCodigo(
    codigoRastreo: string,
    usuarioId: number,
    rolUsuario: RolUsuario
  ): Promise<PedidoCompleto> {
    const res = await consultar(
      'SELECT id FROM pedidos WHERE codigo_rastreo = $1',
      [codigoRastreo]
    );

    if (res.rows.length === 0) {
      throw new AppError('Pedido no encontrado', 404);
    }

    return this.obtenerDetalle(Number(res.rows[0].id), usuarioId, rolUsuario);
  }

  /**
   * Obtiene la ficha completa de un pedido.
   * Regla de seguridad: un cliente NO puede ver pedidos ajenos (403/404).
   */
  async obtenerDetalle(pedidoId: number, usuarioId: number, rolUsuario: RolUsuario): Promise<PedidoCompleto> {
    await pagosService.cancelarVencidos(null, { pedidoId });

    const resPed = await consultar(
      `SELECT 
        p.id,
        p.usuario_id AS "usuarioId",
        p.codigo_rastreo AS "codigoRastreo",
        p.subtotal,
        p.costo_envio AS "costoEnvio",
        p.total,
        p.estado,
        p.nombre_cliente AS "nombreCliente",
        p.celular_cliente AS "celularCliente",
        p.correo_cliente AS "correoCliente",
        p.ciudad,
        p.direccion,
        p.notas,
        p.creado_en AS "creadoEn"
       FROM pedidos p
       WHERE p.id = $1`,
      [pedidoId]
    );

    if (resPed.rows.length === 0) {
      throw new AppError('Pedido no encontrado', 404);
    }

    const pedido = resPed.rows[0];

    // Control de acceso: los clientes solo pueden ver pedidos propios
    if (rolUsuario === 'cliente' && pedido.usuarioId !== usuarioId) {
      throw new AppError('Acceso denegado: no tiene autorizacion para visualizar este pedido', 403);
    }

    // Obtener items
    const resItems = await consultar(
      `SELECT 
        pi.id,
        pi.variante_id AS "varianteId",
        p.nombre AS "productoNombre",
        v.nombre AS "varianteNombre",
        v.sku,
        pi.cantidad,
        pi.precio_unitario AS "precioUnitario",
        pi.subtotal,
        (
          SELECT img.url 
          FROM imagenes_producto img 
          WHERE img.producto_id = p.id 
          ORDER BY img.es_principal DESC, img.orden ASC 
          LIMIT 1
        ) AS imagen
       FROM pedido_items pi
       INNER JOIN variantes v ON v.id = pi.variante_id
       INNER JOIN productos p ON p.id = v.producto_id
       WHERE pi.pedido_id = $1
       ORDER BY pi.id ASC`,
      [pedidoId]
    );

    // Obtener pago
    const resPago = await consultar(
      `SELECT metodo, monto, moneda, estado, referencia, pagado_en AS "pagadoEn",
              fecha_vencimiento AS "fechaVencimiento", comprobante_url AS "comprobanteUrl",
              motivo_rechazo AS "motivoRechazo",
              monto_usd AS "montoUsd", tipo_cambio_bob_usd AS "tipoCambioBobUsd",
              paypal_order_id AS "paypalOrderId"
       FROM pagos WHERE pedido_id = $1`,
      [pedidoId]
    );

    // Obtener envio y su linea de tiempo
    const resEnvio = await consultar(
      'SELECT id, codigo_rastreo AS "codigoRastreo", estado, transportista, fecha_despacho AS "fechaDespacho", fecha_entrega AS "fechaEntrega" FROM envios WHERE pedido_id = $1',
      [pedidoId]
    );

    let envioCompleto = undefined;
    if (resEnvio.rows.length > 0) {
      const envio = resEnvio.rows[0];
      const resEventos = await consultar(
        `SELECT ee.id, ee.estado, ee.descripcion, ee.creado_en AS "creadoEn", u.nombre AS "usuarioNombre"
         FROM envio_eventos ee
         LEFT JOIN usuarios u ON u.id = ee.usuario_id
         WHERE ee.envio_id = $1
         ORDER BY ee.creado_en ASC`,
        [envio.id]
      );
      envioCompleto = {
        ...envio,
        eventos: resEventos.rows
      };
    }

    let pagoCompleto: PedidoCompleto['pago'] = undefined;
    if (resPago.rows.length > 0) {
      const pago: NonNullable<PedidoCompleto['pago']> = {
        ...resPago.rows[0],
        monto: Number(resPago.rows[0].monto),
        montoUsd:
          resPago.rows[0].montoUsd === null ? null : Number(resPago.rows[0].montoUsd),
        tipoCambioBobUsd:
          resPago.rows[0].tipoCambioBobUsd === null
            ? null
            : Number(resPago.rows[0].tipoCambioBobUsd),
        avisoSimulacion: obtenerDatosCobro().avisoSimulacion
      };

      if (pago.metodo === 'qr_simple') {
        pago.qrDataUrl = await generarQrSimulado(
          pedido.codigoRastreo,
          pago.monto,
          pago.referencia
        );
      }

      pagoCompleto = pago;
    }

    return {
      ...pedido,
      subtotal: Number(pedido.subtotal),
      costoEnvio: Number(pedido.costoEnvio),
      total: Number(pedido.total),
      items: resItems.rows.map((i) => ({
        ...i,
        precioUnitario: Number(i.precioUnitario),
        subtotal: Number(i.subtotal)
      })),
      pago: pagoCompleto,
      envio: envioCompleto
    };
  }
}

export const pedidosService = new PedidosService();
