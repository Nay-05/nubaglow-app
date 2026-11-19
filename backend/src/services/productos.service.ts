/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE PRODUCTOS Y CATALOGO
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 7 y 8:
 * - Listado publico con busqueda, filtros combinables, ordenacion y paginacion.
 * - Solo muestra productos activos en el catalogo publico.
 * - Detalle por slug con variantes, imagenes y promedio de resenas.
 * - CRUD reservado exclusivamente para rol 'admin'.
 */

import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import { ConsultaProductosInput, CrearProductoInput, ActualizarProductoInput } from '../schemas/catalogo.schema';

export interface ProductoCatalogoItem {
  id: number;
  nombre: string;
  slug: string;
  marca: string;
  tipoPiel: string;
  descripcion: string;
  categoriaId: number;
  categoriaNombre: string;
  categoriaSlug: string;
  precioMin: number;
  precioMax: number;
  stockTotal: number;
  imagenPrincipal: string | null;
  promedioCalificacion: number;
  totalResenas: number;
  activo: boolean;
}

export interface ProductoDetalle extends ProductoCatalogoItem {
  ingredientes: string;
  modoUso: string;
  imagenes: Array<{ id: number; url: string; esPrincipal: boolean; orden: number }>;
  variantes: Array<{
    id: number;
    sku: string;
    nombre: string;
    precio: number;
    stock: number;
    puntoReorden: number;
    activo: boolean;
  }>;
}

export class ProductosService {
  private normalizarSlug(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Listado de productos con busqueda, filtros combinados, ordenacion y paginacion.
   */
  async listar(filtros: ConsultaProductosInput, soloActivos: boolean = true) {
    const condiciones: string[] = [];
    const parametros: any[] = [];
    let contadorParametros = 1;

    // 1. Filtro de activos para publico
    if (soloActivos) {
      condiciones.push('p.activo = TRUE');
    }

    // 2. Filtro por categoria (por slug o por ID numerico)
    if (filtros.categoria) {
      if (/^\d+$/.test(filtros.categoria)) {
        condiciones.push(`p.categoria_id = $${contadorParametros}`);
        parametros.push(Number(filtros.categoria));
        contadorParametros++;
      } else {
        condiciones.push(`c.slug = $${contadorParametros}`);
        parametros.push(filtros.categoria.trim().toLowerCase());
        contadorParametros++;
      }
    }

    // 3. Filtro por tipo de piel
    if (filtros.tipo_piel) {
      condiciones.push(`p.tipo_piel = $${contadorParametros}`);
      parametros.push(filtros.tipo_piel);
      contadorParametros++;
    }

    // 4. Busqueda por texto (nombre, marca, descripcion, ingredientes)
    if (filtros.buscar && filtros.buscar.trim()) {
      const termino = `%${filtros.buscar.trim().toLowerCase()}%`;
      condiciones.push(`(
        LOWER(p.nombre) LIKE $${contadorParametros} OR 
        LOWER(p.marca) LIKE $${contadorParametros} OR 
        LOWER(p.descripcion) LIKE $${contadorParametros} OR 
        LOWER(p.ingredientes) LIKE $${contadorParametros}
      )`);
      parametros.push(termino);
      contadorParametros++;
    }

    const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    // Clausula Having para filtros por rango de precio sobre variantes
    const condicionesHaving: string[] = [];
    if (filtros.precio_min !== undefined) {
      condicionesHaving.push(`MIN(v.precio) >= $${contadorParametros}`);
      parametros.push(filtros.precio_min);
      contadorParametros++;
    }
    if (filtros.precio_max !== undefined) {
      condicionesHaving.push(`MAX(v.precio) <= $${contadorParametros}`);
      parametros.push(filtros.precio_max);
      contadorParametros++;
    }
    const clausulaHaving = condicionesHaving.length > 0 ? `HAVING ${condicionesHaving.join(' AND ')}` : '';

    // Clausula de orden (aplicada sobre el CTE productos_agregados)
    let clausulaOrden = 'ORDER BY creado_en DESC';
    switch (filtros.orden) {
      case 'precio_asc':
        clausulaOrden = 'ORDER BY "precioMin" ASC NULLS LAST';
        break;
      case 'precio_desc':
        clausulaOrden = 'ORDER BY "precioMax" DESC NULLS LAST';
        break;
      case 'nombre_asc':
        clausulaOrden = 'ORDER BY nombre ASC';
        break;
      case 'nombre_desc':
        clausulaOrden = 'ORDER BY nombre DESC';
        break;
      case 'mejor_valorados':
        clausulaOrden = 'ORDER BY "promedioCalificacion" DESC, "totalResenas" DESC, creado_en DESC';
        break;
      case 'recientes':
      default:
        clausulaOrden = 'ORDER BY creado_en DESC';
        break;
    }

    const pagina = filtros.pagina || 1;
    const limite = filtros.limite || 12;
    const offset = (pagina - 1) * limite;

    // Subquery CTE para agregacion de productos con variantes y resenas
    const consultaPrincipal = `
      WITH productos_agregados AS (
        SELECT 
          p.id,
          p.nombre,
          p.slug,
          p.marca,
          p.tipo_piel AS "tipoPiel",
          p.descripcion,
          p.categoria_id AS "categoriaId",
          c.nombre AS "categoriaNombre",
          c.slug AS "categoriaSlug",
          p.activo,
          p.creado_en,
          COALESCE(MIN(v.precio), 0) AS "precioMin",
          COALESCE(MAX(v.precio), 0) AS "precioMax",
          COALESCE(SUM(v.stock), 0)::int AS "stockTotal",
          (
            SELECT img.url 
            FROM imagenes_producto img 
            WHERE img.producto_id = p.id 
            ORDER BY img.es_principal DESC, img.orden ASC 
            LIMIT 1
          ) AS "imagenPrincipal",
          COALESCE(ROUND(AVG(r.calificacion), 1), 0)::numeric AS "promedioCalificacion",
          COUNT(DISTINCT r.id)::int AS "totalResenas"
        FROM productos p
        INNER JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN variantes v ON v.producto_id = p.id AND v.activo = TRUE
        LEFT JOIN resenas r ON r.producto_id = p.id
        ${clausulaWhere}
        GROUP BY p.id, c.nombre, c.slug
        ${clausulaHaving}
      )
      SELECT *, COUNT(*) OVER() AS "conteoTotal"
      FROM productos_agregados
      ${clausulaOrden}
      LIMIT $${contadorParametros} OFFSET $${contadorParametros + 1};
    `;

    parametros.push(limite, offset);

    const res = await consultar(consultaPrincipal, parametros);
    const total = res.rows.length > 0 ? Number(res.rows[0].conteoTotal) : 0;
    const totalPaginas = Math.ceil(total / limite);

    const productos: ProductoCatalogoItem[] = res.rows.map((r) => {
      const { conteoTotal, ...item } = r;
      return {
        ...item,
        precioMin: Number(item.precioMin),
        precioMax: Number(item.precioMax),
        promedioCalificacion: Number(item.promedioCalificacion)
      };
    });

    return {
      productos,
      paginacion: {
        total,
        pagina,
        limite,
        totalPaginas
      }
    };
  }

  /**
   * Obtiene la ficha completa de un producto por su slug
   */
  async obtenerPorSlug(slug: string, soloActivo: boolean = true): Promise<ProductoDetalle> {
    const consultaProducto = `
      SELECT 
        p.id,
        p.nombre,
        p.slug,
        p.marca,
        p.tipo_piel AS "tipoPiel",
        p.descripcion,
        p.ingredientes,
        p.modo_uso AS "modoUso",
        p.categoria_id AS "categoriaId",
        c.nombre AS "categoriaNombre",
        c.slug AS "categoriaSlug",
        p.activo,
        COALESCE(MIN(v.precio), 0) AS "precioMin",
        COALESCE(MAX(v.precio), 0) AS "precioMax",
        COALESCE(SUM(v.stock), 0)::int AS "stockTotal",
        (
          SELECT img.url 
          FROM imagenes_producto img 
          WHERE img.producto_id = p.id 
          ORDER BY img.es_principal DESC, img.orden ASC 
          LIMIT 1
        ) AS "imagenPrincipal",
        COALESCE(ROUND(AVG(r.calificacion), 1), 0)::numeric AS "promedioCalificacion",
        COUNT(DISTINCT r.id)::int AS "totalResenas"
      FROM productos p
      INNER JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN variantes v ON v.producto_id = p.id AND v.activo = TRUE
      LEFT JOIN resenas r ON r.producto_id = p.id
      WHERE p.slug = $1 ${soloActivo ? 'AND p.activo = TRUE' : ''}
      GROUP BY p.id, c.nombre, c.slug;
    `;

    const resProd = await consultar(consultaProducto, [slug]);
    if (resProd.rows.length === 0) {
      throw new AppError('Producto no encontrado en el catalogo', 404);
    }

    const prod = resProd.rows[0];

    // Obtener imagenes
    const resImg = await consultar(
      `SELECT id, url, es_principal AS "esPrincipal", orden 
       FROM imagenes_producto 
       WHERE producto_id = $1 
       ORDER BY orden ASC, id ASC`,
      [prod.id]
    );

    // Obtener variantes
    const resVar = await consultar(
      `SELECT id, sku, nombre, precio, stock, punto_reorden AS "puntoReorden", activo 
       FROM variantes 
       WHERE producto_id = $1 ${soloActivo ? 'AND activo = TRUE' : ''}
       ORDER BY precio ASC, id ASC`,
      [prod.id]
    );

    return {
      ...prod,
      precioMin: Number(prod.precioMin),
      precioMax: Number(prod.precioMax),
      promedioCalificacion: Number(prod.promedioCalificacion),
      imagenes: resImg.rows,
      variantes: resVar.rows.map((v) => ({ ...v, precio: Number(v.precio) }))
    };
  }

  /**
   * Creacion de producto (exclusivo admin)
   */
  async crear(datos: CrearProductoInput, usuarioId: number): Promise<ProductoDetalle> {
    const slugFinal = datos.slug ? this.normalizarSlug(datos.slug) : this.normalizarSlug(datos.nombre);

    // Verificar si existe la categoria
    const existeCat = await consultar('SELECT id FROM categorias WHERE id = $1', [datos.categoria_id]);
    if (existeCat.rows.length === 0) {
      throw new AppError('La categoria especificada no existe', 404);
    }

    // Verificar unicidad de slug
    const existeSlug = await consultar('SELECT id FROM productos WHERE slug = $1', [slugFinal]);
    if (existeSlug.rows.length > 0) {
      throw new AppError('Ya existe un producto registrado con ese nombre o slug', 409);
    }

    await conTransaccion(async (cliente) => {
      // 1. Insertar producto
      const res = await cliente.query(
        `INSERT INTO productos 
         (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, slug`,
        [
          datos.categoria_id,
          datos.nombre.trim(),
          slugFinal,
          datos.marca?.trim() || 'NubaGlow',
          datos.tipo_piel,
          datos.descripcion.trim(),
          datos.ingredientes.trim(),
          datos.modo_uso.trim(),
          datos.activo !== undefined ? datos.activo : true
        ]
      );

      const nuevoId = res.rows[0].id;

      // 2. Insertar imagenes iniciales si se proveen
      if (datos.imagenes && datos.imagenes.length > 0) {
        for (let i = 0; i < datos.imagenes.length; i++) {
          await cliente.query(
            `INSERT INTO imagenes_producto (producto_id, url, es_principal, orden)
             VALUES ($1, $2, $3, $4)`,
            [nuevoId, datos.imagenes[i].trim(), i === 0, i]
          );
        }
      }

      // 3. Registrar auditoria
      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'CREAR_PRODUCTO', 'productos', $2, $3)`,
        [usuarioId, nuevoId, JSON.stringify({ nombre: datos.nombre, slug: slugFinal })]
      );

      return { id: nuevoId, slug: slugFinal };
    });

    return this.obtenerPorSlug(slugFinal, false);
  }

  /**
   * Actualizacion de producto (exclusivo admin)
   */
  async actualizar(id: number, datos: ActualizarProductoInput, usuarioId: number): Promise<ProductoDetalle> {
    const resProd = await consultar('SELECT * FROM productos WHERE id = $1', [id]);
    if (resProd.rows.length === 0) {
      throw new AppError('Producto no encontrado', 404);
    }
    const actual = resProd.rows[0];

    const nuevoNombre = datos.nombre !== undefined ? datos.nombre.trim() : actual.nombre;
    const nuevoSlug = datos.slug !== undefined
      ? this.normalizarSlug(datos.slug)
      : (datos.nombre ? this.normalizarSlug(datos.nombre) : actual.slug);

    if (nuevoSlug !== actual.slug) {
      const choca = await consultar('SELECT id FROM productos WHERE slug = $1 AND id != $2', [nuevoSlug, id]);
      if (choca.rows.length > 0) {
        throw new AppError('El slug ya esta en uso por otro producto', 409);
      }
    }

    if (datos.categoria_id !== undefined) {
      const existeCat = await consultar('SELECT id FROM categorias WHERE id = $1', [datos.categoria_id]);
      if (existeCat.rows.length === 0) {
        throw new AppError('La categoria especificada no existe', 404);
      }
    }

    await consultar(
      `UPDATE productos SET
        categoria_id = COALESCE($1, categoria_id),
        nombre = $2,
        slug = $3,
        marca = COALESCE($4, marca),
        tipo_piel = COALESCE($5, tipo_piel),
        descripcion = COALESCE($6, descripcion),
        ingredientes = COALESCE($7, ingredientes),
        modo_uso = COALESCE($8, modo_uso),
        activo = COALESCE($9, activo),
        actualizado_en = NOW()
       WHERE id = $10`,
      [
        datos.categoria_id,
        nuevoNombre,
        nuevoSlug,
        datos.marca,
        datos.tipo_piel,
        datos.descripcion,
        datos.ingredientes,
        datos.modo_uso,
        datos.activo,
        id
      ]
    );

    // Auditoria
    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'ACTUALIZAR_PRODUCTO', 'productos', $2, $3)`,
      [usuarioId, id, JSON.stringify({ antes: actual, cambios: datos })]
    );

    return this.obtenerPorSlug(nuevoSlug, false);
  }

  /**
   * Eliminacion de producto (exclusivo admin).
   * Si tiene referencias en pedidos, se aplica desactivacion logica (soft delete).
   */
  async eliminar(id: number, usuarioId: number): Promise<{ mensaje: string; tipo: 'logica' | 'fisica' }> {
    const resProd = await consultar('SELECT id, nombre, slug FROM productos WHERE id = $1', [id]);
    if (resProd.rows.length === 0) {
      throw new AppError('Producto no encontrado', 404);
    }

    // Verificar si alguna variante del producto tiene pedidos vinculados
    const tienePedidos = await consultar(
      `SELECT pi.id 
       FROM pedido_items pi
       INNER JOIN variantes v ON v.id = pi.variante_id
       WHERE v.producto_id = $1 
       LIMIT 1`,
      [id]
    );

    if (tienePedidos.rows.length > 0) {
      // Desactivacion logica
      await consultar('UPDATE productos SET activo = FALSE, actualizado_en = NOW() WHERE id = $1', [id]);
      await consultar('UPDATE variantes SET activo = FALSE, actualizado_en = NOW() WHERE producto_id = $1', [id]);

      await consultar(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'DESACTIVAR_PRODUCTO_SOFT_DELETE', 'productos', $2, $3)`,
        [usuarioId, id, JSON.stringify({ motivo: 'Tiene pedidos historicos vinculados' })]
      );

      return { mensaje: 'Producto desactivado del catalogo (conservado por trazabilidad de ventas)', tipo: 'logica' };
    }

    // Eliminacion fisica si no tiene transacciones
    await conTransaccion(async (cliente) => {
      await cliente.query('DELETE FROM imagenes_producto WHERE producto_id = $1', [id]);
      await cliente.query('DELETE FROM variantes WHERE producto_id = $1', [id]);
      await cliente.query('DELETE FROM resenas WHERE producto_id = $1', [id]);
      await cliente.query('DELETE FROM productos WHERE id = $1', [id]);

      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'ELIMINAR_PRODUCTO_FISICO', 'productos', $2, $3)`,
        [usuarioId, id, JSON.stringify(resProd.rows[0])]
      );
    });

    return { mensaje: 'Producto eliminado definitivamente', tipo: 'fisica' };
  }
}

export const productosService = new ProductosService();
