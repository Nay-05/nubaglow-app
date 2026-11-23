/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DEL TOTEM DE AUTOSERVICIO
 * ============================================================================
 * Cumple con AGENTS.md (modo autoservicio y ventas POS):
 * 1. Catalogo publico con stock real por variante para la pantalla tactil.
 * 2. Venta atomica con SELECT ... FOR UPDATE en orden ascendente (anti-deadlock).
 * 3. Totales y precios calculados exclusivamente en el servidor.
 * 4. Descuento de stock con movimiento de Kardex tipo 'venta_pos'.
 * 5. Registro en ventas_pos con canal = 'totem', codigo de autorizacion de la
 *    tarjeta ATM y ultimos 4 digitos simulados.
 * 6. Ticket con codigo QR de rastreo generado en el servidor.
 * 7. Auditoria de cada venta de autoservicio.
 */

import QRCode from 'qrcode';
import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import {
  CrearVentaTotemInput,
  METODO_TARJETA_ATM
} from '../schemas/totem.schema';

export interface VarianteTotem {
  varianteId: number;
  productoId: number;
  productoNombre: string;
  slug: string;
  marca: string;
  tipoPiel: string;
  categoriaId: number;
  categoriaNombre: string;
  categoriaSlug: string;
  varianteNombre: string;
  sku: string;
  precio: number;
  stock: number;
  imagen: string | null;
}

export interface ItemTicketTotem {
  varianteId: number;
  productoNombre: string;
  varianteNombre: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface TicketTotem {
  id: number;
  numeroTicket: string;
  canal: 'totem';
  creadoEn: string | Date;
  clienteNombre: string;
  clienteNitCi: string | null;
  metodoPago: string;
  subtotal: number;
  total: number;
  codigoAutorizacion: string;
  tarjetaUltimos4: string | null;
  numeroFactura: string;
  codigoRastreo: string;
  qrRastreo: string;
  items: ItemTicketTotem[];
  empresa: { nombre: string; ciudad: string };
  esSimulacion: boolean;
}

export class TotemService {
  /**
   * Catalogo tactil: categorias y variantes activas con stock disponible.
   */
  async catalogo() {
    const [resCategorias, resVariantes] = await Promise.all([
      consultar(
        `SELECT id, nombre, slug
         FROM categorias
         ORDER BY nombre ASC`
      ),
      consultar(
        `SELECT
           v.id AS "varianteId",
           v.nombre AS "varianteNombre",
           v.sku,
           v.precio,
           v.stock,
           p.id AS "productoId",
           p.nombre AS "productoNombre",
           p.slug,
           p.marca,
           p.tipo_piel AS "tipoPiel",
           c.id AS "categoriaId",
           c.nombre AS "categoriaNombre",
           c.slug AS "categoriaSlug",
           (
             SELECT img.url
             FROM imagenes_producto img
             WHERE img.producto_id = p.id
             ORDER BY img.es_principal DESC, img.orden ASC
             LIMIT 1
           ) AS imagen
         FROM categorias c
         INNER JOIN productos p
           ON p.categoria_id = c.id AND p.activo = TRUE
         INNER JOIN variantes v
           ON v.producto_id = p.id AND v.activo = TRUE
         WHERE v.stock > 0
         ORDER BY c.nombre ASC, p.nombre ASC, v.precio ASC`
      )
    ]);

    const variantes: VarianteTotem[] = resVariantes.rows.map((fila) => ({
      varianteId: Number(fila.varianteId),
      productoId: Number(fila.productoId),
      productoNombre: fila.productoNombre,
      slug: fila.slug,
      marca: fila.marca,
      tipoPiel: fila.tipoPiel,
      categoriaId: Number(fila.categoriaId),
      categoriaNombre: fila.categoriaNombre,
      categoriaSlug: fila.categoriaSlug,
      varianteNombre: fila.varianteNombre,
      sku: fila.sku,
      precio: Number(fila.precio),
      stock: Number(fila.stock),
      imagen: fila.imagen || null
    }));

    return {
      categorias: resCategorias.rows,
      variantes
    };
  }

  private async generarTicketUnico(cliente: any): Promise<string> {
    for (let intento = 0; intento < 10; intento += 1) {
      const aleatorio = Math.floor(1000 + Math.random() * 9000);
      const candidato = `NB-TOTEM-${aleatorio}`;
      const res = await cliente.query(
        'SELECT id FROM ventas_pos WHERE numero_ticket = $1',
        [candidato]
      );
      if (res.rows.length === 0) return candidato;
    }
    return `NB-TOTEM-${Date.now().toString().slice(-6)}`;
  }

  private async generarFacturaUnica(cliente: any): Promise<string> {
    for (let intento = 0; intento < 10; intento += 1) {
      const aleatorio = Math.floor(1000 + Math.random() * 9000);
      const candidato = `FAC-TOTEM-${aleatorio}`;
      const res = await cliente.query(
        'SELECT id FROM facturas WHERE numero_factura = $1',
        [candidato]
      );
      if (res.rows.length === 0) return candidato;
    }
    return `FAC-TOTEM-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Vendedor responsable del totem. Se puede fijar por variable de entorno
   * TOTEM_VENDEDOR_EMAIL; si no, se usa el primer vendedor o admin activo.
   */
  private async obtenerVendedorSistema(cliente: any): Promise<number> {
    const correoConfigurado = (process.env.TOTEM_VENDEDOR_EMAIL || '').trim();

    if (correoConfigurado) {
      const resCorreo = await cliente.query(
        `SELECT id FROM usuarios
         WHERE LOWER(email) = LOWER($1) AND activo = TRUE
           AND rol IN ('vendedor', 'admin')
         LIMIT 1`,
        [correoConfigurado]
      );
      if (resCorreo.rows.length > 0) {
        return Number(resCorreo.rows[0].id);
      }
    }

    const res = await cliente.query(
      `SELECT id FROM usuarios
       WHERE activo = TRUE AND rol IN ('vendedor', 'admin')
       ORDER BY CASE WHEN rol = 'vendedor' THEN 0 ELSE 1 END, id ASC
       LIMIT 1`
    );

    if (res.rows.length === 0) {
      throw new AppError(
        'El totem no tiene un usuario vendedor configurado. ' +
          'Solicite al administrador crear una cuenta de vendedor.',
        503
      );
    }

    return Number(res.rows[0].id);
  }

  /**
   * Simulacion del banco emisor: valida el PIN de 4 digitos.
   * No se almacena el PIN ni se registra en logs.
   */
  private validarPinSimulado(pin: string): void {
    if (!/^\d{4}$/.test(pin)) {
      throw new AppError('El PIN debe tener exactamente 4 digitos', 400);
    }
    if (/^(\d)\1{3}$/.test(pin)) {
      throw new AppError(
        'PIN rechazado por el banco emisor (simulacion). ' +
          'No use cuatro digitos iguales.',
        400
      );
    }
  }

  private generarAutorizacion(metodoPago: string): string {
    const aleatorio = Math.floor(100000 + Math.random() * 900000);
    const prefijo = metodoPago === METODO_TARJETA_ATM ? 'AUTH' : 'QRB';
    return `${prefijo}-${aleatorio}`;
  }

  private async generarQrTicket(ticket: string, total: number) {
    const contenido = [
      'NUBAGLOW - AUTOSERVICIO',
      `Ticket: ${ticket}`,
      `Total: Bs. ${Number(total).toFixed(2)}`,
      'Comprobante academico de simulacion'
    ].join('\n');

    return QRCode.toDataURL(contenido, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 260
    });
  }

  /**
   * Registra la venta del totem y descuenta stock en una sola transaccion.
   */
  async registrarVenta(datos: CrearVentaTotemInput): Promise<TicketTotem> {
    const pagoConTarjeta = datos.metodo_pago === METODO_TARJETA_ATM;

    if (pagoConTarjeta) {
      this.validarPinSimulado(datos.pin || '');
    }

    const itemsOrdenados = [...datos.items].sort(
      (a, b) => a.variante_id - b.variante_id
    );
    const idsVariantes = itemsOrdenados.map((item) => item.variante_id);

    const venta = await conTransaccion(async (cliente) => {
      const vendedorId = await this.obtenerVendedorSistema(cliente);

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
      resBloqueo.rows.forEach((fila) => {
        mapaVariantes.set(Number(fila.id), fila);
      });

      let totalCalculado = 0;
      const itemsProcesados: Array<
        ItemTicketTotem & { stockAnterior: number; stockNuevo: number }
      > = [];

      for (const item of itemsOrdenados) {
        const info = mapaVariantes.get(item.variante_id);

        if (!info || !info.varianteActiva || !info.productoActivo) {
          throw new AppError(
            'Uno de los articulos seleccionados ya no esta disponible',
            400
          );
        }

        const stockActual = Number(info.stock);
        if (stockActual < item.cantidad) {
          throw new AppError(
            `Stock insuficiente para '${info.productoNombre} - ` +
              `${info.varianteNombre}'. Disponible: ${stockActual}`,
            400
          );
        }

        const precioUnitario = Number(info.precio);
        const subtotal = Math.round(precioUnitario * item.cantidad * 100) / 100;
        totalCalculado += subtotal;

        itemsProcesados.push({
          varianteId: Number(info.id),
          productoNombre: info.productoNombre,
          varianteNombre: info.varianteNombre,
          sku: info.sku,
          cantidad: item.cantidad,
          precioUnitario,
          subtotal,
          stockAnterior: stockActual,
          stockNuevo: stockActual - item.cantidad
        });
      }

      totalCalculado = Math.round(totalCalculado * 100) / 100;

      if (totalCalculado <= 0) {
        throw new AppError('El total del pedido no es valido', 400);
      }

      const numeroTicket = await this.generarTicketUnico(cliente);
      const codigoAutorizacion = this.generarAutorizacion(datos.metodo_pago);
      const clienteNombre = (datos.cliente_nombre || '').trim() || 'Consumidor Final';
      const clienteNitCi = (datos.cliente_nit_ci || '').trim() || null;
      const ultimos4 = pagoConTarjeta ? datos.tarjeta_ultimos4 || null : null;

      const detalle = itemsProcesados.map((item) => ({
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
            cliente_correo, detalle, canal, codigo_autorizacion,
            tarjeta_ultimos4)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, 'totem', $11, $12)
         RETURNING id, creado_en`,
        [
          numeroTicket,
          vendedorId,
          totalCalculado,
          totalCalculado,
          datos.metodo_pago,
          totalCalculado,
          0,
          clienteNombre,
          clienteNitCi,
          JSON.stringify(detalle),
          codigoAutorizacion,
          ultimos4
        ]
      );

      const ventaId = Number(resVenta.rows[0].id);

      for (const item of itemsProcesados) {
        await cliente.query(
          'UPDATE variantes SET stock = stock - $1 WHERE id = $2',
          [item.cantidad, item.varianteId]
        );

        await cliente.query(
          `INSERT INTO movimientos_inventario
             (variante_id, tipo, cantidad, stock_anterior, stock_nuevo,
              motivo, usuario_id)
           VALUES ($1, 'venta_pos', $2, $3, $4, $5, $6)`,
          [
            item.varianteId,
            item.cantidad,
            item.stockAnterior,
            item.stockNuevo,
            `Venta autoservicio totem ticket ${numeroTicket}`,
            vendedorId
          ]
        );
      }

      const numeroFactura = await this.generarFacturaUnica(cliente);
      await cliente.query(
        `INSERT INTO facturas
           (venta_pos_id, numero_factura, tipo, monto_total, es_simulacion)
         VALUES ($1, $2, 'venta_pos', $3, TRUE)`,
        [ventaId, numeroFactura, totalCalculado]
      );

      await cliente.query(
        `INSERT INTO auditoria
           (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'VENTA_TOTEM', 'ventas_pos', $2, $3)`,
        [
          vendedorId,
          ventaId,
          JSON.stringify({
            numeroTicket,
            total: totalCalculado,
            metodoPago: datos.metodo_pago,
            canal: 'totem',
            codigoAutorizacion,
            items: itemsProcesados.map((item) => ({
              sku: item.sku,
              cantidad: item.cantidad
            }))
          })
        ]
      );

      return {
        id: ventaId,
        numeroTicket,
        creadoEn: resVenta.rows[0].creado_en,
        clienteNombre,
        clienteNitCi,
        metodoPago: datos.metodo_pago,
        subtotal: totalCalculado,
        total: totalCalculado,
        codigoAutorizacion,
        tarjetaUltimos4: ultimos4,
        numeroFactura,
        items: itemsProcesados.map((item) => ({
          varianteId: item.varianteId,
          productoNombre: item.productoNombre,
          varianteNombre: item.varianteNombre,
          sku: item.sku,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal
        }))
      };
    });

    let qrRastreo = '';
    try {
      qrRastreo = await this.generarQrTicket(venta.numeroTicket, venta.total);
    } catch (error) {
      console.error('No se pudo generar el QR del ticket del totem:', error);
    }

    return {
      ...venta,
      canal: 'totem',
      codigoRastreo: venta.numeroTicket,
      qrRastreo,
      empresa: { nombre: 'NubaGlow', ciudad: 'Sucre, Bolivia' },
      esSimulacion: true
    };
  }
}

export const totemService = new TotemService();
