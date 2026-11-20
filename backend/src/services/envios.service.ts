/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE ENVIOS Y SEGUIMIENTO DE PAQUETES
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 7 y 8:
 * - Consulta publica por codigo de rastreo con anonimizacion de datos personales.
 * - Linea de tiempo detallada de envio_eventos.
 * - Transicion de estados estricta paso a paso (Pendiente -> En preparacion -> En transito -> Entregado).
 * - Restringido a roles 'almacen', 'logistica' y 'admin'.
 * - Liquidacion automatica de pagos contra-entrega al pasar a 'Entregado'.
 */

import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';
import { RolUsuario } from '../types';
import { urlAplicacion } from '../config/paypal';
import {
  crearCorreoCambioEnvio,
  notificacionesService
} from './notificaciones.service';

export type EstadoEnvio = 'Pendiente' | 'En preparación' | 'Empacado' | 'En tránsito' | 'Entregado';

export interface DatosEntrega {
  receptor: string;
  documento?: string;
  fecha_entrega: string;
  hora_entrega: string;
  nota: string;
  comprobante_url?: string;
}

function enmascararTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .split(' ')
    .map((palabra) => {
      if (palabra.length <= 2) return palabra[0] + '*';
      return palabra[0] + '*'.repeat(Math.min(palabra.length - 2, 4)) + palabra[palabra.length - 1];
    })
    .join(' ');
}

function enmascararTelefono(tel: string): string {
  if (!tel) return '';
  const limpio = tel.trim();
  if (limpio.length <= 4) return '****';
  return limpio.substring(0, 4) + '*'.repeat(limpio.length - 4);
}

function enmascararCorreo(correo: string): string {
  if (!correo) return '';
  const partes = correo.split('@');
  if (partes.length !== 2) return '****@***';
  const [local, dominio] = partes;
  const localMasc = local.length <= 2 ? local[0] + '*' : local[0] + '***' + local[local.length - 1];
  return `${localMasc}@${dominio}`;
}

export class EnviosService {
  /**
   * Consulta publica de rastreo por codigo unico (ej. NB-2026-0101)
   */
  async rastreoPublico(codigoRastreo: string) {
    const resEnvio = await consultar(
      `SELECT 
        e.id,
        e.codigo_rastreo AS "codigoRastreo",
        e.estado,
        e.transportista,
        e.fecha_despacho AS "fechaDespacho",
        e.fecha_entrega AS "fechaEntrega",
        p.ciudad,
        p.nombre_cliente AS "nombreCliente",
        p.celular_cliente AS "celularCliente",
        p.correo_cliente AS "correoCliente",
        p.direccion,
        p.creado_en AS "fechaPedido"
       FROM envios e
       INNER JOIN pedidos p ON p.id = e.pedido_id
       WHERE e.codigo_rastreo = $1`,
      [codigoRastreo.trim().toUpperCase()]
    );

    if (resEnvio.rows.length === 0) {
      throw new AppError('No se encontro ningun envio con el codigo de rastreo proporcionado', 404);
    }

    const envio = resEnvio.rows[0];

    // Obtener la cronologia de eventos
    const resEventos = await consultar(
      `SELECT 
        ee.id, 
        ee.estado, 
        ee.descripcion, 
        ee.creado_en AS "fechaHora"
       FROM envio_eventos ee
       WHERE ee.envio_id = $1
       ORDER BY ee.creado_en ASC`,
      [envio.id]
    );

    return {
      codigoRastreo: envio.codigoRastreo,
      estado: envio.estado,
      transportista: envio.transportista,
      ciudadDestino: envio.ciudad,
      fechaPedido: envio.fechaPedido,
      fechaDespacho: envio.fechaDespacho,
      fechaEntrega: envio.fechaEntrega,
      destinatarioProtegido: {
        nombre: enmascararTexto(envio.nombreCliente),
        celular: enmascararTelefono(envio.celularCliente),
        correo: enmascararCorreo(envio.correoCliente),
        direccion: enmascararTexto(envio.direccion)
      },
      lineaDeTiempo: resEventos.rows
    };
  }

  /**
   * Transicion controlada de estado de envio (almacen, logistica y admin)
   */
  async cambiarEstado(
    envioId: number,
    nuevoEstado: EstadoEnvio,
    descripcionPersonalizada: string | undefined,
    usuarioId: number,
    rolUsuario: RolUsuario,
    datosEntrega?: DatosEntrega
  ) {
    const resActual = await consultar(
      'SELECT id, pedido_id, codigo_rastreo, estado FROM envios WHERE id = $1',
      [envioId]
    );

    if (resActual.rows.length === 0) {
      throw new AppError('Envio no encontrado', 404);
    }

    const envio = resActual.rows[0];
    const estadoActual: EstadoEnvio = envio.estado;

    // Permisos por etapa: almacen prepara/empaca; logistica despacha/entrega.
    const estadosPermitidosPorRol: Record<string, EstadoEnvio[]> = {
      almacen: ['En preparación', 'Empacado'],
      logistica: ['En tránsito', 'Entregado'],
      admin: ['En preparación', 'Empacado', 'En tránsito', 'Entregado']
    };

    const estadosPermitidos = estadosPermitidosPorRol[rolUsuario];
    if (!estadosPermitidos || !estadosPermitidos.includes(nuevoEstado)) {
      throw new AppError(
        `Acceso denegado: el rol '${rolUsuario}' no puede cambiar un envio a '${nuevoEstado}'`,
        403
      );
    }

    // La entrega solo se cierra con acta: receptor, fecha, hora y nota.
    if (nuevoEstado === 'Entregado' && !datosEntrega) {
      throw new AppError(
        'La entrega requiere comprobante con receptor, fecha, hora y nota',
        400
      );
    }

    // Regla estricta: flujo paso a paso sin saltos ni retrocesos
    const transicionesValidas: Record<string, EstadoEnvio> = {
      'Pendiente': 'En preparación',
      'En preparación': 'Empacado',
      'Empacado': 'En tránsito',
      'En tránsito': 'Entregado'
    };

    const siguienteEsperado = transicionesValidas[estadoActual];

    if (!siguienteEsperado || siguienteEsperado !== nuevoEstado) {
      throw new AppError(
        `Transicion no permitida. El estado actual es '${estadoActual}'. ` +
          'El unico cambio valido permitido es hacia ' +
          `'${siguienteEsperado || 'Ninguno (estado final)'}'`,
        400
      );
    }

    // Regla de negocio: almacen solo prepara con pago Aprobado o contra_entrega.
    if (estadoActual === 'Pendiente' && nuevoEstado === 'En preparación') {
      const resPago = await consultar(
        'SELECT metodo, estado FROM pagos WHERE pedido_id = $1',
        [envio.pedido_id]
      );

      if (resPago.rows.length === 0) {
        throw new AppError(
          'El pedido no tiene un pago registrado. No se puede preparar.',
          409
        );
      }

      const pago = resPago.rows[0];
      if (pago.metodo !== 'contra_entrega' && pago.estado !== 'Aprobado') {
        throw new AppError(
          pago.estado === 'Rechazado'
            ? 'El pago fue rechazado. El pedido no puede prepararse.'
            : 'El pago aún no fue verificado. No se puede preparar el pedido.',
          409
        );
      }
    }

    // Textos descriptivos por defecto si no se ingresa descripcion especifica
    const descripcionesPorDefecto: Record<string, string> = {
      'En preparación': 'El paquete ha sido preparado y acondicionado con embalaje de proteccion dermocosmetica.',
      'Empacado': 'El paquete fue empacado y esta listo para ser despachado por logistica.',
      'En tránsito': 'El paquete fue entregado al transportista y se encuentra en camino al domicilio de destino.',
      'Entregado': 'Paquete entregado exitosamente al cliente en la direccion de destino.'
    };

    const descFinal =
      descripcionPersonalizada?.trim() ||
      descripcionesPorDefecto[nuevoEstado] ||
      `Estado actualizado a ${nuevoEstado}`;

    const resultado = await conTransaccion(async (cliente) => {
      // 1. Actualizar tabla envios y registrar al responsable de la etapa
      let camposResponsable = '';
      if (nuevoEstado === 'En preparación') camposResponsable = ', preparado_por = $3';
      if (nuevoEstado === 'Empacado') camposResponsable = ', empacado_por = $3';
      if (nuevoEstado === 'En tránsito') camposResponsable = ', despachado_por = $3, fecha_despacho = NOW()';
      if (nuevoEstado === 'Entregado') camposResponsable = ', entregado_por = $3, fecha_entrega = NOW()';

      await cliente.query(
        `UPDATE envios
         SET estado = $1, actualizado_en = NOW() ${camposResponsable}
         WHERE id = $2`,
        [nuevoEstado, envioId, usuarioId]
      );

      // 2. Sincronizar estado en la tabla pedidos
      await cliente.query('UPDATE pedidos SET estado = $1, actualizado_en = NOW() WHERE id = $2', [
        nuevoEstado,
        envio.pedido_id
      ]);

      // 3. Insertar nuevo evento en la linea de tiempo
      await cliente.query(
        `INSERT INTO envio_eventos (envio_id, estado, descripcion, usuario_id)
         VALUES ($1, $2, $3, $4)`,
        [envioId, nuevoEstado, descFinal, usuarioId]
      );

      // 4. Cierre de entrega: acta con receptor, fecha, hora y nota
      if (nuevoEstado === 'Entregado' && datosEntrega) {
        const resEntregaExistente = await cliente.query('SELECT id FROM entregas WHERE envio_id = $1', [envioId]);
        if (resEntregaExistente.rows.length > 0) {
          throw new AppError('Este envio ya tiene una entrega registrada', 409);
        }

        await cliente.query(
          `INSERT INTO entregas
           (pedido_id, envio_id, receptor, documento, fecha_entrega, hora_entrega, nota, comprobante_url, usuario_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            envio.pedido_id,
            envioId,
            datosEntrega.receptor.trim(),
            datosEntrega.documento?.trim() || null,
            datosEntrega.fecha_entrega,
            datosEntrega.hora_entrega,
            datosEntrega.nota.trim(),
            datosEntrega.comprobante_url?.trim() || null,
            usuarioId
          ]
        );
      }

      // 5. Si pasa a 'Entregado' y el pago era 'contra_entrega' pendiente, se marca como Aprobado
      if (nuevoEstado === 'Entregado') {
        const resPagoLiquidado = await cliente.query(
          `UPDATE pagos
           SET estado = 'Aprobado', pagado_en = NOW(), actualizado_en = NOW()
           WHERE pedido_id = $1 AND metodo = 'contra_entrega' AND estado = 'Pendiente'
           RETURNING id`,
          [envio.pedido_id]
        );

        if (resPagoLiquidado.rows.length > 0) {
          await cliente.query(
            `INSERT INTO pago_eventos (pago_id, estado_anterior, estado_nuevo, descripcion, usuario_id)
             VALUES ($1, 'Pendiente', 'Aprobado', $2, $3)`,
            [
              resPagoLiquidado.rows[0].id,
              'Pago contra entrega cobrado al momento de la entrega.',
              usuarioId
            ]
          );
        }
      }

      // 6. Auditoria de la operacion
      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'CAMBIAR_ESTADO_ENVIO', 'envios', $2, $3)`,
        [
          usuarioId,
          envioId,
          JSON.stringify({
            codigoRastreo: envio.codigo_rastreo,
            estadoAnterior: estadoActual,
            nuevoEstado,
            descripcion: descFinal,
            ...(datosEntrega
              ? {
                  receptor: datosEntrega.receptor,
                  fechaEntrega: datosEntrega.fecha_entrega,
                  horaEntrega: datosEntrega.hora_entrega
                }
              : {})
          })
        ]
      );

      return {
        id: envioId,
        codigoRastreo: envio.codigo_rastreo,
        estadoAnterior: estadoActual,
        nuevoEstado,
        descripcion: descFinal
      };
    });

    // Correo al cliente fuera de la transaccion: un fallo nunca revierte el
    // cambio de estado y queda registrado por notificacionesService.
    try {
      const contacto = await consultar(
        `SELECT p.correo_cliente AS "correoCliente",
                p.nombre_cliente AS "nombreCliente"
         FROM pedidos p
         WHERE p.id = $1`,
        [envio.pedido_id]
      );
      const fila = contacto.rows[0];

      if (fila && fila.correoCliente) {
        const enlace =
          `${urlAplicacion()}/pedido/` +
          encodeURIComponent(envio.codigo_rastreo);
        const fecha = new Intl.DateTimeFormat('es-BO', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(new Date());

        await notificacionesService.enviarCorreo({
          pedidoId: envio.pedido_id,
          destinatario: fila.correoCliente,
          asunto:
            `NubaGlow: tu pedido ${envio.codigo_rastreo} ` +
            `está en ${nuevoEstado}`,
          cuerpo: [
            `Hola ${fila.nombreCliente},`,
            '',
            `Tu pedido ${envio.codigo_rastreo} cambió de estado.`,
            `Estado anterior: ${estadoActual}`,
            `Nuevo estado: ${nuevoEstado}`,
            descFinal,
            `Fecha y hora: ${fecha}`,
            '',
            `Revisa el seguimiento en: ${enlace}`,
            '',
            'NubaGlow'
          ].join('\n')
        });
      }
    } catch (error) {
      console.error(
        'No se pudo notificar el cambio de estado del envío:',
        error
      );
    }

    return resultado;
  }

  /**
   * Cierre de entrega con acta: reutiliza la transicion controlada a 'Entregado'.
   */
  async cerrarEntrega(
    envioId: number,
    datosEntrega: DatosEntrega,
    usuarioId: number,
    rolUsuario: RolUsuario
  ) {
    return this.cambiarEstado(
      envioId,
      'Entregado',
      `Entrega cerrada con receptor ${datosEntrega.receptor.trim()}.`,
      usuarioId,
      rolUsuario,
      datosEntrega
    );
  }
}

export const enviosService = new EnviosService();
