/**
 * ============================================================================
 * NUBAGLOW APP - PREPARACION IDEMPOTENTE PARA DEMO ORAL
 * ============================================================================
 * Asegura que los 32 productos reales esten activos, con una imagen principal
 * real y con stock suficiente. No elimina pedidos, ventas, movimientos ni
 * historiales: cualquier reposicion queda registrada como entrada de Kardex.
 */

import { consultar, conTransaccion, cerrarPool } from './index';
import { IMAGENES_REALES } from './imagenes_catalogo';

const STOCK_MINIMO_DEMO = 10;

interface ProductoFila {
  id: number;
  activo: boolean;
}

interface VarianteFila {
  id: number;
  stock: number;
  activo: boolean;
}

function formatearUrl(ruta: string): string {
  return ruta.replace(/^\//, '');
}

async function prepararDemo() {
  console.log('============================================================');
  console.log('Preparando datos idempotentes para la demo oral de NubaGlow...');
  console.log('============================================================');

  const admin = await consultar<{ id: number }>(
    `SELECT id FROM usuarios
     WHERE rol = 'admin' AND activo = TRUE
     ORDER BY id ASC LIMIT 1`
  );
  const usuarioId = admin.rows[0]?.id ?? null;
  const slugs = Object.keys(IMAGENES_REALES);
  const sinProducto: string[] = [];
  let ajustesStock = 0;
  let imagenesCorregidas = 0;
  let variantesCreadas = 0;

  await conTransaccion(async (cliente) => {
    for (const slug of slugs) {
      const producto = await cliente.query<ProductoFila>(
        'SELECT id, activo FROM productos WHERE slug = $1',
        [slug]
      );
      const fila = producto.rows[0];
      if (!fila) {
        sinProducto.push(slug);
        continue;
      }

      if (!fila.activo) {
        await cliente.query(
          `UPDATE productos
           SET activo = TRUE, actualizado_en = NOW()
           WHERE id = $1`,
          [fila.id]
        );
      }

      const urlReal = IMAGENES_REALES[slug];
      const principal = await cliente.query<{ url: string }>(
        `SELECT url FROM imagenes_producto
         WHERE producto_id = $1 AND es_principal = TRUE
         ORDER BY orden ASC, id ASC
         LIMIT 1`,
        [fila.id]
      );
      const urlPrincipal = principal.rows[0]?.url || '';
      const esImagenReal =
        urlPrincipal.startsWith('/assets/images/') ||
        urlPrincipal.startsWith('/assets/niacinamida');

      if (!esImagenReal) {
        await cliente.query(
          `DELETE FROM imagenes_producto
           WHERE producto_id = $1
             AND (url LIKE '%icono1.png' OR url LIKE '%icono2.png')`,
          [fila.id]
        );
        await cliente.query(
          `UPDATE imagenes_producto
           SET es_principal = FALSE
           WHERE producto_id = $1`,
          [fila.id]
        );
        await cliente.query(
          `INSERT INTO imagenes_producto
           (producto_id, url, es_principal, orden)
           SELECT $1, $2::varchar, TRUE, 1
           WHERE NOT EXISTS (
             SELECT 1 FROM imagenes_producto
             WHERE producto_id = $1 AND url = $2::varchar
           )`,
          [fila.id, urlReal]
        );
        await cliente.query(
          `UPDATE imagenes_producto
           SET es_principal = TRUE, orden = 1
           WHERE producto_id = $1 AND url = $2::varchar`,
          [fila.id, urlReal]
        );
        imagenesCorregidas += 1;
      }

      const variantes = await cliente.query<VarianteFila>(
        `SELECT id, stock, activo
         FROM variantes
         WHERE producto_id = $1
         ORDER BY id ASC`,
        [fila.id]
      );

      if (variantes.rows.length === 0) {
        await cliente.query(
          `INSERT INTO variantes
           (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
           VALUES ($1, $2, 'Presentacion demo', 100.00, $3, 3, TRUE)`,
          [fila.id, `DEMO-${fila.id}`, STOCK_MINIMO_DEMO]
        );
        variantesCreadas += 1;
        continue;
      }

      const activas = variantes.rows.filter((variante) => variante.activo);
      if (activas.length === 0) {
        await cliente.query(
          `UPDATE variantes
           SET activo = TRUE, actualizado_en = NOW()
           WHERE id = $1`,
          [variantes.rows[0].id]
        );
        activas.push({ ...variantes.rows[0], activo: true });
      }

      for (const variante of activas) {
        const stockActual = Number(variante.stock) || 0;
        if (stockActual >= STOCK_MINIMO_DEMO) continue;
        const cantidad = STOCK_MINIMO_DEMO - stockActual;
        await cliente.query(
          `UPDATE variantes
           SET stock = $1, actualizado_en = NOW()
           WHERE id = $2`,
          [STOCK_MINIMO_DEMO, variante.id]
        );
        await cliente.query(
          `INSERT INTO movimientos_inventario
           (variante_id, tipo, cantidad, stock_anterior, stock_nuevo,
            motivo, usuario_id)
           VALUES ($1, 'entrada', $2, $3, $4, $5, $6)`,
          [
            variante.id,
            cantidad,
            stockActual,
            STOCK_MINIMO_DEMO,
            'Preparacion de demo oral',
            usuarioId
          ]
        );
        ajustesStock += 1;
      }
    }
  });

  const verificacion = await consultar<{ slug: string; stock: number }>(
    `SELECT p.slug, COALESCE(SUM(v.stock), 0)::int AS stock
     FROM productos p
     INNER JOIN imagenes_producto img
       ON img.producto_id = p.id AND img.es_principal = TRUE
     LEFT JOIN variantes v
       ON v.producto_id = p.id AND v.activo = TRUE
     WHERE p.activo = TRUE
       AND (
         img.url LIKE '/assets/images/%'
         OR img.url LIKE '/assets/niacinamida%'
       )
       AND p.slug = ANY($1::text[])
     GROUP BY p.slug
     HAVING COALESCE(SUM(v.stock), 0) >= $2
     ORDER BY p.slug ASC`,
    [slugs, STOCK_MINIMO_DEMO]
  );

  console.log(`Productos revisados: ${slugs.length}`);
  console.log(`Ajustes de stock con Kardex: ${ajustesStock}`);
  console.log(`Imagenes principales corregidas: ${imagenesCorregidas}`);
  console.log(`Variantes creadas: ${variantesCreadas}`);
  console.log(
    `Productos listos para demo: ${verificacion.rows.length}/${slugs.length}`
  );

  if (sinProducto.length > 0) {
    console.log('Slugs sin producto en la base:');
    for (const slug of sinProducto) console.log(`- ${slug}`);
  }

  if (verificacion.rows.length !== slugs.length) {
    const listos = new Set(verificacion.rows.map((fila) => fila.slug));
    console.log('Productos que aun requieren revision:');
    for (const slug of slugs) {
      if (!listos.has(slug)) console.log(`- ${slug}`);
    }
  } else {
    console.log('Todos los productos reales quedaron listos para la demo.');
  }

  console.log('Archivo de imagen esperado por producto:');
  for (const slug of slugs) {
    console.log(`- ${slug} -> ${formatearUrl(IMAGENES_REALES[slug])}`);
  }

  await cerrarPool();
}

prepararDemo().catch(async (error) => {
  console.error('Error al preparar la demo:', error);
  await cerrarPool();
  process.exit(1);
});
