/**
 * ============================================================================
 * NUBAGLOW APP - VINCULACION IDEMPOTENTE DE IMAGENES REALES
 * ============================================================================
 * Lee assets/images/ y el archivo assets/niacinamida+zinc.webp, los relaciona
 * con productos activos por coincidencia de nombre/slug y actualiza
 * imagenes_producto. Reemplaza el placeholder del icono y conserva una sola
 * imagen principal por producto.
 */

import fs from 'fs';
import path from 'path';
import { consultar, conTransaccion, cerrarPool } from './index';

interface ProductoImagen {
  id: number;
  nombre: string;
  slug: string;
}

interface ArchivoImagen {
  nombre: string;
  url: string;
}

const STOPWORDS = new Set([
  'de',
  'con',
  'la',
  'el',
  'los',
  'las',
  'y',
  'para',
  'por',
  'un',
  'una',
  'del',
  'al'
]);

function normalizar(texto: string): string {
  return String(texto || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/srum/g, 'serum')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(texto: string): string[] {
  return Array.from(
    new Set(
      normalizar(texto)
        .split(' ')
        .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    )
  );
}

function listarArchivos(carpeta: string): ArchivoImagen[] {
  const archivos = fs
    .readdirSync(carpeta)
    .filter((nombre) => fs.statSync(path.join(carpeta, nombre)).isFile())
    .map((nombre) => ({
      nombre,
      url: `/assets/images/${encodeURIComponent(nombre)}`
    }));

  const extra = path.resolve(carpeta, '..', 'niacinamida+zinc.webp');
  if (fs.existsSync(extra)) {
    archivos.push({
      nombre: 'niacinamida+zinc.webp',
      url: '/assets/niacinamida+zinc.webp'
    });
  }

  return archivos.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function baseArchivo(nombre: string): string {
  const sinExtension = nombre.replace(/\.[^.]+$/, '');
  return sinExtension || nombre;
}

function buscarProducto(
  archivo: ArchivoImagen,
  productos: ProductoImagen[]
): ProductoImagen | null {
  const tokensArchivo = tokens(baseArchivo(archivo.nombre));
  const ranked = productos
    .map((producto) => {
      const tokensProducto = new Set(
        tokens(`${producto.nombre} ${producto.slug.replace(/-/g, ' ')}`)
      );
      const coincidencias = tokensArchivo.filter((token) =>
        tokensProducto.has(token)
      );
      return {
        producto,
        cobertura:
          tokensArchivo.length > 0
            ? coincidencias.length / tokensArchivo.length
            : 0,
        coincidencias: coincidencias.length
      };
    })
    .sort((a, b) => {
      if (b.cobertura !== a.cobertura) return b.cobertura - a.cobertura;
      if (b.coincidencias !== a.coincidencias) {
        return b.coincidencias - a.coincidencias;
      }
      return a.producto.nombre.length - b.producto.nombre.length;
    });

  const mejor = ranked[0];
  if (!mejor || mejor.cobertura < 0.75) return null;
  const segundo = ranked[1];
  if (segundo && mejor.cobertura - segundo.cobertura < 0.1) return null;
  return mejor.producto;
}

async function vincularImagenes() {
  const carpeta = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'assets',
    'images'
  );
  if (!fs.existsSync(carpeta)) {
    console.error(`No existe la carpeta de imagenes: ${carpeta}`);
    process.exit(1);
  }

  const archivos = listarArchivos(carpeta);
  const productos = await consultar<ProductoImagen>(
    `SELECT id, nombre, slug
     FROM productos
     WHERE activo = TRUE
     ORDER BY nombre ASC`
  ).then((res) => res.rows);

  const asignaciones: Array<{ archivo: ArchivoImagen; producto: ProductoImagen }> = [];
  const sinCoincidencia: ArchivoImagen[] = [];

  for (const archivo of archivos) {
    const producto = buscarProducto(archivo, productos);
    if (producto) {
      asignaciones.push({ archivo, producto });
    } else {
      sinCoincidencia.push(archivo);
    }
  }

  await conTransaccion(async (cliente) => {
    for (const { archivo, producto } of asignaciones) {
      await cliente.query(
        `DELETE FROM imagenes_producto
         WHERE producto_id = $1
           AND (url LIKE '%icono1.png' OR url LIKE '%icono2.png')`,
        [producto.id]
      );
      await cliente.query(
        `UPDATE imagenes_producto
         SET es_principal = FALSE
         WHERE producto_id = $1`,
        [producto.id]
      );
      await cliente.query(
        `INSERT INTO imagenes_producto
         (producto_id, url, es_principal, orden)
         SELECT $1, $2::varchar, TRUE, 1
         WHERE NOT EXISTS (
           SELECT 1 FROM imagenes_producto
           WHERE producto_id = $1 AND url = $2::varchar
         )`,
        [producto.id, archivo.url]
      );
      await cliente.query(
        `UPDATE imagenes_producto
         SET es_principal = TRUE, orden = 1
         WHERE producto_id = $1 AND url = $2`,
        [producto.id, archivo.url]
      );
    }
  });

  const sinImagenReal = await consultar<{ nombre: string }>(
    `SELECT p.nombre
     FROM productos p
     WHERE p.activo = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM imagenes_producto img
         WHERE img.producto_id = p.id
           AND (
             img.url LIKE '/assets/images/%'
             OR img.url LIKE '/assets/niacinamida%'
           )
       )
     ORDER BY p.nombre ASC`
  ).then((res) => res.rows.map((fila) => fila.nombre));

  console.log('\nProductos vinculados con imagenes reales:');
  for (const { archivo, producto } of asignaciones) {
    console.log(`- ${producto.nombre} <- ${archivo.nombre}`);
  }
  console.log(`\nTotal vinculados: ${asignaciones.length}`);

  if (sinCoincidencia.length > 0) {
    console.log('\nArchivos sin producto coincidente:');
    for (const archivo of sinCoincidencia) {
      console.log(`- ${archivo.nombre}`);
    }
  } else {
    console.log('\nTodos los archivos encontraron un producto.');
  }

  if (sinImagenReal.length > 0) {
    console.log('\nProductos activos que siguen sin imagen real:');
    for (const nombre of sinImagenReal) {
      console.log(`- ${nombre}`);
    }
  } else {
    console.log('\nTodos los productos activos tienen una imagen real.');
  }

  await cerrarPool();
}

vincularImagenes().catch(async (error) => {
  console.error('Error al vincular imagenes:', error);
  await cerrarPool();
  process.exit(1);
});
