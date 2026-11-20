/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE VENTAS POS (MOSTRADOR) Y FACTURACION
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 7, 8 y 9:
 * 1. Transaccion atomica con conTransaccion.
 * 2. Bloqueo FOR UPDATE en orden ascendente (anti-deadlock).
 * 3. Precios y total calculados 100% en el servidor.
 * 4. Descuento de stock y registro Kardex en movimientos_inventario.
 * 5. vendedor_id obtenido estrictamente del token verificado.
 * 6. Emision correlativa de factura/recibo en tabla facturas.
 * 7. Historial y cierre de caja: vendedor solo ve lo suyo, admin ve todo.
 */

import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import { RolUsuario } from '../types';
import { CrearVentaPosInput } from '../schemas/staff.schema';
import {
  crearCorreoReciboPos,
  notificacionesService
} from './notificaciones.service';
import { posPdfService } from './posPdf.service';

export interface VentaPosResumen {
  id: number;
  numeroTicket: string;
  vendedorId: number;
  vendedorNombre: string;
  subtotal: number;
  total: number;
  metodoPago: string;
  montoRecibido: number;
  cambio: number;
  clienteNombre: string | null;
  clienteNitCi: string | null;
  clienteCorreo: string | null;
  creadoEn: string;
  factura?: {
    id: number;
    numeroFactura: string;
    montoTotal: number;
    esSimulacion: boolean;
  };
  items: Array<{
    varianteId: number;
    productoNombre: string;
    varianteNombre: string;
    sku: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
}

export class PosService {
  private async generarTicketUnico(clienteSql: any): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const aleatorio = Math.floor(1000 + Math.random() * 9000);
      const candidato = `TICK-2026-${aleatorio}`;
      const res = await clienteSql.query('SELECT id FROM ventas_pos WHERE numero_ticket = $1', [candidato]);
      if (res.rows.length === 0) return candidato;
    }
    return `TICK-2026-${Date.now().toString().slice(-5)}`;
  }

  private async generarFacturaUnica(clienteSql: any): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const aleatorio = Math.floor(1000 + Math.random() * 9000);
      const candidato = `FAC-POS-${aleatorio}`;
      const res = await clienteSql.query('SELECT id FROM facturas WHERE numero_factura = $1', [candidato]);
      if (res.rows.length === 0) return candidato;
    }
    return `FAC-POS-${Date.now().toString().slice(-5)}`;
  }

  /**
   * Registra una venta de mostrador POS en una sola transaccion
   */
  async registrarVentaPos(vendedorId: number, datos: CrearVentaPosInput): Promise<VentaPosResumen> {
    // 1. Ordenar items por id de variante ascendente (anti-deadlock)
    const itemsOrdenados = [...datos.items].sort((a, b) => a.variante_id - b.variante_id);
    const idsVariantes = itemsOrdenados.map((i) => i.variante_id);

    const venta = await conTransaccion(async (cliente) => {
      // 2. Bloquear filas con SELECT ... FOR UPDATE
      const resBloqueo = await cliente.query(
        `SELECT 
          v.id, 
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
      resBloqueo.rows.forEach((r) => mapaVariantes.set(r.id, r));

      // 3. Validar disponibilidad y calcular subtotal
      let totalCalculado = 0;
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
        const info = mapaVariantes.get(item.variante_id);
        if (!info || !info.varianteActiva || !info.productoActivo) {
          throw new AppError(`El articulo '${info ? info.productoNombre : item.variante_id}' no esta disponible`, 400);
        }

        if (info.stock < item.cantidad) {
          throw new AppError(
            `Stock insuficiente para '${info.productoNombre} - ` +
              `${info.varianteNombre}'. Disponible: ${info.stock}, ` +
              `solicitado: ${item.cantidad}`,
            400
          );
        }

        const precioReal = Number(info.precio);
        const subtotalItem = Math.round(precioReal * item.cantidad * 100) / 100;
        totalCalculado += subtotalItem;

        itemsProcesados.push({
          varianteId: item.variante_id,
          productoNombre: info.productoNombre,
          varianteNombre: info.varianteNombre,
          sku: info.sku,
          cantidad: item.cantidad,
          precioUnitario: precioReal,
          subtotal: subtotalItem,
          stockAnterior: info.stock,
          stockNuevo: info.stock - item.cantidad
        });
      }

      totalCalculado = Math.round(totalCalculado * 100) / 100;

      // 4. Validar monto recibido y calcular cambio
      let montoRecibido = Number(datos.monto_recibido) || 0;
      let cambio = 0;

      if (datos.metodo_pago === 'Efectivo') {
        if (montoRecibido < totalCalculado) {
          throw new AppError(
            `El monto recibido (${montoRecibido} Bs.) es menor al total a cobrar (${totalCalculado} Bs.)`,
            400
          );
        }
        cambio = Math.round((montoRecibido - totalCalculado) * 100) / 100;
      } else {
        // En QR Simple se cobra el monto exacto
        montoRecibido = totalCalculado;
        cambio = 0;
      }

      // 5. Generar ticket y registrar venta_pos
      const numeroTicket = await this.generarTicketUnico(cliente);

      const detalleVenta = itemsProcesados.map((item) => ({
        productoNombre: item.productoNombre,
        varianteNombre: item.varianteNombre,
        sku: item.sku,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal
      }));

      const resVenta = await cliente.query(
        `INSERT INTO ventas_pos
         (numero_ticket, vendedor_id, subtotal, total, metodo_pago,
          monto_recibido, cambio, cliente_nombre, cliente_nit_ci,
          cliente_correo, detalle)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, creado_en`,
        [
          numeroTicket,
          vendedorId,
          totalCalculado,
          totalCalculado,
          datos.metodo_pago,
          montoRecibido,
          cambio,
          datos.cliente_nombre?.trim() || null,
          datos.cliente_nit_ci?.trim() || null,
          datos.cliente_correo?.trim() || null,
          JSON.stringify(detalleVenta)
        ]
      );
      const ventaId = resVenta.rows[0].id;

      // 6. Descontar stock y registrar Kardex de cada variante
      for (const item of itemsProcesados) {
        await cliente.query('UPDATE variantes SET stock = stock - $1 WHERE id = $2', [
          item.cantidad,
          item.varianteId
        ]);

        await cliente.query(
          `INSERT INTO movimientos_inventario 
           (variante_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id)
           VALUES ($1, 'venta_pos', $2, $3, $4, $5, $6)`,
          [
            item.varianteId,
            item.cantidad,
            item.stockAnterior,
            item.stockNuevo,
            `Venta mostrador POS ticket ${numeroTicket}`,
            vendedorId
          ]
        );
      }

      // 7. Emitir registro correlativo de factura
      const numeroFactura = await this.generarFacturaUnica(cliente);
      const resFac = await cliente.query(
        `INSERT INTO facturas (venta_pos_id, numero_factura, tipo, monto_total, es_simulacion)
         VALUES ($1, $2, 'venta_pos', $3, TRUE)
         RETURNING id, numero_factura, monto_total, es_simulacion`,
        [ventaId, numeroFactura, totalCalculado]
      );

      // 8. Auditoria
      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'VENTA_POS', 'ventas_pos', $2, $3)`,
        [
          vendedorId,
          ventaId,
          JSON.stringify({
            numeroTicket,
            total: totalCalculado,
            metodoPago: datos.metodo_pago,
            items: itemsProcesados.map((i) => ({ sku: i.sku, cantidad: i.cantidad }))
          })
        ]
      );

      // Obtener nombre del vendedor
      const resVendedor = await cliente.query('SELECT nombre FROM usuarios WHERE id = $1', [vendedorId]);

      return {
        id: ventaId,
        numeroTicket,
        vendedorId,
        vendedorNombre: resVendedor.rows[0]?.nombre || 'Vendedor Nuba',
        subtotal: totalCalculado,
        total: totalCalculado,
        metodoPago: datos.metodo_pago,
        montoRecibido,
        cambio,
        clienteNombre: datos.cliente_nombre || null,
        clienteNitCi: datos.cliente_nit_ci || null,
        clienteCorreo: datos.cliente_correo || null,
        creadoEn: resVenta.rows[0].creado_en,
        factura: {
          id: resFac.rows[0].id,
          numeroFactura: resFac.rows[0].numero_factura,
          montoTotal: Number(resFac.rows[0].monto_total),
          esSimulacion: resFac.rows[0].es_simulacion
        },
        items: itemsProcesados.map((i) => ({
          varianteId: i.varianteId,
          productoNombre: i.productoNombre,
          varianteNombre: i.varianteNombre,
          sku: i.sku,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          subtotal: i.subtotal
        }))
      };
    });

    // Envío opcional del comprobante fuera de la transacción.
    if (venta.clienteCorreo) {
      try {
        const adjunto = await posPdfService.generar(venta);
        await notificacionesService.enviarCorreo({
          pedidoId: null,
          destinatario: venta.clienteCorreo,
          asunto: `NubaGlow: comprobante de venta ${venta.numeroTicket}`,
          cuerpo: [
            `Hola ${venta.clienteNombre || 'cliente'},`,
            '',
            'Gracias por tu compra en NubaGlow.',
            `Ticket: ${venta.numeroTicket}`,
            `Factura: ${venta.factura?.numeroFactura || 'Sin factura'}`,
            `Total: Bs. ${Number(venta.total).toFixed(2)}`,
            `Método de pago: ${venta.metodoPago}`,
            '',
            'Adjuntamos tu comprobante en PDF.',
            'Comprobante académico de simulación — Sin valor fiscal.'
          ].join('\n'),
          adjuntos: [
            {
              filename: adjunto.nombreArchivo,
              content: adjunto.buffer,
              contentType: 'application/pdf'
            }
          ]
        });
      } catch (error) {
        console.error(
          'No se pudo generar o enviar el comprobante POS:',
          error
        );
      }
    }

    return venta;
  }

  /**
   * Devuelve una venta con su detalle para el comprobante PDF.
   */
  async obtenerVentaDetalle(
    ventaId: number,
    usuarioId: number,
    rolUsuario: RolUsuario
  ) {
    const res = await consultar(
      `SELECT vp.id,
              vp.numero_ticket AS "numeroTicket",
              vp.vendedor_id AS "vendedorId",
              u.nombre AS "vendedorNombre",
              vp.subtotal,
              vp.total,
              vp.metodo_pago AS "metodoPago",
              vp.monto_recibido AS "montoRecibido",
              vp.cambio,
              vp.cliente_nombre AS "clienteNombre",
              vp.cliente_nit_ci AS "clienteNitCi",
              vp.cliente_correo AS "clienteCorreo",
              vp.detalle,
              vp.creado_en AS "creadoEn",
              f.numero_factura AS "numeroFactura"
       FROM ventas_pos vp
       INNER JOIN usuarios u ON u.id = vp.vendedor_id
       LEFT JOIN facturas f ON f.venta_pos_id = vp.id
       WHERE vp.id = $1`,
      [ventaId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Venta POS no encontrada', 404);
    }

    const venta = res.rows[0];

    if (
      rolUsuario === 'vendedor' &&
      Number(venta.vendedorId) !== Number(usuarioId)
    ) {
      throw new AppError('Acceso denegado: la venta no le pertenece', 403);
    }

    const items = Array.isArray(venta.detalle) ? venta.detalle : [];

    return {
      ...venta,
      subtotal: Number(venta.subtotal),
      total: Number(venta.total),
      montoRecibido: Number(venta.montoRecibido),
      cambio: Number(venta.cambio),
      items
    };
  }

  /**
   * Historial de ventas POS:
   * - Vendedor solo ve las suyas
   * - Admin ve todas
   */
  async historialVentas(
    vendedorId: number,
    rolUsuario: RolUsuario,
    fecha?: string
  ) {
    const condiciones: string[] = [];
    const parametros: any[] = [];

    if (rolUsuario === 'vendedor') {
      parametros.push(vendedorId);
      condiciones.push(`vp.vendedor_id = $${parametros.length}`);
    }

    if (fecha) {
      parametros.push(fecha);
      condiciones.push(
        `(vp.creado_en AT TIME ZONE 'America/La_Paz')::date = ` +
          `$${parametros.length}::date`
      );
    }

    const clausulaWhere =
      condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const consulta = `
      SELECT 
        vp.id,
        vp.numero_ticket AS "numeroTicket",
        vp.vendedor_id AS "vendedorId",
        u.nombre AS "vendedorNombre",
        vp.subtotal,
        vp.total,
        vp.metodo_pago AS "metodoPago",
        vp.monto_recibido AS "montoRecibido",
        vp.cambio,
        vp.cliente_nombre AS "clienteNombre",
        vp.cliente_nit_ci AS "clienteNitCi",
        vp.cliente_correo AS "clienteCorreo",
        vp.creado_en AS "creadoEn",
        f.numero_factura AS "numeroFactura"
      FROM ventas_pos vp
      INNER JOIN usuarios u ON u.id = vp.vendedor_id
      LEFT JOIN facturas f ON f.venta_pos_id = vp.id
      ${clausulaWhere}
      ORDER BY vp.creado_en DESC
      LIMIT 100;
    `;

    const res = await consultar(consulta, parametros);
    return res.rows.map((r) => ({
      ...r,
      subtotal: Number(r.subtotal),
      total: Number(r.total),
      montoRecibido: Number(r.montoRecibido),
      cambio: Number(r.cambio)
    }));
  }

  /**
   * Cierre de caja diario
   */
  async cierreCaja(vendedorId: number, rolUsuario: RolUsuario, fecha?: string) {
    const fechaFiltro =
      fecha ||
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/La_Paz'
      }).format(new Date());
    const parametros: any[] = [fechaFiltro];

    let filtroVendedor = '';
    if (rolUsuario === 'vendedor') {
      filtroVendedor = 'AND vp.vendedor_id = $2';
      parametros.push(vendedorId);
    }

    const consulta = `
      SELECT 
        COUNT(*)::int AS "totalTickets",
        COALESCE(SUM(total), 0)::numeric AS "totalRecaudado",
        COALESCE(SUM(CASE WHEN metodo_pago = 'Efectivo' THEN total ELSE 0 END), 0)::numeric AS "totalEfectivo",
        COALESCE(SUM(CASE WHEN metodo_pago = 'QR Simple' THEN total ELSE 0 END), 0)::numeric AS "totalQR"
      FROM ventas_pos vp
      WHERE (vp.creado_en AT TIME ZONE 'America/La_Paz')::date = $1::date
        ${filtroVendedor};
    `;

    const res = await consultar(consulta, parametros);
    const fila = res.rows[0];

    return {
      fecha: fechaFiltro,
      totalTickets: fila.totalTickets,
      totalRecaudado: Number(fila.totalRecaudado),
      totalEfectivo: Number(fila.totalEfectivo),
      totalQR: Number(fila.totalQR)
    };
  }
}

export const posService = new PosService();
