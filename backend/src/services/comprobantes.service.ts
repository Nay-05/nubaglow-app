/**
 * ============================================================================
 * NUBAGLOW APP - COMPROBANTES DE PAGO (QR SIMPLE / DEPOSITO BANCARIO)
 * ============================================================================
 * El cliente autenticado sube la imagen o PDF de su comprobante. El archivo se
 * valida en el servidor (tipo real, tamano y pertenencia del pedido) y se guarda
 * como data URL en la BD para que vendedor/admin puedan revisarlo sin depender
 * de un almacenamiento externo.
 *
 * Al recibir el comprobante, el pago pasa de 'Pendiente' a 'En verificación' y
 * se registra el evento y la auditoria en la misma transaccion.
 */

import crypto from 'crypto';
import { conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import { SubirComprobantePagoInput } from '../schemas/compra.schema';

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;
// 'qr' se conserva como alias legado de 'qr_simple'.
const METODOS_CON_COMPROBANTE = ['qr_simple', 'qr', 'deposito_bancario'];
const ESTADOS_QUE_ACEPTAN_COMPROBANTE = ['Pendiente', 'En verificación'];

interface ArchivoValidado {
  buffer: Buffer;
  mimeType: string;
  nombreArchivo: string;
  hashSha256: string;
}

export interface ComprobanteRegistrado {
  pedidoId: number;
  pagoId: number;
  comprobanteId: number;
  estado: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  hashSha256: string;
  recibidoEn: string;
}

function limpiarNombreArchivo(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() || 'comprobante';
  const limpio = base.replace(/[^\w.\- ()]/g, '_').trim().slice(0, 255);
  return limpio || 'comprobante';
}

function detectarMimeReal(buffer: Buffer): string | null {
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(firmaPng)) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }

  return null;
}

function validarArchivo(datos: SubirComprobantePagoInput): ArchivoValidado {
  const sinPrefijo = datos.contenido_base64.replace(/^data:[^;]+;base64,/i, '');
  const base64Limpio = sinPrefijo.replace(/\s+/g, '');

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Limpio)) {
    throw new AppError('El comprobante no tiene un contenido base64 valido', 400);
  }

  const buffer = Buffer.from(base64Limpio, 'base64');

  if (buffer.length === 0) {
    throw new AppError('El comprobante esta vacio', 400);
  }
  if (buffer.length > TAMANO_MAXIMO_BYTES) {
    throw new AppError('El comprobante excede el tamano maximo permitido (5 MB)', 400);
  }

  const mimeReal = detectarMimeReal(buffer);
  if (!mimeReal) {
    throw new AppError(
      'El contenido del archivo no corresponde a una imagen JPEG, PNG, WebP o PDF valido',
      400
    );
  }
  if (mimeReal !== datos.mime_type) {
    throw new AppError(
      `El contenido real del archivo (${mimeReal}) no coincide con el tipo declarado (${datos.mime_type})`,
      400
    );
  }

  return {
    buffer,
    mimeType: mimeReal,
    nombreArchivo: limpiarNombreArchivo(datos.nombre_archivo),
    hashSha256: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

export class ComprobantesService {
  async registrar(
    pedidoId: number,
    usuarioId: number,
    datos: SubirComprobantePagoInput
  ): Promise<ComprobanteRegistrado> {
    const archivo = validarArchivo(datos);

    return conTransaccion(async (cliente) => {
      const resPedido = await cliente.query(
        `SELECT id, usuario_id, estado, codigo_rastreo
         FROM pedidos
         WHERE id = $1
         FOR UPDATE`,
        [pedidoId]
      );

      if (resPedido.rows.length === 0) {
        throw new AppError('Pedido no encontrado', 404);
      }

      const pedido = resPedido.rows[0];
      if (Number(pedido.usuario_id) !== Number(usuarioId)) {
        throw new AppError('Acceso denegado: el pedido no pertenece al usuario autenticado', 403);
      }
      if (pedido.estado === 'Cancelado') {
        throw new AppError('No se puede cargar un comprobante de un pedido cancelado', 409);
      }

      const resPago = await cliente.query(
        `SELECT id, metodo, estado, fecha_vencimiento
         FROM pagos
         WHERE pedido_id = $1
         FOR UPDATE`,
        [pedidoId]
      );

      if (resPago.rows.length === 0) {
        throw new AppError('El pedido no tiene un pago asociado', 404);
      }

      const pago = resPago.rows[0];
      if (!METODOS_CON_COMPROBANTE.includes(pago.metodo)) {
        throw new AppError(
          'Solo los pagos por QR simple o deposito bancario requieren comprobante',
          409
        );
      }
      if (!ESTADOS_QUE_ACEPTAN_COMPROBANTE.includes(pago.estado)) {
        throw new AppError(
          `No se puede cargar un comprobante con el pago en estado '${pago.estado}'`,
          409
        );
      }
      if (
        pago.fecha_vencimiento &&
        new Date(pago.fecha_vencimiento).getTime() <= Date.now()
      ) {
        throw new AppError(
          'El plazo para acreditar el pago ya vencio. Realiza un nuevo pedido o contacta a atencion al cliente',
          409
        );
      }

      const dataUrl = `data:${archivo.mimeType};base64,${archivo.buffer.toString('base64')}`;

      const resComprobante = await cliente.query(
        `INSERT INTO comprobantes_pago
         (pago_id, nombre_archivo, url, mime_type, tamano_bytes, hash_sha256, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, creado_en AS "recibidoEn"`,
        [
          pago.id,
          archivo.nombreArchivo,
          dataUrl,
          archivo.mimeType,
          archivo.buffer.length,
          archivo.hashSha256,
          usuarioId
        ]
      );

      const comprobante = resComprobante.rows[0];

      await cliente.query(
        `UPDATE pagos
         SET estado = 'En verificación', comprobante_url = $1, actualizado_en = NOW()
         WHERE id = $2`,
        [dataUrl, pago.id]
      );

      const descripcion =
        pago.estado === 'En verificación'
          ? 'Comprobante de pago actualizado. El pago continua En verificación.'
          : 'Comprobante de pago recibido. El pago paso a En verificación.';

      await cliente.query(
        `INSERT INTO pago_eventos (pago_id, estado_anterior, estado_nuevo, descripcion, usuario_id)
         VALUES ($1, $2, 'En verificación', $3, $4)`,
        [pago.id, pago.estado, descripcion, usuarioId]
      );

      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'SUBIR_COMPROBANTE_PAGO', 'pagos', $2, $3)`,
        [
          usuarioId,
          pago.id,
          JSON.stringify({
            pedidoId,
            codigoRastreo: pedido.codigo_rastreo,
            comprobanteId: comprobante.id,
            nombreArchivo: archivo.nombreArchivo,
            mimeType: archivo.mimeType,
            tamanoBytes: archivo.buffer.length,
            hashSha256: archivo.hashSha256
          })
        ]
      );

      return {
        pedidoId,
        pagoId: pago.id,
        comprobanteId: comprobante.id,
        estado: 'En verificación',
        nombreArchivo: archivo.nombreArchivo,
        mimeType: archivo.mimeType,
        tamanoBytes: archivo.buffer.length,
        hashSha256: archivo.hashSha256,
        recibidoEn: comprobante.recibidoEn
      };
    });
  }
}

export const comprobantesService = new ComprobantesService();
