/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE INVENTARIO, KARDEX Y DESPACHOS
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 7, 8 y 9:
 * 1. Control de stock por variante con indicador de stock bajo (alerta de reorden).
 * 2. Ingreso de mercaderia y ajustes manuales con motivo y responsable obligatorio.
 * 3. Restriccion critica: El stock nunca puede quedar negativo (CHECK en BD y logica).
 * 4. Registro inmutable en movimientos_inventario y auditoria.
 * 5. Historial completo (Kardex) por variante.
 * 6. Cola unificada de pedidos pendientes de despacho.
 */

import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import { AjusteInventarioInput } from '../schemas/staff.schema';

export interface ItemInventario {
  varianteId: number;
  sku: string;
  nombreVariante: string;
  productoId: number;
  productoNombre: string;
  categoriaNombre: string;
  precio: number;
  stock: number;
  puntoReorden: number;
  alertaStockBajo: boolean;
  activo: boolean;
}

export class InventarioService {
  /**
   * Listado de inventario consolidado con indicador de stock bajo
   */
  async listarInventario(soloStockBajo: boolean = false): Promise<ItemInventario[]> {
    const consulta = `
      SELECT 
        v.id AS "varianteId",
        v.sku,
        v.nombre AS "nombreVariante",
        p.id AS "productoId",
        p.nombre AS "productoNombre",
        c.nombre AS "categoriaNombre",
        v.precio,
        v.stock,
        v.punto_reorden AS "puntoReorden",
        (v.stock <= v.punto_reorden) AS "alertaStockBajo",
        v.activo
      FROM variantes v
      INNER JOIN productos p ON p.id = v.producto_id
      INNER JOIN categorias c ON c.id = p.categoria_id
      ${soloStockBajo ? 'WHERE v.stock <= v.punto_reorden' : ''}
      ORDER BY "alertaStockBajo" DESC, p.nombre ASC, v.precio ASC;
    `;

    const res = await consultar(consulta);
    return res.rows.map((r) => ({
      ...r,
      precio: Number(r.precio),
      stock: Number(r.stock),
      puntoReorden: Number(r.puntoReorden)
    }));
  }

  /**
   * Registra un ingreso de mercaderia o ajuste manual de inventario
   */
  async ajustarStock(varianteId: number, datos: AjusteInventarioInput, usuarioId: number) {
    return await conTransaccion(async (cliente) => {
      // 1. Bloquear y obtener variante actual
      const resVar = await cliente.query(
        `SELECT v.id, v.sku, v.stock, v.nombre AS "varianteNombre", p.nombre AS "productoNombre"
         FROM variantes v
         INNER JOIN productos p ON p.id = v.producto_id
         WHERE v.id = $1
         FOR UPDATE OF v`,
        [varianteId]
      );

      if (resVar.rows.length === 0) {
        throw new AppError('Variante de producto no encontrada', 404);
      }

      const variante = resVar.rows[0];
      const stockAnterior = Number(variante.stock);
      let stockNuevo = stockAnterior;

      if (datos.tipo === 'entrada') {
        if (datos.cantidad <= 0) {
          throw new AppError('La cantidad de ingreso de mercaderia debe ser mayor a 0', 400);
        }
        stockNuevo = stockAnterior + datos.cantidad;
      } else if (datos.tipo === 'ajuste') {
        // En ajuste, datos.cantidad es el nuevo stock absoluto o el delta
        stockNuevo = stockAnterior + datos.cantidad;
      }

      // Regla estricta: el stock nunca puede ser menor a 0
      if (stockNuevo < 0) {
        throw new AppError(
          `Operacion denegada: el ajuste resultaria en stock negativo (${stockNuevo}). Stock actual: ${stockAnterior}`,
          400
        );
      }

      // 2. Actualizar stock en variantes
      await cliente.query('UPDATE variantes SET stock = $1, actualizado_en = NOW() WHERE id = $2', [
        stockNuevo,
        varianteId
      ]);

      // 3. Registrar en Kardex movimientos_inventario
      const deltaCantidad = Math.abs(stockNuevo - stockAnterior);
      const resMov = await cliente.query(
        `INSERT INTO movimientos_inventario 
         (variante_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, creado_en`,
        [varianteId, datos.tipo, deltaCantidad, stockAnterior, stockNuevo, datos.motivo.trim(), usuarioId]
      );

      // 4. Registrar en auditoria (CLAUDE.md Seccion 9)
      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'AJUSTE_STOCK', 'variantes', $2, $3)`,
        [
          usuarioId,
          varianteId,
          JSON.stringify({
            sku: variante.sku,
            producto: variante.productoNombre,
            tipo: datos.tipo,
            stockAnterior,
            stockNuevo,
            motivo: datos.motivo.trim()
          })
        ]
      );

      return {
        varianteId,
        sku: variante.sku,
        productoNombre: variante.productoNombre,
        varianteNombre: variante.varianteNombre,
        stockAnterior,
        stockNuevo,
        tipo: datos.tipo,
        motivo: datos.motivo.trim(),
        movimientoId: resMov.rows[0].id,
        fecha: resMov.rows[0].creado_en
      };
    });
  }

  /**
   * Obtiene el historial completo (Kardex) de movimientos por variante
   */
  async obtenerKardex(varianteId: number) {
    const resVar = await consultar('SELECT id, sku FROM variantes WHERE id = $1', [varianteId]);
    if (resVar.rows.length === 0) {
      throw new AppError('Variante no encontrada', 404);
    }

    const consulta = `
      SELECT 
        mi.id,
        mi.tipo,
        mi.cantidad,
        mi.stock_anterior AS "stockAnterior",
        mi.stock_nuevo AS "stockNuevo",
        mi.motivo,
        mi.creado_en AS "fechaHora",
        u.nombre AS "usuarioResponsable"
      FROM movimientos_inventario mi
      LEFT JOIN usuarios u ON u.id = mi.usuario_id
      WHERE mi.variante_id = $1
      ORDER BY mi.creado_en DESC, mi.id DESC;
    `;

    const res = await consultar(consulta, [varianteId]);
    return {
      varianteId,
      sku: resVar.rows[0].sku,
      movimientos: res.rows
    };
  }

  /**
   * Cola de pedidos por etapa de envio.
   * Almacen consulta Pendiente/En preparacion; logistica consulta Empacado.
   */
  async colaDespachos(estados: string[] = ['Pendiente', 'En preparación']) {
    const marcadores = estados.map((_, indice) => `$${indice + 1}`).join(', ');
    const consulta = `
      SELECT 
        e.id AS "envioId",
        e.codigo_rastreo AS "codigoRastreo",
        e.estado AS "estadoEnvio",
        p.id AS "pedidoId",
        p.nombre_cliente AS "nombreCliente",
        p.celular_cliente AS "celularCliente",
        p.ciudad,
        p.direccion,
        p.total,
        p.creado_en AS "fechaPedido",
        pg.metodo AS "metodoPago",
        pg.estado AS "estadoPago",
        (
          SELECT json_agg(json_build_object(
            'producto', prod.nombre,
            'variante', v.nombre,
            'sku', v.sku,
            'cantidad', pi.cantidad
          ))
          FROM pedido_items pi
          INNER JOIN variantes v ON v.id = pi.variante_id
          INNER JOIN productos prod ON prod.id = v.producto_id
          WHERE pi.pedido_id = p.id
        ) AS items
      FROM envios e
      INNER JOIN pedidos p ON p.id = e.pedido_id
      LEFT JOIN pagos pg ON pg.pedido_id = p.id
      WHERE e.estado IN (${marcadores})
      ORDER BY p.creado_en ASC;
    `;

    const res = await consultar(consulta, estados);
    return res.rows.map((r) => ({
      ...r,
      total: Number(r.total)
    }));
  }
}

export const inventarioService = new InventarioService();
