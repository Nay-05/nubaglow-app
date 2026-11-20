/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE CARRITO PERSISTENTE
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 7 y 8:
 * - Carrito persistente en PostgreSQL (carritos, carrito_items).
 * - Exclusivo para clientes autenticados.
 * - Un cliente solo puede ver y modificar su propio carrito.
 * - Valida disponibilidad de stock en tiempo real.
 */

import { consultar } from '../db';
import { AppError } from '../middlewares/errores';

export interface CarritoItemDetalle {
  id: number;
  varianteId: number;
  productoId: number;
  productoNombre: string;
  productoSlug: string;
  varianteNombre: string;
  sku: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  stockDisponible: number;
  noDisponible: boolean;
  imagen: string | null;
}

export interface CarritoResumen {
  id: number;
  usuarioId: number;
  items: CarritoItemDetalle[];
  totalArticulos: number;
  subtotal: number;
}

export class CarritoService {
  /**
   * Obtiene o crea el carrito activo del usuario
   */
  async obtenerOCrearCarritoId(usuarioId: number): Promise<number> {
    const res = await consultar('SELECT id FROM carritos WHERE usuario_id = $1', [usuarioId]);
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }

    const nuevo = await consultar(
      `INSERT INTO carritos (usuario_id) VALUES ($1)
       ON CONFLICT (usuario_id)
       DO UPDATE SET actualizado_en = NOW()
       RETURNING id`,
      [usuarioId]
    );
    return nuevo.rows[0].id;
  }

  /**
   * Obtiene el contenido completo del carrito del usuario con precios y stock actuales
   */
  async obtenerCarrito(usuarioId: number): Promise<CarritoResumen> {
    const carritoId = await this.obtenerOCrearCarritoId(usuarioId);

    const consultaItems = `
      SELECT 
        ci.id,
        ci.variante_id AS "varianteId",
        p.id AS "productoId",
        p.nombre AS "productoNombre",
        p.slug AS "productoSlug",
        v.nombre AS "varianteNombre",
        v.sku,
        v.precio AS "precioUnitario",
        ci.cantidad,
        (ci.cantidad * v.precio)::numeric AS subtotal,
        v.stock AS "stockDisponible",
        v.activo AS "varianteActiva",
        p.activo AS "productoActivo",
        (
          SELECT img.url 
          FROM imagenes_producto img 
          WHERE img.producto_id = p.id 
          ORDER BY img.es_principal DESC, img.orden ASC 
          LIMIT 1
        ) AS imagen
      FROM carrito_items ci
      INNER JOIN variantes v ON v.id = ci.variante_id
      INNER JOIN productos p ON p.id = v.producto_id
      WHERE ci.carrito_id = $1
      ORDER BY ci.creado_en ASC;
    `;

    const res = await consultar(consultaItems, [carritoId]);

    let totalArticulos = 0;
    let subtotalGeneral = 0;

    const items: CarritoItemDetalle[] = res.rows.map((r) => {
      const precio = Number(r.precioUnitario);
      const sub = Number(r.subtotal);
      totalArticulos += r.cantidad;
      subtotalGeneral += sub;

      return {
        ...r,
        precioUnitario: precio,
        subtotal: sub,
        stockDisponible: Number(r.stockDisponible),
        noDisponible: !r.varianteActiva || !r.productoActivo
      };
    });

    return {
      id: carritoId,
      usuarioId,
      items,
      totalArticulos,
      subtotal: Math.round(subtotalGeneral * 100) / 100
    };
  }

  /**
   * Agrega una variante al carrito o incrementa la cantidad existente si hay stock
   */
  async agregarItem(
    usuarioId: number,
    varianteId: number,
    cantidadDeseada: number = 1
  ): Promise<CarritoResumen> {
    const carritoId = await this.obtenerOCrearCarritoId(usuarioId);

    // 1. Validar que la variante y producto existan y esten activos
    const resVar = await consultar(
      `SELECT v.id, v.stock, v.precio,
              v.activo AS "varianteActiva",
              p.activo AS "productoActivo",
              p.nombre AS "productoNombre"
       FROM variantes v
       INNER JOIN productos p ON p.id = v.producto_id
       WHERE v.id = $1`,
      [varianteId]
    );

    const varianteConsultada = resVar.rows[0];

    if (
      !varianteConsultada ||
      !varianteConsultada.varianteActiva ||
      !varianteConsultada.productoActivo
    ) {
      throw new AppError(
        'El producto o variante seleccionado no esta disponible en tienda',
        404
      );
    }

    const variante = varianteConsultada;

    // 2. Comprobar si ya existe en el carrito
    const resItem = await consultar(
      'SELECT id, cantidad FROM carrito_items WHERE carrito_id = $1 AND variante_id = $2',
      [carritoId, varianteId]
    );

    const cantidadActual = resItem.rows.length > 0 ? resItem.rows[0].cantidad : 0;
    const cantidadTotalCalculada = cantidadActual + cantidadDeseada;

    // 3. Validar contra el stock disponible
    if (cantidadTotalCalculada > variante.stock) {
      throw new AppError(
        `Stock insuficiente para ${variante.productoNombre}. ` +
          `Stock disponible: ${variante.stock}, ` +
          `solicitados: ${cantidadTotalCalculada}`,
        400
      );
    }

    // 4. Upsert en BD
    if (resItem.rows.length > 0) {
      await consultar('UPDATE carrito_items SET cantidad = $1 WHERE id = $2', [
        cantidadTotalCalculada,
        resItem.rows[0].id
      ]);
    } else {
      await consultar(
        'INSERT INTO carrito_items (carrito_id, variante_id, cantidad) VALUES ($1, $2, $3)',
        [carritoId, varianteId, cantidadDeseada]
      );
    }

    return this.obtenerCarrito(usuarioId);
  }

  /**
   * Cambia la cantidad de un item existente en el carrito
   */
  async actualizarCantidad(
    usuarioId: number,
    itemId: number,
    nuevaCantidad: number
  ): Promise<CarritoResumen> {
    const carritoId = await this.obtenerOCrearCarritoId(usuarioId);

    // 1. Obtener item y comprobar que pertenece al carrito del usuario
    const resItem = await consultar(
      `SELECT ci.id, ci.variante_id, v.stock,
              v.activo AS "varianteActiva",
              p.activo AS "productoActivo",
              p.nombre AS "productoNombre"
       FROM carrito_items ci
       INNER JOIN variantes v ON v.id = ci.variante_id
       INNER JOIN productos p ON p.id = v.producto_id
       WHERE ci.id = $1 AND ci.carrito_id = $2`,
      [itemId, carritoId]
    );

    if (resItem.rows.length === 0) {
      throw new AppError('El articulo no existe en su carrito', 404);
    }

    const item = resItem.rows[0];

    if (!item.varianteActiva || !item.productoActivo) {
      throw new AppError(
        'Este artículo ya no está disponible. Quítalo del carrito para continuar.',
        409
      );
    }

    if (nuevaCantidad > item.stock) {
      throw new AppError(
        `No es posible aumentar la cantidad. Stock disponible: ${item.stock}`,
        400
      );
    }

    await consultar(
      'UPDATE carrito_items SET cantidad = $1 WHERE id = $2',
      [nuevaCantidad, itemId]
    );
    return this.obtenerCarrito(usuarioId);
  }

  /**
   * Elimina un articulo del carrito
   */
  async eliminarItem(usuarioId: number, itemId: number): Promise<CarritoResumen> {
    const carritoId = await this.obtenerOCrearCarritoId(usuarioId);

    const res = await consultar(
      `DELETE FROM carrito_items
       WHERE id = $1 AND carrito_id = $2
       RETURNING id`,
      [itemId, carritoId]
    );

    if (res.rows.length === 0) {
      throw new AppError('El articulo no existe en su carrito', 404);
    }

    return this.obtenerCarrito(usuarioId);
  }

  /**
   * Vacia completamente el carrito del usuario
   */
  async vaciarCarrito(usuarioId: number): Promise<void> {
    const carritoId = await this.obtenerOCrearCarritoId(usuarioId);
    await consultar('DELETE FROM carrito_items WHERE carrito_id = $1', [carritoId]);
  }
}

export const carritoService = new CarritoService();
