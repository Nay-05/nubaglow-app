/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE VARIANTES DE PRODUCTO
 * ============================================================================
 * Gestion de tonos, tamanos y presentaciones con control estricto de SKU,
 * precio individual en Bs., stock disponible y punto de reorden.
 * Creacion y edicion reservada al rol 'admin'.
 */

import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import { CrearVarianteInput, ActualizarVarianteInput } from '../schemas/catalogo.schema';

export interface VarianteItem {
  id: number;
  productoId: number;
  sku: string;
  nombre: string;
  precio: number;
  stock: number;
  puntoReorden: number;
  activo: boolean;
}

export class VariantesService {
  /**
   * Lista todas las variantes de un producto
   */
  async listarPorProducto(productoId: number, soloActivos: boolean = true): Promise<VarianteItem[]> {
    const res = await consultar(
      `SELECT 
        id, 
        producto_id AS "productoId", 
        sku, 
        nombre, 
        precio, 
        stock, 
        punto_reorden AS "puntoReorden", 
        activo
       FROM variantes 
       WHERE producto_id = $1 ${soloActivos ? 'AND activo = TRUE' : ''}
       ORDER BY precio ASC, id ASC`,
      [productoId]
    );

    return res.rows.map((r) => ({
      ...r,
      precio: Number(r.precio)
    }));
  }

  /**
   * Crea una nueva variante para un producto (exclusivo admin)
   */
  async crear(productoId: number, datos: CrearVarianteInput, usuarioId: number): Promise<VarianteItem> {
    // 1. Validar existencia del producto
    const resProd = await consultar('SELECT id FROM productos WHERE id = $1', [productoId]);
    if (resProd.rows.length === 0) {
      throw new AppError('El producto especificado no existe', 404);
    }

    // 2. Validar SKU unico
    const skuMayus = datos.sku.trim().toUpperCase();
    const existeSku = await consultar('SELECT id FROM variantes WHERE sku = $1', [skuMayus]);
    if (existeSku.rows.length > 0) {
      throw new AppError(`El SKU '${skuMayus}' ya se encuentra registrado`, 409);
    }

    // 3. Insertar variante
    const res = await consultar(
      `INSERT INTO variantes 
       (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING 
        id, 
        producto_id AS "productoId", 
        sku, 
        nombre, 
        precio, 
        stock, 
        punto_reorden AS "puntoReorden", 
        activo`,
      [
        productoId,
        skuMayus,
        datos.nombre.trim(),
        datos.precio,
        datos.stock ?? 0,
        datos.punto_reorden ?? 5,
        datos.activo !== undefined ? datos.activo : true
      ]
    );

    // 4. Registrar auditoria
    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'CREAR_VARIANTE', 'variantes', $2, $3)`,
      [
        usuarioId,
        res.rows[0].id,
        JSON.stringify({
          productoId,
          sku: skuMayus,
          precio: datos.precio,
          stock: datos.stock
        })
      ]
    );

    return {
      ...res.rows[0],
      precio: Number(res.rows[0].precio)
    };
  }

  /**
   * Actualiza una variante existente (exclusivo admin)
   */
  async actualizar(
    id: number,
    datos: ActualizarVarianteInput,
    usuarioId: number
  ): Promise<VarianteItem> {
    return conTransaccion(async (cliente) => {
      const resVar = await cliente.query(
        'SELECT * FROM variantes WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (resVar.rows.length === 0) {
        throw new AppError('Variante no encontrada', 404);
      }
      const actual = resVar.rows[0];

      let nuevoSku = actual.sku;
      if (datos.sku) {
        nuevoSku = datos.sku.trim().toUpperCase();
        if (nuevoSku !== actual.sku) {
          const existe = await cliente.query(
            `SELECT id FROM variantes
             WHERE sku = $1 AND id != $2`,
            [nuevoSku, id]
          );
          if (existe.rows.length > 0) {
            throw new AppError(
              `El SKU '${nuevoSku}' ya esta en uso por otra variante`,
              409
            );
          }
        }
      }

      const res = await cliente.query(
        `UPDATE variantes SET
          sku = $1,
          nombre = COALESCE($2, nombre),
          precio = COALESCE($3, precio),
          stock = COALESCE($4, stock),
          punto_reorden = COALESCE($5, punto_reorden),
          activo = COALESCE($6, activo),
          actualizado_en = NOW()
         WHERE id = $7
         RETURNING
          id,
          producto_id AS "productoId",
          sku,
          nombre,
          precio,
          stock,
          punto_reorden AS "puntoReorden",
          activo`,
        [
          nuevoSku,
          datos.nombre !== undefined ? datos.nombre.trim() : null,
          datos.precio,
          datos.stock,
          datos.punto_reorden,
          datos.activo,
          id
        ]
      );

      // Auditoria general de actualizacion de variante
      await cliente.query(
        `INSERT INTO auditoria
         (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'ACTUALIZAR_VARIANTE', 'variantes', $2, $3)`,
        [usuarioId, id, JSON.stringify({ antes: actual, cambios: datos })]
      );

      // Auditoria especifica para cambio de precio (CLAUDE.md Seccion 9)
      if (
        datos.precio !== undefined &&
        Number(datos.precio) !== Number(actual.precio)
      ) {
        await cliente.query(
          `INSERT INTO auditoria
           (usuario_id, accion, tabla_afectada, registro_id, detalles)
           VALUES ($1, 'CAMBIO_PRECIO', 'variantes', $2, $3)`,
          [
            usuarioId,
            id,
            JSON.stringify({
              sku: actual.sku,
              precioAnterior: Number(actual.precio),
              precioNuevo: Number(datos.precio)
            })
          ]
        );
      }

      // Auditoria especifica para cambio de disponibilidad de la variante
      if (
        datos.activo !== undefined &&
        Boolean(datos.activo) !== Boolean(actual.activo)
      ) {
        await cliente.query(
          `INSERT INTO auditoria
           (usuario_id, accion, tabla_afectada, registro_id, detalles)
           VALUES ($1, 'CAMBIO_ESTADO_VARIANTE', 'variantes', $2, $3)`,
          [
            usuarioId,
            id,
            JSON.stringify({
              sku: actual.sku,
              activoAnterior: Boolean(actual.activo),
              activoNuevo: Boolean(datos.activo)
            })
          ]
        );
      }

      // El stock editado desde productos queda reflejado en el Kardex.
      const stockAnterior = Number(actual.stock);
      const stockNuevo =
        datos.stock !== undefined ? Number(datos.stock) : stockAnterior;
      if (stockNuevo !== stockAnterior) {
        await cliente.query(
          `INSERT INTO movimientos_inventario
           (variante_id, tipo, cantidad, stock_anterior, stock_nuevo,
            motivo, usuario_id)
           VALUES ($1, 'ajuste', $2, $3, $4, $5, $6)`,
          [
            id,
            stockNuevo - stockAnterior,
            stockAnterior,
            stockNuevo,
            'Ajuste de stock desde gestion de productos',
            usuarioId
          ]
        );
      }

      return {
        ...res.rows[0],
        precio: Number(res.rows[0].precio)
      };
    });
  }

  /**
   * Eliminacion o desactivacion de variante
   */
  async eliminar(id: number, usuarioId: number): Promise<{ mensaje: string }> {
    const resVar = await consultar('SELECT id, sku FROM variantes WHERE id = $1', [id]);
    if (resVar.rows.length === 0) {
      throw new AppError('Variante no encontrada', 404);
    }

    // Verificar si tiene pedidos vinculados
    const tienePedidos = await consultar('SELECT id FROM pedido_items WHERE variante_id = $1 LIMIT 1', [id]);
    if (tienePedidos.rows.length > 0) {
      await consultar('UPDATE variantes SET activo = FALSE, actualizado_en = NOW() WHERE id = $1', [id]);
      await consultar(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'DESACTIVAR_VARIANTE_SOFT_DELETE', 'variantes', $2, $3)`,
        [usuarioId, id, JSON.stringify({ motivo: 'Tiene pedidos asociados' })]
      );
      return { mensaje: 'Variante desactivada (conservada por trazabilidad de ventas)' };
    }

    await consultar('DELETE FROM variantes WHERE id = $1', [id]);
    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'ELIMINAR_VARIANTE_FISICA', 'variantes', $2, $3)`,
      [usuarioId, id, JSON.stringify(resVar.rows[0])]
    );

    return { mensaje: 'Variante eliminada exitosamente' };
  }
}

export const variantesService = new VariantesService();
