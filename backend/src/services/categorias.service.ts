/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE CATEGORIAS
 * ============================================================================
 * Maneja la lectura publica y el mantenimiento CRUD por parte del rol admin.
 */

import { consultar } from '../db';
import { AppError } from '../middlewares/errores';

export interface CategoriaItem {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  totalProductos?: number;
}

export class CategoriasService {
  /**
   * Genera un slug valido a partir de un texto
   */
  private normalizarSlug(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Listado publico de categorias con conteo de productos activos
   */
  async listar(): Promise<CategoriaItem[]> {
    const consulta = `
      SELECT 
        c.id,
        c.nombre,
        c.slug,
        c.descripcion,
        COUNT(p.id) FILTER (WHERE p.activo = TRUE)::int AS "totalProductos"
      FROM categorias c
      LEFT JOIN productos p ON p.categoria_id = c.id
      GROUP BY c.id, c.nombre, c.slug, c.descripcion
      ORDER BY c.nombre ASC;
    `;
    const res = await consultar(consulta);
    return res.rows;
  }

  /**
   * Obtiene una categoria por su slug
   */
  async obtenerPorSlug(slug: string): Promise<CategoriaItem> {
    const consulta = `
      SELECT id, nombre, slug, descripcion 
      FROM categorias 
      WHERE slug = $1;
    `;
    const res = await consultar(consulta, [slug]);
    if (res.rows.length === 0) {
      throw new AppError('Categoria no encontrada', 404);
    }
    return res.rows[0];
  }

  /**
   * Creacion de categoria (exclusivo admin)
   */
  async crear(datos: { nombre: string; slug?: string; descripcion?: string }, usuarioId: number): Promise<CategoriaItem> {
    const slugFinal = datos.slug ? this.normalizarSlug(datos.slug) : this.normalizarSlug(datos.nombre);

    // Verificar unicidad de nombre y slug
    const existe = await consultar(
      'SELECT id FROM categorias WHERE nombre = $1 OR slug = $2',
      [datos.nombre.trim(), slugFinal]
    );
    if (existe.rows.length > 0) {
      throw new AppError('Ya existe una categoria con ese nombre o slug', 409);
    }

    const res = await consultar(
      `INSERT INTO categorias (nombre, slug, descripcion)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, slug, descripcion`,
      [datos.nombre.trim(), slugFinal, datos.descripcion?.trim() || null]
    );

    // Auditoria
    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'CREAR_CATEGORIA', 'categorias', $2, $3)`,
      [usuarioId, res.rows[0].id, JSON.stringify(res.rows[0])]
    );

    return res.rows[0];
  }

  /**
   * Actualizacion de categoria (exclusivo admin)
   */
  async actualizar(id: number, datos: { nombre?: string; slug?: string; descripcion?: string }, usuarioId: number): Promise<CategoriaItem> {
    const resExiste = await consultar('SELECT * FROM categorias WHERE id = $1', [id]);
    if (resExiste.rows.length === 0) {
      throw new AppError('Categoria no encontrada', 404);
    }
    const catActual = resExiste.rows[0];

    const nuevoNombre = datos.nombre !== undefined ? datos.nombre.trim() : catActual.nombre;
    const nuevoSlug = datos.slug !== undefined
      ? this.normalizarSlug(datos.slug)
      : (datos.nombre ? this.normalizarSlug(datos.nombre) : catActual.slug);
    const nuevaDesc = datos.descripcion !== undefined ? datos.descripcion.trim() : catActual.descripcion;

    // Verificar si el nuevo slug choca con otra categoria
    if (nuevoSlug !== catActual.slug) {
      const choca = await consultar('SELECT id FROM categorias WHERE slug = $1 AND id != $2', [nuevoSlug, id]);
      if (choca.rows.length > 0) {
        throw new AppError('El slug ya esta en uso por otra categoria', 409);
      }
    }

    const res = await consultar(
      `UPDATE categorias 
       SET nombre = $1, slug = $2, descripcion = $3
       WHERE id = $4
       RETURNING id, nombre, slug, descripcion`,
      [nuevoNombre, nuevoSlug, nuevaDesc, id]
    );

    // Auditoria
    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'ACTUALIZAR_CATEGORIA', 'categorias', $2, $3)`,
      [usuarioId, id, JSON.stringify({ antes: catActual, despues: res.rows[0] })]
    );

    return res.rows[0];
  }

  /**
   * Eliminacion de categoria (exclusivo admin)
   */
  async eliminar(id: number, usuarioId: number): Promise<void> {
    // Validar si tiene productos asociados
    const productos = await consultar('SELECT id FROM productos WHERE categoria_id = $1 LIMIT 1', [id]);
    if (productos.rows.length > 0) {
      throw new AppError('No se puede eliminar la categoria porque tiene productos vinculados', 400);
    }

    const res = await consultar('DELETE FROM categorias WHERE id = $1 RETURNING id, nombre', [id]);
    if (res.rows.length === 0) {
      throw new AppError('Categoria no encontrada', 404);
    }

    // Auditoria
    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'ELIMINAR_CATEGORIA', 'categorias', $2, $3)`,
      [usuarioId, id, JSON.stringify(res.rows[0])]
    );
  }
}

export const categoriasService = new CategoriasService();
