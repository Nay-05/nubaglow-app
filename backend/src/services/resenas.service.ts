/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE RESENAS Y VALORACIONES VERIFICADAS
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 7 y 8:
 * - Solo clientes autenticados que hayan recibido el producto (pedido Entregado).
 * - Maximo una resena por producto por cliente.
 * - Calificacion de 1 a 5 estrellas con comentario.
 * - Estadisticas publicas: promedio, total y distribucion por estrellas.
 */

import { consultar } from '../db';
import { AppError } from '../middlewares/errores';
import { CrearResenaInput } from '../schemas/compra.schema';

export interface ResenaItem {
  id: number;
  calificacion: number;
  comentario: string;
  verificado: boolean;
  creadoEn: string;
  autor: string;
}

export interface ResumenResenas {
  productoId: number;
  promedio: number;
  total: number;
  distribucion: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  resenas: ResenaItem[];
}

export class ResenasService {
  /**
   * Crea una resena verificada para un producto
   */
  async crearResena(usuarioId: number, datos: CrearResenaInput): Promise<ResenaItem> {
    // 1. Validar existencia del producto
    const resProd = await consultar('SELECT id, nombre FROM productos WHERE id = $1', [datos.producto_id]);
    if (resProd.rows.length === 0) {
      throw new AppError('El producto especificado no existe', 404);
    }

    // 2. Validar que el cliente tenga al menos un pedido 'Entregado' con este producto
    const consultaCompraVerificada = `
      SELECT pi.id 
      FROM pedido_items pi
      INNER JOIN pedidos p ON p.id = pi.pedido_id
      INNER JOIN variantes v ON v.id = pi.variante_id
      WHERE p.usuario_id = $1 
        AND p.estado = 'Entregado' 
        AND v.producto_id = $2
      LIMIT 1;
    `;
    const resVerificado = await consultar(consultaCompraVerificada, [usuarioId, datos.producto_id]);
    if (resVerificado.rows.length === 0) {
      throw new AppError(
        'Solo los clientes que hayan comprado y recibido este producto (pedido en estado Entregado) pueden publicar una resena',
        403
      );
    }

    // 3. Validar si ya publico una resena previa (maximo 1 por producto y cliente)
    const resPrevia = await consultar(
      'SELECT id FROM resenas WHERE usuario_id = $1 AND producto_id = $2',
      [usuarioId, datos.producto_id]
    );
    if (resPrevia.rows.length > 0) {
      throw new AppError('Ya has publicado una resena para este producto. Maximo una resena por cliente', 409);
    }

    // 4. Insertar resena
    const res = await consultar(
      `INSERT INTO resenas (producto_id, usuario_id, calificacion, comentario, verificado)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, calificacion, comentario, verificado, creado_en AS "creadoEn"`,
      [datos.producto_id, usuarioId, datos.calificacion, datos.comentario.trim()]
    );

    // Obtener nombre del usuario
    const resUser = await consultar('SELECT nombre FROM usuarios WHERE id = $1', [usuarioId]);

    return {
      ...res.rows[0],
      autor: resUser.rows[0]?.nombre || 'Cliente Nuba'
    };
  }

  /**
   * Obtiene las resenas de un producto con promedio, total y desglose de estrellas
   */
  async listarPorProducto(productoId: number): Promise<ResumenResenas> {
    const consultaLista = `
      SELECT 
        r.id,
        r.calificacion,
        r.comentario,
        r.verificado,
        r.creado_en AS "creadoEn",
        u.nombre AS autor
      FROM resenas r
      INNER JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.producto_id = $1
      ORDER BY r.creado_en DESC;
    `;

    const res = await consultar(consultaLista, [productoId]);
    const resenas: ResenaItem[] = res.rows;

    const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sumaCalificaciones = 0;

    resenas.forEach((r) => {
      const estrellas = r.calificacion as 1 | 2 | 3 | 4 | 5;
      if (distribucion[estrellas] !== undefined) {
        distribucion[estrellas]++;
      }
      sumaCalificaciones += r.calificacion;
    });

    const total = resenas.length;
    const promedio = total > 0 ? Math.round((sumaCalificaciones / total) * 10) / 10 : 0;

    return {
      productoId,
      promedio,
      total,
      distribucion,
      resenas
    };
  }
}

export const resenasService = new ResenasService();
