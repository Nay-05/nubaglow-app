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
import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import { SubirComprobantePagoInput } from '../schemas/compra.schema';
import { RolUsuario } from '../types';
import { maxMbComprobante, tamanoMaximoComprobanteBytes } from '../config/comprobantes';

// 'qr' se conserva como alias legado de 'qr_simple'.
const METODOS_CON_COMPROBANTE = ['qr_simple', 'qr', 'deposito_bancario'];
const ESTADOS_QUE_ACEPTAN_COMPROBANTE = ['Pendiente', 'En verificación'];
const ROLES_QUE_LEEN_COMPROBANTE: RolUsuario[] = ['cliente', 'vendedor', 'admin'];

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
  referencia: string;
  fechaDeposito: string;
  montoPagado: number;
  hashDuplicado: boolean;
  advertenciaHash: string | null;
  recibidoEn: string;
}

export interface ComprobanteDescarga {
  buffer: Buffer;
  mimeType: string;
  nombreArchivo: string;
}

export function limpiarNombreArchivo(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() || 'comprobante';
  const limpio = base.replace(/[^\w.\- ()]/g, '_').trim().slice(0, 255);
  return limpio || 'comprobante';
}

export function detectarMimeReal(buffer: Buffer): string | null {
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
  const limiteBytes = tamanoMaximoComprobanteBytes();
  if (buffer.length > limiteBytes) {
    throw new AppError(
      `El comprobante excede el tamano maximo permitido (${maxMbComprobante()} MB)`,
      400
    );
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
      const montoPagado = Math.round(Number(datos.monto_pagado) * 100) / 100;

      // El mismo archivo en otro pedido no se rechaza: solo se marca la advertencia.
      const resDuplicado = await cliente.query(
        `SELECT cp.id, p.pedido_id AS "pedidoId"
         FROM comprobantes_pago cp
         INNER JOIN pagos p ON p.id = cp.pago_id
         WHERE cp.hash_sha256 = $1
           AND p.pedido_id <> $2
         ORDER BY cp.id ASC
         LIMIT 1`,
        [archivo.hashSha256, pedidoId]
      );
      const duplicado = resDuplicado.rows[0] ?? null;

      const resComprobante = await cliente.query(
        `INSERT INTO comprobantes_pago
         (pago_id, nombre_archivo, url, mime_type, tamano_bytes, hash_sha256,
          referencia, fecha_deposito, monto_pagado, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, creado_en AS "recibidoEn"`,
        [
          pago.id,
          archivo.nombreArchivo,
          dataUrl,
          archivo.mimeType,
          archivo.buffer.length,
          archivo.hashSha256,
          datos.referencia,
          datos.fecha_deposito,
          montoPagado,
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
            hashSha256: archivo.hashSha256,
            referencia: datos.referencia,
            fechaDeposito: datos.fecha_deposito,
            montoPagado,
            hashDuplicado: Boolean(duplicado),
            pedidoDuplicadoId: duplicado?.pedidoId ?? null
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
        referencia: datos.referencia,
        fechaDeposito: datos.fecha_deposito,
        montoPagado,
        hashDuplicado: Boolean(duplicado),
        advertenciaHash: duplicado
          ? 'El mismo archivo ya fue subido en otro pedido'
          : null,
        recibidoEn: comprobante.recibidoEn
      };
    });
  }

  /**
   * Devuelve el archivo binario para visualizacion inline.
   * Solo el cliente dueno, vendedor y admin pueden leerlo.
   */
  async obtenerParaDescarga(
    comprobanteId: number,
    usuarioId: number,
    rol: RolUsuario
  ): Promise<ComprobanteDescarga> {
    const res = await consultar(
      `SELECT cp.id,
              cp.url,
              cp.mime_type AS "mimeType",
              cp.nombre_archivo AS "nombreArchivo",
              p.pedido_id AS "pedidoId",
              pe.usuario_id AS "propietarioId"
       FROM comprobantes_pago cp
       INNER JOIN pagos p ON p.id = cp.pago_id
       INNER JOIN pedidos pe ON pe.id = p.pedido_id
       WHERE cp.id = $1`,
      [comprobanteId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Comprobante no encontrado', 404);
    }

    const comprobante = res.rows[0];

    if (!ROLES_QUE_LEEN_COMPROBANTE.includes(rol)) {
      throw new AppError('Acceso denegado: su rol no puede visualizar comprobantes de pago', 403);
    }
    if (rol === 'cliente' && Number(comprobante.propietarioId) !== Number(usuarioId)) {
      throw new AppError('Acceso denegado: el comprobante no pertenece a un pedido suyo', 403);
    }

    const coincidencia = /^data:([^;]+);base64,([\s\S]+)$/.exec(String(comprobante.url || ''));
    if (!coincidencia) {
      throw new AppError('El comprobante almacenado no tiene un formato descargable', 422);
    }

    const buffer = Buffer.from(coincidencia[2], 'base64');
    const mimeReal = buffer.length > 0 ? detectarMimeReal(buffer) : null;

    if (!mimeReal || mimeReal !== comprobante.mimeType) {
      throw new AppError('El comprobante almacenado no es un archivo valido', 422);
    }

    return {
      buffer,
      mimeType: mimeReal,
      nombreArchivo: limpiarNombreArchivo(comprobante.nombreArchivo)
    };
  }
}

export const comprobantesService = new ComprobantesService();
