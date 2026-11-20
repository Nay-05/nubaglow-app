/**
 * ============================================================================
 * NUBAGLOW APP - PRUEBAS DEL COMPROBANTE PDF
 * ============================================================================
 * Verifica el PDF generado en servidor y los permisos del endpoint.
 */

import jwt from 'jsonwebtoken';
import app from '../index';
import { consultar, cerrarPool } from '../db';
import { pedidosService } from '../services/pedidos.service';
import {
  eliminarHistorialDePedidosDePrueba,
  eliminarReferenciasDeUsuariosDePrueba
} from './limpieza';

const JWT_SECRET =
  process.env.JWT_SECRET || 'clave_secreta_super_segura_nubaglow_2026';
process.env.JWT_SECRET = JWT_SECRET;

const sufijo = Date.now().toString().slice(-6);

let exitos = 0;
let fallos = 0;

function asegurar(condicion: boolean, descripcion: string) {
  if (condicion) {
    console.log(`[PASS] ${descripcion}`);
    exitos++;
  } else {
    console.error(`[FAIL] ${descripcion}`);
    fallos++;
  }
}

function token(id: number, nombre: string, email: string, rol: string) {
  return jwt.sign(
    { id, nombre, email, rol, activo: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * PDFKit escribe el texto como cadenas hexadecimales dentro de arreglos TJ.
 * Este extractor permite verificar el contenido sin agregar otra dependencia.
 */
function extraerTextoPdf(buffer: Buffer): string {
  const crudo = buffer.toString('latin1');
  const textos: string[] = [];
  const regexStream = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let stream: RegExpExecArray | null;

  while ((stream = regexStream.exec(crudo)) !== null) {
    const contenido = stream[1];
    if (!contenido.includes('BT')) continue;

    const regexTJ = /\[(.*?)\]\s*TJ/g;
    let bloque: RegExpExecArray | null;

    while ((bloque = regexTJ.exec(contenido)) !== null) {
      const regexHex = /<([0-9a-fA-F]+)>/g;
      let hex: RegExpExecArray | null;
      let linea = '';

      while ((hex = regexHex.exec(bloque[1])) !== null) {
        linea += Buffer.from(hex[1], 'hex').toString('latin1');
      }

      if (linea) textos.push(linea);
    }
  }

  return textos.join('\n');
}

async function ejecutarPruebas() {
  console.log('Iniciando pruebas del comprobante PDF...');

  const server = app.listen(0);
  const direccion = server.address() as any;
  const baseUrl = `http://localhost:${direccion.port}`;
  let pedidoId: number | undefined;
  let productoId: number | undefined;
  let varianteId: number | undefined;
  const userIds: number[] = [];

  try {
    const usuarios = [
      ['Cliente Dueno PDF', `pdf_dueno_${sufijo}@nuba.bo`, 'cliente'],
      ['Cliente Ajeno PDF', `pdf_ajeno_${sufijo}@nuba.bo`, 'cliente'],
      ['Vendedor PDF', `pdf_vendedor_${sufijo}@nuba.bo`, 'vendedor'],
      ['Admin PDF', `pdf_admin_${sufijo}@nuba.bo`, 'admin']
    ];

    const ids: Record<string, number> = {};
    for (const [nombre, email, rol] of usuarios) {
      const creado = await consultar(
        `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
         VALUES ($1, $2, 'hash_test', $3, TRUE)
         RETURNING id`,
        [nombre, email, rol]
      );
      const id = creado.rows[0].id;
      ids[rol + (nombre.includes('Ajeno') ? '_ajeno' : '')] = id;
      userIds.push(id);
    }

    const ownerId = ids.cliente;
    const otroClienteId = ids.cliente_ajeno;
    const vendedorId = ids.vendedor;
    const adminId = ids.admin;

    const categoria = await consultar('SELECT id FROM categorias LIMIT 1');
    const producto = await consultar(
      `INSERT INTO productos
       (categoria_id, nombre, slug, marca, tipo_piel, descripcion,
        ingredientes, modo_uso, activo)
       VALUES ($1, $2, $3, 'Nuba Test', 'Todo tipo', 'Descripcion',
               'Ingredientes', 'Modo de uso', TRUE)
       RETURNING id`,
      [
        categoria.rows[0].id,
        `Producto PDF ${sufijo}`,
        `producto-pdf-${sufijo}`
      ]
    );
    productoId = producto.rows[0].id;

    const variante = await consultar(
      `INSERT INTO variantes
       (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Variante PDF 30ml', 40.00, 10, 2, TRUE)
       RETURNING id`,
      [productoId, `SKU-PDF-${sufijo}`]
    );
    varianteId = variante.rows[0].id;

    const pedido = await pedidosService.crearPedido(ownerId, {
      nombre_cliente: 'Cliente Dueno PDF',
      celular_cliente: '72860307',
      correo_cliente: `pdf_dueno_${sufijo}@nuba.bo`,
      ciudad: 'Sucre',
      direccion: 'Calle Comprobante 123',
      metodo_pago: 'qr_simple',
      items: [{ variante_id: varianteId!, cantidad: 1 }]
    });
    pedidoId = pedido.id;

    const ruta = `/api/pedidos/${pedido.codigoRastreo}/comprobante-pdf`;
    const sinSesion = await fetch(`${baseUrl}${ruta}`);
    asegurar(
      sinSesion.status === 401,
      'Sin sesion el comprobante PDF responde 401'
    );

    const ajeno = await fetch(`${baseUrl}${ruta}`, {
      headers: {
        Authorization: `Bearer ${token(
          otroClienteId,
          'Cliente Ajeno PDF',
          `pdf_ajeno_${sufijo}@nuba.bo`,
          'cliente'
        )}`
      }
    });
    asegurar(
      ajeno.status === 403,
      'Un cliente ajeno recibe 403 al pedir el comprobante PDF'
    );

    const autorizado = await fetch(`${baseUrl}${ruta}`, {
      headers: {
        Authorization: `Bearer ${token(
          ownerId,
          'Cliente Dueno PDF',
          `pdf_dueno_${sufijo}@nuba.bo`,
          'cliente'
        )}`
      }
    });
    const buffer = Buffer.from(await autorizado.arrayBuffer());
    const textoPdf = extraerTextoPdf(buffer);
    const contentDisposition =
      autorizado.headers.get('content-disposition') || '';

    asegurar(
      autorizado.status === 200,
      'El dueno del pedido descarga el comprobante PDF (200)'
    );
    asegurar(
      (autorizado.headers.get('content-type') || '').includes(
        'application/pdf'
      ),
      'La respuesta declara Content-Type application/pdf'
    );
    asegurar(
      contentDisposition.startsWith('attachment; filename="comprobante-'),
      'La respuesta usa Content-Disposition con nombre seguro'
    );
    asegurar(
      buffer.subarray(0, 4).toString('ascii') === '%PDF',
      'El archivo descargado empieza con %PDF'
    );
    asegurar(
      textoPdf.includes(pedido.codigoRastreo),
      'El PDF contiene el codigo de rastreo'
    );
    asegurar(
      textoPdf.includes('55,00') && textoPdf.includes('Bs.'),
      'El PDF contiene el total en bolivianos'
    );
    asegurar(
      textoPdf.includes('Comprobante académico de simulación'),
      'El PDF incluye la nota de simulación sin valor fiscal'
    );

    const vendedor = await fetch(`${baseUrl}${ruta}`, {
      headers: {
        Authorization: `Bearer ${token(
          vendedorId,
          'Vendedor PDF',
          `pdf_vendedor_${sufijo}@nuba.bo`,
          'vendedor'
        )}`
      }
    });
    const bufferVendedor = Buffer.from(await vendedor.arrayBuffer());
    asegurar(
      vendedor.status === 200 &&
        bufferVendedor.subarray(0, 4).toString('ascii') === '%PDF',
      'Un vendedor puede descargar el comprobante PDF'
    );

    const admin = await fetch(`${baseUrl}${ruta}`, {
      headers: {
        Authorization: `Bearer ${token(
          adminId,
          'Admin PDF',
          `pdf_admin_${sufijo}@nuba.bo`,
          'admin'
        )}`
      }
    });
    const bufferAdmin = Buffer.from(await admin.arrayBuffer());
    asegurar(
      admin.status === 200 &&
        bufferAdmin.subarray(0, 4).toString('ascii') === '%PDF',
      'Un admin puede descargar el comprobante PDF'
    );

    const factura = await consultar(
      `SELECT numero_factura AS "numeroFactura"
       FROM facturas
       WHERE pedido_id = $1 AND tipo = 'compra_web'`,
      [pedidoId]
    );
    asegurar(
      factura.rowCount === 1 &&
        String(factura.rows[0].numeroFactura).startsWith('FAC-WEB-'),
      'Se crea un numero correlativo unico para el comprobante'
    );

    console.log(`\nResultado: ${exitos} prueba(s) exitosa(s), ${fallos} fallo(s).`);
  } catch (error) {
    console.error('Error critico en las pruebas del comprobante PDF:', error);
    fallos++;
  } finally {
    try {
      if (pedidoId) {
        await eliminarHistorialDePedidosDePrueba([pedidoId]);
      }
      await eliminarReferenciasDeUsuariosDePrueba(userIds);
      await consultar('DELETE FROM carritos WHERE usuario_id = ANY($1::int[])', [
        userIds
      ]);
      await consultar('DELETE FROM auditoria WHERE usuario_id = ANY($1::int[])', [
        userIds
      ]);
      await consultar('DELETE FROM usuarios WHERE id = ANY($1::int[])', [
        userIds
      ]);
      if (varianteId) {
        await consultar('DELETE FROM variantes WHERE id = $1', [varianteId]);
      }
      if (productoId) {
        await consultar('DELETE FROM productos WHERE id = $1', [productoId]);
      }
    } catch (error) {
      console.error('Error durante la limpieza del comprobante PDF:', error);
    }

    server.close(async () => {
      await cerrarPool();
      process.exit(fallos > 0 ? 1 : 0);
    });
  }
}

ejecutarPruebas();
