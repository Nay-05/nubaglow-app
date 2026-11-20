/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE IMAGENES DE PRODUCTO
 * ============================================================================
 * CRUD de la galeria visual. Mantiene exactamente una imagen principal por
 * producto y audita cada cambio realizado desde el portal administrativo.
 */

import type { PoolClient } from 'pg';
import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import {
  CrearImagenProductoInput,
  ActualizarImagenProductoInput
} from '../schemas/catalogo.schema';

export interface ImagenProductoItem {
  id: number;
  productoId: number;
  url: string;
  esPrincipal: boolean;
  orden: number;
  creadoEn: string;
}

export class ImagenesService {
  private mapear(fila: Record<string, unknown>): ImagenProductoItem {
    return {
      id: Number(fila.id),
      productoId: Number(fila.productoId),
      url: String(fila.url),
      esPrincipal: Boolean(fila.esPrincipal),
      orden: Number(fila.orden),
      creadoEn: String(fila.creadoEn)
    };
  }

  private async asegurarPrincipal(
    cliente: PoolClient,
    productoId: number
  ): Promise<void> {
    const principal = await cliente.query(
      `SELECT id FROM imagenes_producto
       WHERE producto_id = $1 AND es_principal = TRUE
       LIMIT 1`,
      [productoId]
    );
    if (principal.rows.length > 0) return;

    const primera = await cliente.query(
      `SELECT id FROM imagenes_producto
       WHERE producto_id = $1
       ORDER BY orden ASC, id ASC
       LIMIT 1`,
      [productoId]
    );
    if (primera.rows.length === 0) return;

    await cliente.query(
      `UPDATE imagenes_producto SET es_principal = TRUE WHERE id = $1`,
      [primera.rows[0].id]
    );
  }

  async listarPorProducto(productoId: number): Promise<ImagenProductoItem[]> {
    const producto = await consultar(
      'SELECT id FROM productos WHERE id = $1',
      [productoId]
    );
    if (producto.rows.length === 0) {
      throw new AppError('Producto no encontrado', 404);
    }

    const res = await consultar(
      `SELECT id,
              producto_id AS "productoId",
              url,
              es_principal AS "esPrincipal",
              orden,
              creado_en AS "creadoEn"
       FROM imagenes_producto
       WHERE producto_id = $1
       ORDER BY es_principal DESC, orden ASC, id ASC`,
      [productoId]
    );

    return res.rows.map((fila) => this.mapear(fila));
  }

  async crear(
    productoId: number,
    datos: CrearImagenProductoInput,
    usuarioId: number
  ): Promise<ImagenProductoItem> {
    const producto = await consultar(
      'SELECT id FROM productos WHERE id = $1',
      [productoId]
    );
    if (producto.rows.length === 0) {
      throw new AppError('Producto no encontrado', 404);
    }

    return conTransaccion(async (cliente) => {
      if (datos.es_principal) {
        await cliente.query(
          `UPDATE imagenes_producto
           SET es_principal = FALSE
           WHERE producto_id = $1`,
          [productoId]
        );
      }

      const insertada = await cliente.query(
        `INSERT INTO imagenes_producto
         (producto_id, url, es_principal, orden)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          productoId,
          datos.url.trim(),
          datos.es_principal === true,
          datos.orden ?? 0
        ]
      );

      await this.asegurarPrincipal(cliente, productoId);

      const res = await cliente.query(
        `SELECT id,
                producto_id AS "productoId",
                url,
                es_principal AS "esPrincipal",
                orden,
                creado_en AS "creadoEn"
         FROM imagenes_producto
         WHERE id = $1`,
        [insertada.rows[0].id]
      );
      const imagen = this.mapear(res.rows[0]);

      await cliente.query(
        `INSERT INTO auditoria
         (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'CREAR_IMAGEN_PRODUCTO', 'imagenes_producto', $2, $3)`,
        [
          usuarioId,
          imagen.id,
          JSON.stringify({
            productoId,
            url: imagen.url,
            esPrincipal: imagen.esPrincipal,
            orden: imagen.orden
          })
        ]
      );

      return imagen;
    });
  }

  async actualizar(
    productoId: number,
    imagenId: number,
    datos: ActualizarImagenProductoInput,
    usuarioId: number
  ): Promise<ImagenProductoItem> {
    const actualRes = await consultar(
      `SELECT id,
              producto_id AS "productoId",
              url,
              es_principal AS "esPrincipal",
              orden,
              creado_en AS "creadoEn"
       FROM imagenes_producto
       WHERE id = $1 AND producto_id = $2`,
      [imagenId, productoId]
    );
    if (actualRes.rows.length === 0) {
      throw new AppError('Imagen de producto no encontrada', 404);
    }
    const actual = this.mapear(actualRes.rows[0]);

    return conTransaccion(async (cliente) => {
      if (datos.es_principal === true) {
        await cliente.query(
          `UPDATE imagenes_producto
           SET es_principal = FALSE
           WHERE producto_id = $1`,
          [productoId]
        );
      }

      const res = await cliente.query(
        `UPDATE imagenes_producto SET
           url = COALESCE($1, url),
           es_principal = COALESCE($2, es_principal),
           orden = COALESCE($3, orden)
         WHERE id = $4 AND producto_id = $5
         RETURNING id,
                   producto_id AS "productoId",
                   url,
                   es_principal AS "esPrincipal",
                   orden,
                   creado_en AS "creadoEn"`,
        [
          datos.url?.trim() ?? null,
          datos.es_principal ?? null,
          datos.orden ?? null,
          imagenId,
          productoId
        ]
      );

      await this.asegurarPrincipal(cliente, productoId);

      const actualizadaRes = await cliente.query(
        `SELECT id,
                producto_id AS "productoId",
                url,
                es_principal AS "esPrincipal",
                orden,
                creado_en AS "creadoEn"
         FROM imagenes_producto
         WHERE id = $1`,
        [imagenId]
      );
      const actualizada = this.mapear(actualizadaRes.rows[0]);

      await cliente.query(
        `INSERT INTO auditoria
         (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'ACTUALIZAR_IMAGEN_PRODUCTO',
                 'imagenes_producto', $2, $3)`,
        [
          usuarioId,
          imagenId,
          JSON.stringify({
            productoId,
            antes: actual,
            despues: actualizada
          })
        ]
      );

      return actualizada;
    });
  }

  async eliminar(
    productoId: number,
    imagenId: number,
    usuarioId: number
  ): Promise<void> {
    const actualRes = await consultar(
      `SELECT id,
              producto_id AS "productoId",
              url,
              es_principal AS "esPrincipal",
              orden,
              creado_en AS "creadoEn"
       FROM imagenes_producto
       WHERE id = $1 AND producto_id = $2`,
      [imagenId, productoId]
    );
    if (actualRes.rows.length === 0) {
      throw new AppError('Imagen de producto no encontrada', 404);
    }
    const actual = this.mapear(actualRes.rows[0]);

    await conTransaccion(async (cliente) => {
      await cliente.query(
        'DELETE FROM imagenes_producto WHERE id = $1',
        [imagenId]
      );
      await this.asegurarPrincipal(cliente, productoId);

      await cliente.query(
        `INSERT INTO auditoria
         (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'ELIMINAR_IMAGEN_PRODUCTO',
                 'imagenes_producto', $2, $3)`,
        [usuarioId, imagenId, JSON.stringify({ productoId, antes: actual })]
      );
    });
  }
}

export const imagenesService = new ImagenesService();
