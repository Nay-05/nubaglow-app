/**
 * ============================================================================
 * NUBAGLOW APP - DATOS DE COBRO CONFIGURABLES
 * ============================================================================
 * Los datos bancarios y de referencia QR provienen exclusivamente del entorno.
 * Los valores por defecto son ficticios y solo sirven para demostracion academica.
 */

export interface DatosCobro {
  banco: string;
  titular: string;
  cuenta: string;
  referenciaQr: string;
  avisoSimulacion: string;
}

const AVISO_SIMULACION =
  'Datos de cobro y QR de simulacion academica. No realizar transferencias reales.';

export function obtenerDatosCobro(): DatosCobro {
  return {
    banco: process.env.COBRO_BANCO?.trim() || 'Banco Demo Academico',
    titular: process.env.COBRO_TITULAR?.trim() || 'NubaGlow Simulacion',
    cuenta: process.env.COBRO_CUENTA?.trim() || '0000000000',
    referenciaQr: process.env.COBRO_REFERENCIA_QR?.trim() || 'NB-QR-DEMO-2026',
    avisoSimulacion: AVISO_SIMULACION
  };
}
