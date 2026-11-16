/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE SALUD DEL SISTEMA
 * ============================================================================
 * Verifica el estado del servidor Node.js y la conectividad con Supabase.
 */

import { consultar } from '../db';

export interface DiagnosticoSalud {
  estado: 'ok' | 'degradado';
  servicio: string;
  version: string;
  timestamp: string;
  tiempoActivoSegundos: number;
  baseDeDatos: {
    conectada: boolean;
    fechaDb?: string;
    nombreDb?: string;
    latenciaMs?: number;
    error?: string;
  };
}

export class SaludService {
  async verificarSalud(): Promise<DiagnosticoSalud> {
    const inicio = Date.now();
    try {
      const res = await consultar('SELECT 1 AS conectado, NOW() AS fecha_db, current_database() AS nombre_db');
      const latencia = Date.now() - inicio;

      return {
        estado: 'ok',
        servicio: 'NubaGlow API - E-commerce & Gestion Interna',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tiempoActivoSegundos: Math.floor(process.uptime()),
        baseDeDatos: {
          conectada: true,
          fechaDb: res.rows[0]?.fecha_db,
          nombreDb: res.rows[0]?.nombre_db,
          latenciaMs: latencia
        }
      };
    } catch (error: any) {
      return {
        estado: 'degradado',
        servicio: 'NubaGlow API - E-commerce & Gestion Interna',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tiempoActivoSegundos: Math.floor(process.uptime()),
        baseDeDatos: {
          conectada: false,
          error: 'Sin conexion con PostgreSQL / Supabase'
        }
      };
    }
  }
}

export const saludService = new SaludService();
