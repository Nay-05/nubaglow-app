/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE REPORTES Y METRICAS DE GESTION
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 7 y 8:
 * - Ventas totales web vs POS (montos y conteos).
 * - Ingresos diarios discriminados por fecha (rango configurable).
 * - Ranking de productos mas vendidos (top unidades e ingresos).
 * - Restringido exclusivamente al rol 'admin'.
 */

import { consultar } from '../db';
import { ConsultaReportesInput } from '../schemas/staff.schema';

export class ReportesService {
  /**
   * Resumen global de ventas: Web vs Mostrador POS
   */
  async resumenWebVsPos() {
    // 1. Ventas Web (pedidos no cancelados)
    const resWeb = await consultar(`
      SELECT 
        COUNT(*)::int AS "totalPedidos",
        COALESCE(SUM(total), 0)::numeric AS "montoTotal"
      FROM pedidos 
      WHERE estado != 'Cancelado';
    `);

    // 2. Ventas POS
    const resPos = await consultar(`
      SELECT 
        COUNT(*)::int AS "totalTickets",
        COALESCE(SUM(total), 0)::numeric AS "montoTotal"
      FROM ventas_pos;
    `);

    const totalWeb = Number(resWeb.rows[0].montoTotal);
    const totalPos = Number(resPos.rows[0].montoTotal);
    const sumaTotal = Math.round((totalWeb + totalPos) * 100) / 100;

    return {
      granTotal: sumaTotal,
      web: {
        totalPedidos: resWeb.rows[0].totalPedidos,
        montoTotal: totalWeb,
        porcentaje: sumaTotal > 0 ? Math.round((totalWeb / sumaTotal) * 1000) / 10 : 0
      },
      pos: {
        totalTickets: resPos.rows[0].totalTickets,
        montoTotal: totalPos,
        porcentaje: sumaTotal > 0 ? Math.round((totalPos / sumaTotal) * 1000) / 10 : 0
      }
    };
  }

  /**
   * Ingresos diarios por rango de fechas (Web + POS)
   */
  async ingresosPorDia(filtros: ConsultaReportesInput) {
    const fechaDesde = filtros.desde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const fechaHasta = filtros.hasta || new Date().toISOString().slice(0, 10);

    const consulta = `
      WITH dias_web AS (
        SELECT 
          DATE(creado_en) AS fecha,
          COALESCE(SUM(total), 0)::numeric AS total_web
        FROM pedidos
        WHERE estado != 'Cancelado' AND DATE(creado_en) BETWEEN $1 AND $2
        GROUP BY DATE(creado_en)
      ),
      dias_pos AS (
        SELECT 
          DATE(creado_en) AS fecha,
          COALESCE(SUM(total), 0)::numeric AS total_pos
        FROM ventas_pos
        WHERE DATE(creado_en) BETWEEN $1 AND $2
        GROUP BY DATE(creado_en)
      ),
      todas_fechas AS (
        SELECT fecha FROM dias_web
        UNION
        SELECT fecha FROM dias_pos
      )
      SELECT 
        tf.fecha,
        COALESCE(dw.total_web, 0)::numeric AS "ingresosWeb",
        COALESCE(dp.total_pos, 0)::numeric AS "ingresosPos",
        (COALESCE(dw.total_web, 0) + COALESCE(dp.total_pos, 0))::numeric AS "totalDia"
      FROM todas_fechas tf
      LEFT JOIN dias_web dw ON dw.fecha = tf.fecha
      LEFT JOIN dias_pos dp ON dp.fecha = tf.fecha
      ORDER BY tf.fecha DESC;
    `;

    const res = await consultar(consulta, [fechaDesde, fechaHasta]);
    return {
      rango: { desde: fechaDesde, hasta: fechaHasta },
      dias: res.rows.map((r) => ({
        fecha: r.fecha.toISOString ? r.fecha.toISOString().slice(0, 10) : r.fecha,
        ingresosWeb: Number(r.ingresosWeb),
        ingresosPos: Number(r.ingresosPos),
        totalDia: Number(r.totalDia)
      }))
    };
  }

  /**
   * Ranking de productos mas vendidos
   */
  async rankingProductos(limite: number = 10) {
    const consulta = `
      SELECT 
        p.id AS "productoId",
        p.nombre,
        p.slug,
        c.nombre AS "categoria",
        COALESCE(SUM(pi.cantidad), 0)::int AS "unidadesVendidas",
        COALESCE(SUM(pi.subtotal), 0)::numeric AS "ingresosGenerados"
      FROM productos p
      INNER JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN variantes v ON v.producto_id = p.id
      LEFT JOIN pedido_items pi ON pi.variante_id = v.id
      GROUP BY p.id, c.nombre
      ORDER BY "unidadesVendidas" DESC, "ingresosGenerados" DESC
      LIMIT $1;
    `;

    const res = await consultar(consulta, [limite]);
    return res.rows.map((r, index) => ({
      puesto: index + 1,
      ...r,
      unidadesVendidas: Number(r.unidadesVendidas),
      ingresosGenerados: Number(r.ingresosGenerados)
    }));
  }
}

export const reportesService = new ReportesService();
