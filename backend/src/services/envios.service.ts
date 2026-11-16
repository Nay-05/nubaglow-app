/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE ENVIOS Y SEGUIMIENTO DE PAQUETES
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 7 y 8:
 * - Consulta publica por codigo de rastreo con anonimizacion de datos personales.
 * - Linea de tiempo detallada de envio_eventos.
 * - Transicion de estados estricta paso a paso (Pendiente -> En preparacion -> En transito -> Entregado).
 * - Restringido a roles 'operaciones' y 'admin'.
 * - Liquidacion automatica de pagos contra-entrega al pasar a 'Entregado'.
 */

import { consultar, conTransaccion } from '../db';
import { AppError } from '../middlewares/errores';

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
   * Transicion controlada de estado de envio (solo operaciones y admin)
   */
  async cambiarEstado(
    envioId: number,
    nuevoEstado: 'Pendiente' | 'En preparación' | 'En tránsito' | 'Entregado',
    descripcionPersonalizada: string | undefined,
    usuarioId: number
  ) {
    const resActual = await consultar(
      'SELECT id, pedido_id, codigo_rastreo, estado FROM envios WHERE id = $1',
      [envioId]
    );

    if (resActual.rows.length === 0) {
      throw new AppError('Envio no encontrado', 404);
    }

    const envio = resActual.rows[0];
    const estadoActual = envio.estado;

    // Regla estricta: flujo paso a paso sin saltos ni retrocesos
    const transicionesValidas: Record<string, string> = {
      'Pendiente': 'En preparación',
      'En preparación': 'En tránsito',
      'En tránsito': 'Entregado'
    };

    const siguienteEsperado = transicionesValidas[estadoActual];

    if (!siguienteEsperado || siguienteEsperado !== nuevoEstado) {
      throw new AppError(
        `Transicion no permitida. El estado actual es '${estadoActual}'. El unico cambio valido permitido es hacia '${siguienteEsperado || 'Ninguno (estado final)'}'`,
        400
      );
    }

    // Textos descriptivos por defecto si no se ingresa descripcion especifica
    const descripcionesPorDefecto: Record<string, string> = {
      'En preparación': 'El paquete ha sido preparado y acondicionado con embalaje de proteccion dermocosmetica.',
      'En tránsito': 'El paquete fue entregado al transportista y se encuentra en camino al domicilio de destino.',
      'Entregado': 'Paquete entregado exitosamente al cliente en la direccion de destino.'
    };

    const descFinal = descripcionPersonalizada?.trim() || descripcionesPorDefecto[nuevoEstado] || `Estado actualizado a ${nuevoEstado}`;

    return await conTransaccion(async (cliente) => {
      // 1. Actualizar tabla envios
      let sqlFecha = '';
      if (nuevoEstado === 'En tránsito') sqlFecha = ', fecha_despacho = NOW()';
      if (nuevoEstado === 'Entregado') sqlFecha = ', fecha_entrega = NOW()';

      await cliente.query(
        `UPDATE envios SET estado = $1, actualizado_en = NOW() ${sqlFecha} WHERE id = $2`,
        [nuevoEstado, envioId]
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

      // 4. Si pasa a 'Entregado' y el pago era 'contra_entrega' pendiente, se marca como Aprobado
      if (nuevoEstado === 'Entregado') {
        await cliente.query(
          `UPDATE pagos 
           SET estado = 'Aprobado', pagado_en = NOW() 
           WHERE pedido_id = $1 AND metodo = 'contra_entrega' AND estado = 'Pendiente'`,
          [envio.pedido_id]
        );
      }

      // 5. Auditoria de la operacion
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
            descripcion: descFinal
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
  }
}

export const enviosService = new EnviosService();
