/**
 * ============================================================================
 * NUBAGLOW APP - COMPROBANTE PDF DE PEDIDO
 * ============================================================================
 * Genera un comprobante académico con pdfkit. El numero correlativo se guarda
 * en la tabla facturas para que una descarga repetida use el mismo numero.
 */

import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { conTransaccion } from '../db';

const COLOR_PRIMARIO = '#6d2e46';
const COLOR_TEXTO = '#2b2124';
const COLOR_MUTED = '#6b5b60';
const COLOR_LINEA = '#cebebe';
const COLOR_SUAVE = '#f4eee6';
const MARGEN = 50;
const ANCHO_UTIL = 495;

const ETIQUETAS_METODO: Record<string, string> = {
  qr_simple: 'QR simple',
  qr: 'QR simple',
  deposito_bancario: 'Depósito bancario',
  paypal: 'PayPal',
  contra_entrega: 'Contra entrega'
};

function formatearMonto(valor: number): string {
  const numero = Number(valor);
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(numero) ? numero : 0);
}

function formatearBs(valor: number): string {
  return `Bs. ${formatearMonto(valor)}`;
}

function formatearFechaPdf(valor: string | null | undefined): string {
  if (!valor) return 'Sin fecha';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(fecha);
}

function buscarLogo(): string | null {
  const carpeta = path.resolve(__dirname, '..', '..', '..', 'assets', 'brand');
  const candidatos = [
    'logo-nubaglow.png.jpg',
    'logo-nubaglow.png',
    'icono1.png'
  ];

  for (const candidato of candidatos) {
    const ruta = path.join(carpeta, candidato);
    if (fs.existsSync(ruta)) return ruta;
  }

  return null;
}

async function obtenerNumeroFactura(
  pedidoId: number,
  total: number
): Promise<string> {
  return conTransaccion(async (cliente) => {
    const existente = await cliente.query(
      `SELECT numero_factura AS "numeroFactura"
       FROM facturas
       WHERE pedido_id = $1 AND tipo = 'compra_web'
       LIMIT 1`,
      [pedidoId]
    );

    if (existente.rows.length > 0) {
      return existente.rows[0].numeroFactura;
    }

    const numero = `FAC-WEB-${String(pedidoId).padStart(6, '0')}`;

    await cliente.query(
      `INSERT INTO facturas
        (pedido_id, numero_factura, tipo, monto_total, es_simulacion)
       VALUES ($1, $2, 'compra_web', $3, TRUE)
       ON CONFLICT (numero_factura) DO NOTHING`,
      [pedidoId, numero, total]
    );

    const creada = await cliente.query(
      `SELECT numero_factura AS "numeroFactura"
       FROM facturas
       WHERE pedido_id = $1 AND tipo = 'compra_web'
       LIMIT 1`,
      [pedidoId]
    );

    return creada.rows.length > 0 ? creada.rows[0].numeroFactura : numero;
  });
}

function dibujarEncabezado(doc: PDFKit.PDFDocument): void {
  const logo = buscarLogo();

  if (logo) {
    try {
      doc.image(logo, MARGEN, 42, { width: 52 });
    } catch {
      // Si el logo no se puede leer, el PDF continua solo con el nombre.
    }
  }

  doc
    .fillColor(COLOR_PRIMARIO)
    .font('Helvetica-Bold')
    .fontSize(23)
    .text('NubaGlow', 112, 46);

  doc
    .fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text('Skincare y maquillaje · Sucre, Bolivia', 112, 72);

  doc
    .fillColor(COLOR_PRIMARIO)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('COMPROBANTE DE COMPRA', MARGEN, 120);

  doc
    .fillColor(COLOR_TEXTO)
    .font('Helvetica')
    .fontSize(9)
    .text(
      'Comprobante académico de simulación — Sin valor fiscal',
      MARGEN,
      137
    );

  doc
    .moveTo(MARGEN, 158)
    .lineTo(MARGEN + ANCHO_UTIL, 158)
    .strokeColor(COLOR_PRIMARIO)
    .lineWidth(1.2)
    .stroke();
}

function dibujarDatosPedido(
  doc: PDFKit.PDFDocument,
  pedido: any,
  numeroFactura: string
): void {
  let y = 174;

  doc
    .fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text('Número de comprobante', MARGEN, y)
    .text('Código de rastreo', 300, y);

  y += 13;
  doc
    .fillColor(COLOR_PRIMARIO)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(numeroFactura, MARGEN, y)
    .text(pedido.codigoRastreo, 300, y);

  y += 24;
  doc
    .fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text('Fecha del pedido', MARGEN, y)
    .text('Estado del pago', 300, y);

  y += 13;
  doc
    .fillColor(COLOR_TEXTO)
    .font('Helvetica')
    .fontSize(10)
    .text(formatearFechaPdf(pedido.creadoEn), MARGEN, y)
    .text(pedido.pago?.estado || 'Sin pago registrado', 300, y);

  y += 24;
  doc
    .fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text('Método de pago', MARGEN, y)
    .text('Total', 300, y);

  y += 13;
  const metodo = pedido.pago?.metodo
    ? ETIQUETAS_METODO[pedido.pago.metodo] || pedido.pago.metodo
    : 'Sin pago registrado';

  doc
    .fillColor(COLOR_TEXTO)
    .font('Helvetica')
    .fontSize(10)
    .text(metodo, MARGEN, y)
    .fillColor(COLOR_PRIMARIO)
    .font('Helvetica-Bold')
    .text(formatearBs(pedido.total), 300, y);
}

function dibujarDatosCliente(doc: PDFKit.PDFDocument, pedido: any): number {
  let y = 270;

  doc
    .fillColor(COLOR_PRIMARIO)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Datos del cliente', MARGEN, y);

  y += 18;
  const datos = [
    ['Nombre', pedido.nombreCliente],
    ['Celular', pedido.celularCliente],
    ['Correo', pedido.correoCliente],
    ['Ciudad', pedido.ciudad],
    ['Dirección', pedido.direccion]
  ];

  for (const [etiqueta, valor] of datos) {
    doc
      .fillColor(COLOR_MUTED)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(String(etiqueta).toUpperCase(), MARGEN, y);

    doc
      .fillColor(COLOR_TEXTO)
      .font('Helvetica')
      .fontSize(9)
      .text(String(valor || 'No registrado'), MARGEN + 90, y, {
        width: ANCHO_UTIL - 90
      });

    y += 15;
  }

  return y + 8;
}

function dibujarCabeceraTabla(doc: PDFKit.PDFDocument, y: number): void {
  doc
    .rect(MARGEN, y, ANCHO_UTIL, 20)
    .fillColor(COLOR_PRIMARIO)
    .fill();

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('PRODUCTO / VARIANTE', MARGEN + 6, y + 6, { width: 250 })
    .text('CANT.', 320, y + 6, { width: 40, align: 'right' })
    .text('P. UNIT.', 370, y + 6, { width: 70, align: 'right' })
    .text('SUBTOTAL', 450, y + 6, { width: 85, align: 'right' });
}

function dibujarItems(doc: PDFKit.PDFDocument, pedido: any): number {
  let y = 352;

  doc
    .fillColor(COLOR_PRIMARIO)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Detalle de artículos', MARGEN, y);

  y += 18;
  dibujarCabeceraTabla(doc, y);
  y += 20;

  const items = Array.isArray(pedido.items) ? pedido.items : [];

  for (const item of items) {
    const nombre = String(item.productoNombre || 'Producto');
    const variante = String(item.varianteNombre || 'Variante única');
    const textoItem = `${nombre} · ${variante}`;
    const alturaTexto = doc.heightOfString(textoItem, { width: 250 });
    const altoFila = Math.max(20, alturaTexto + 10);

    if (y + altoFila > 700) {
      doc.addPage();
      y = MARGEN;
      dibujarCabeceraTabla(doc, y);
      y += 20;
    }

    doc
      .fillColor(COLOR_TEXTO)
      .font('Helvetica')
      .fontSize(8)
      .text(textoItem, MARGEN + 6, y + 5, { width: 250 })
      .text(String(item.cantidad), 320, y + 5, {
        width: 40,
        align: 'right'
      })
      .text(formatearBs(item.precioUnitario), 360, y + 5, {
        width: 80,
        align: 'right'
      })
      .text(formatearBs(item.subtotal), 450, y + 5, {
        width: 85,
        align: 'right'
      });

    y += altoFila;
    doc
      .moveTo(MARGEN, y)
      .lineTo(MARGEN + ANCHO_UTIL, y)
      .strokeColor(COLOR_LINEA)
      .lineWidth(0.6)
      .stroke();
  }

  return y + 14;
}

function dibujarTotales(doc: PDFKit.PDFDocument, pedido: any, y: number): number {
  const xEtiqueta = 330;

  doc
    .fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text('Subtotal', xEtiqueta, y)
    .text(formatearBs(pedido.subtotal), 450, y, {
      width: 85,
      align: 'right'
    });

  y += 16;
  doc
    .fillColor(COLOR_MUTED)
    .text('Envío', xEtiqueta, y)
    .text(formatearBs(pedido.costoEnvio), 450, y, {
      width: 85,
      align: 'right'
    });

  y += 18;
  doc
    .rect(MARGEN + 270, y - 4, 225, 28)
    .fillColor(COLOR_SUAVE)
    .fill();

  doc
    .fillColor(COLOR_PRIMARIO)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('TOTAL', xEtiqueta, y + 3)
    .text(formatearBs(pedido.total), 450, y + 3, {
      width: 85,
      align: 'right'
    });

  return y + 42;
}

function dibujarNota(doc: PDFKit.PDFDocument, y: number): void {
  const nota =
    'Comprobante académico de simulación — Sin valor fiscal. ' +
    'NubaGlow es una tienda de Nuba Beauty, Sucre, Bolivia.';

  doc
    .rect(MARGEN, y, ANCHO_UTIL, 42)
    .fillColor(COLOR_SUAVE)
    .fill();

  doc
    .fillColor(COLOR_TEXTO)
    .font('Helvetica-Oblique')
    .fontSize(8)
    .text(nota, MARGEN + 10, y + 9, {
      width: ANCHO_UTIL - 20,
      align: 'center'
    });

  doc
    .fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(7)
    .text(
      'Documento generado automáticamente por NubaGlow.',
      MARGEN,
      y + 50,
      { width: ANCHO_UTIL, align: 'center' }
    );
}

export interface ComprobantePdfGenerado {
  buffer: Buffer;
  nombreArchivo: string;
  numeroFactura: string;
}

export class ComprobantePdfService {
  async generar(pedido: any): Promise<ComprobantePdfGenerado> {
    const numeroFactura = await obtenerNumeroFactura(
      Number(pedido.id),
      Number(pedido.total)
    );

    const buffer = await new Promise<Buffer>((resolver, rechazar) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: MARGEN,
        compress: false,
        info: {
          Title: `Comprobante ${pedido.codigoRastreo}`,
          Author: 'NubaGlow',
          Subject: 'Comprobante académico de compra'
        }
      });

      const partes: Buffer[] = [];
      doc.on('data', (parte) => partes.push(parte));
      doc.on('end', () => resolver(Buffer.concat(partes)));
      doc.on('error', rechazar);

      dibujarEncabezado(doc);
      dibujarDatosPedido(doc, pedido, numeroFactura);
      let y = dibujarDatosCliente(doc, pedido);
      y = dibujarItems(doc, pedido);
      y = dibujarTotales(doc, pedido, y);

      if (pedido.notas) {
        doc
          .fillColor(COLOR_MUTED)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text('NOTAS', MARGEN, y + 4);
        doc
          .fillColor(COLOR_TEXTO)
          .font('Helvetica')
          .fontSize(9)
          .text(String(pedido.notas), MARGEN + 50, y + 4, {
            width: ANCHO_UTIL - 50
          });
        y += 26;
      }

      dibujarNota(doc, y + 10);
      doc.end();
    });

    const codigoSeguro = String(pedido.codigoRastreo || 'pedido').replace(
      /[^A-Za-z0-9_-]/g,
      ''
    );

    return {
      buffer,
      nombreArchivo: `comprobante-${codigoSeguro}.pdf`,
      numeroFactura
    };
  }
}

export const comprobantePdfService = new ComprobantePdfService();
