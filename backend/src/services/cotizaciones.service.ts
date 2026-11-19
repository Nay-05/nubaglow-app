/**
 * ============================================================================
 * NUBAGLOW APP - COTIZACION DE PEDIDOS
 * ============================================================================
 * Los precios, subtotales y costos de envio se calculan siempre desde la BD.
 * El cliente solo envia variantes y cantidades; nunca precios.
 */

import { consultar } from '../db';
import { AppError } from '../middlewares/errores';
import { CotizarPedidoInput } from '../schemas/compra.schema';
import { calcularCostoEnvio } from '../config/envio';

// Se reexporta para conservar el punto de entrada usado por pedidos.service.
export { calcularCostoEnvio };

export interface ItemCotizado {
  varianteId: number;
  productoNombre: string;
  varianteNombre: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface CotizacionPedido {
  ciudad: string;
  subtotal: number;
  costoEnvio: number;
  total: number;
  items: ItemCotizado[];
}

export class CotizacionesService {
  async cotizar(datos: CotizarPedidoInput): Promise<CotizacionPedido> {
    const itemsOrdenados = [...datos.items].sort((a, b) => a.variante_id - b.variante_id);
    const idsVariantes = [...new Set(itemsOrdenados.map((item) => item.variante_id))];

    const resVariantes = await consultar(
      `SELECT
        v.id,
        v.nombre AS "varianteNombre",
        v.sku,
        v.precio,
        v.activo AS "varianteActiva",
        p.nombre AS "productoNombre",
        p.activo AS "productoActivo"
       FROM variantes v
       INNER JOIN productos p ON p.id = v.producto_id
       WHERE v.id = ANY($1::int[])`,
      [idsVariantes]
    );

    const mapaVariantes = new Map<number, any>();
    resVariantes.rows.forEach((row) => mapaVariantes.set(row.id, row));

    let subtotal = 0;
    const itemsCotizados: ItemCotizado[] = [];

    for (const item of itemsOrdenados) {
      const infoVar = mapaVariantes.get(item.variante_id);
      if (!infoVar || !infoVar.varianteActiva || !infoVar.productoActivo) {
        throw new AppError(
          `El producto '${infoVar ? infoVar.productoNombre : item.variante_id}' ya no esta disponible en tienda`,
          400
        );
      }

      const precioUnitario = Number(infoVar.precio);
      const subtotalItem = Math.round(precioUnitario * item.cantidad * 100) / 100;
      subtotal += subtotalItem;

      itemsCotizados.push({
        varianteId: item.variante_id,
        productoNombre: infoVar.productoNombre,
        varianteNombre: infoVar.varianteNombre,
        sku: infoVar.sku,
        cantidad: item.cantidad,
        precioUnitario,
        subtotal: subtotalItem
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const costoEnvio = calcularCostoEnvio(subtotal);
    const total = Math.round((subtotal + costoEnvio) * 100) / 100;

    return {
      ciudad: datos.ciudad,
      subtotal,
      costoEnvio,
      total,
      items: itemsCotizados
    };
  }
}

export const cotizacionesService = new CotizacionesService();
