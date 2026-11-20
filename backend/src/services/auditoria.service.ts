/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE CONSULTA DE AUDITORIA
 * ============================================================================
 * Visor de solo lectura para el rol admin con filtros por usuario, accion y
 * fecha local de Bolivia. Los registros son inmutables.
 */

import { consultar } from '../db';
import { ConsultaAuditoriaInput } from '../schemas/staff.schema';

export interface AuditoriaItem {
  id: number;
  usuarioId: number | null;
  usuarioNombre: string;
  usuarioEmail: string | null;
  accion: string;
  tablaAfectada: string | null;
  registroId: number | null;
  detalles: unknown;
  ipOrigen: string | null;
  creadoEn: string;
}

export class AuditoriaService {
  async opciones() {
    const [accionesRes, usuariosRes] = await Promise.all([
      consultar(
        `SELECT DISTINCT accion
         FROM auditoria
         ORDER BY accion ASC`
      ),
      consultar(
        `SELECT DISTINCT u.id, u.nombre, u.email
         FROM auditoria a
         INNER JOIN usuarios u ON u.id = a.usuario_id
         ORDER BY u.nombre ASC`
      )
    ]);

    return {
      acciones: accionesRes.rows.map((fila) => String(fila.accion)),
      usuarios: usuariosRes.rows
    };
  }

  async listar(filtros: ConsultaAuditoriaInput) {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];

    if (filtros.usuario_id !== undefined) {
      parametros.push(filtros.usuario_id);
      condiciones.push(`a.usuario_id = $${parametros.length}`);
    }

    if (filtros.accion) {
      parametros.push(filtros.accion);
      condiciones.push(`a.accion = $${parametros.length}`);
    }

    if (filtros.fecha) {
      parametros.push(filtros.fecha);
      condiciones.push(
        `(a.creado_en AT TIME ZONE 'America/La_Paz')::date = ` +
          `$${parametros.length}::date`
      );
    }

    const clausulaWhere =
      condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const pagina = filtros.pagina || 1;
    const limite = filtros.limite || 25;
    const offset = (pagina - 1) * limite;

    parametros.push(limite, offset);
    const consulta = `
      SELECT
        a.id,
        a.usuario_id AS "usuarioId",
        COALESCE(u.nombre, 'Sistema') AS "usuarioNombre",
        u.email AS "usuarioEmail",
        a.accion,
        a.tabla_afectada AS "tablaAfectada",
        a.registro_id AS "registroId",
        a.detalles,
        a.ip_origen AS "ipOrigen",
        a.creado_en AS "creadoEn",
        COUNT(*) OVER()::int AS total
      FROM auditoria a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ${clausulaWhere}
      ORDER BY a.creado_en DESC, a.id DESC
      LIMIT $${parametros.length - 1} OFFSET $${parametros.length}
    `;

    const res = await consultar(consulta, parametros);
    const total = res.rows.length > 0 ? Number(res.rows[0].total) : 0;
    const registros: AuditoriaItem[] = res.rows.map((fila) => {
      const { total: _total, ...item } = fila;
      return {
        ...item,
        usuarioId:
          item.usuarioId === null ? null : Number(item.usuarioId),
        registroId:
          item.registroId === null ? null : Number(item.registroId)
      } as AuditoriaItem;
    });

    return {
      registros,
      paginacion: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite)
      }
    };
  }
}

export const auditoriaService = new AuditoriaService();
