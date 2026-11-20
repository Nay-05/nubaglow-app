/**
 * ============================================================================
 * NUBAGLOW APP - COMPROBANTE PDF DE VENTA POS
 * ============================================================================
 * Genera un recibo académico de mostrador con pdfkit. El detalle de artículos
 * se conserva en ventas_pos.detalle para permitir descargas posteriores.
 */

import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const COLOR_PRIMARIO = '#6d2e46';
const COLOR_TEXTO = '#2b2124';
const COLOR_MUTED = '#6b5b60';
const COLOR_LINEA = '#cebebe';
const COLOR_SUAVE = '#f4eee6';
const MARGEN = 50;
const ANCHO_UTIL = 495;

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

function dibujarEncabezado(doc: PDFKit.PDFDocument): void {
  const logo = buscarLogo();

  if (logo) {
    try {
      doc.image(logo, MARGEN, 42, { width: 52 });
    } catch {
      // Si el logo no se puede leer, el PDF continua con el nombre.
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
    .text('COMPROBANTE DE VENTA POS', MARGEN, 120);

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

export interface ComprobantePosPdf {
  buffer: Buffer;
  nombreArchivo: string;
  numeroTicket: string;
}

export class PosPdfService {
  async generar(venta: any): Promise<ComprobantePosPdf> {
    const items = Array.isArray(venta.items) ? venta.items : [];
    const ticket = String(venta.numeroTicket || 'POS');
    const factura =
      venta.factura?.numeroFactura ||
      venta.numeroFactura ||
      'Sin factura';

    const buffer = await new Promise<Buffer>((resolver, rechazar) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: MARGEN,
        compress: false,
        info: {
          Title: `Comprobante POS ${ticket}`,
          Author: 'NubaGlow',
          Subject: 'Recibo académico de venta en mostrador'
        }
      });

      const partes: Buffer[] = [];
      doc.on('data', (parte) => partes.push(parte));
      doc.on('end', () => resolver(Buffer.concat(partes)));
      doc.on('error', rechazar);

      dibujarEncabezado(doc);

      let y = 174;
      doc
        .fillColor(COLOR_MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text('Ticket', MARGEN, y)
        .text('Factura', 200, y)
        .text('Fecha', 340, y);

      y += 13;
      doc
        .fillColor(COLOR_PRIMARIO)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(ticket, MARGEN, y)
        .text(factura, 200, y)
        .fillColor(COLOR_TEXTO)
        .font('Helvetica')
        .fontSize(10)
        .text(formatearFechaPdf(venta.creadoEn), 340, y);

      y += 24;
      doc
        .fillColor(COLOR_MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text('Vendedor', MARGEN, y)
        .text('Método de pago', 200, y);

      y += 13;
      doc
        .fillColor(COLOR_TEXTO)
        .font('Helvetica')
        .fontSize(10)
        .text(venta.vendedorNombre || 'Vendedor NubaGlow', MARGEN, y)
        .text(venta.metodoPago || 'Sin método', 200, y);

      y += 26;
      doc
        .fillColor(COLOR_PRIMARIO)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Datos del cliente', MARGEN, y);

      y += 17;
      const cliente = [
        ['Nombre', venta.clienteNombre || 'Cliente ocasional'],
        ['NIT / CI', venta.clienteNitCi || 'No registrado'],
        ['Correo', venta.clienteCorreo || 'No registrado']
      ];

      for (const [etiqueta, valor] of cliente) {
        doc
          .fillColor(COLOR_MUTED)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(String(etiqueta).toUpperCase(), MARGEN, y);
        doc
          .fillColor(COLOR_TEXTO)
          .font('Helvetica')
          .fontSize(9)
          .text(String(valor), MARGEN + 90, y, {
            width: ANCHO_UTIL - 90
          });
        y += 14;
      }

      y += 8;
      doc
        .fillColor(COLOR_PRIMARIO)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Detalle de artículos', MARGEN, y);

      y += 18;
      dibujarCabeceraTabla(doc, y);
      y += 20;

      for (const item of items) {
        const textoItem =
          `${item.productoNombre} · ${item.varianteNombre} ` +
          `(${item.sku})`;
        const altura = doc.heightOfString(textoItem, { width: 250 });
        const altoFila = Math.max(20, altura + 10);

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

      y += 14;
      doc
        .fillColor(COLOR_MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text('Subtotal', 330, y)
        .text(formatearBs(venta.subtotal), 450, y, {
          width: 85,
          align: 'right'
        });

      y += 16;
      doc
        .text('Recibido', 330, y)
        .text(formatearBs(venta.montoRecibido), 450, y, {
          width: 85,
          align: 'right'
        });

      y += 16;
      doc
        .text('Cambio', 330, y)
        .text(formatearBs(venta.cambio), 450, y, {
          width: 85,
          align: 'right'
        });

      y += 20;
      doc
        .rect(MARGEN + 270, y - 4, 225, 28)
        .fillColor(COLOR_SUAVE)
        .fill();
      doc
        .fillColor(COLOR_PRIMARIO)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('TOTAL', 330, y + 3)
        .text(formatearBs(venta.total), 450, y + 3, {
          width: 85,
          align: 'right'
        });

      const nota =
        'Comprobante académico de simulación — Sin valor fiscal. ' +
        'NubaGlow es una tienda de Nuba Beauty, Sucre, Bolivia.';
      doc
        .rect(MARGEN, y + 42, ANCHO_UTIL, 42)
        .fillColor(COLOR_SUAVE)
        .fill();
      doc
        .fillColor(COLOR_TEXTO)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text(nota, MARGEN + 10, y + 51, {
          width: ANCHO_UTIL - 20,
          align: 'center'
        });

      doc.end();
    });

    const ticketSeguro = ticket.replace(/[^A-Za-z0-9_-]/g, '');
    return {
      buffer,
      nombreArchivo: `comprobante-pos-${ticketSeguro}.pdf`,
      numeroTicket: ticket
    };
  }
}

export const posPdfService = new PosPdfService();
