/**
 * ============================================================================
 * NUBAGLOW APP - DATOS DE COBRO CONFIGURABLES
 * ============================================================================
 * Los datos bancarios y de referencia QR provienen exclusivamente del entorno.
 * Los valores por defecto son ficticios y solo sirven para demostracion academica.
 */

import fs from 'fs';
import path from 'path';

export interface DatosCobro {
  banco: string;
  titular: string;
  cuenta: string;
  referenciaQr: string;
  avisoSimulacion: string;
}

const AVISO_SIMULACION =
  'Datos de cobro y QR de simulacion academica. No realizar transferencias reales.';

const EXTENSIONES_IMAGEN_QR = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
const CARPETA_QR = path.resolve(__dirname, '..', '..', '..', 'assets', 'qr');

/**
 * Detecta la primera imagen de QR disponible en assets/qr/. Si no existe
 * ninguna, el llamador debe usar el QR simulado generado por el servidor.
 */
export function obtenerImagenQrPublica(): string | null {
  try {
    const archivos = fs
      .readdirSync(CARPETA_QR, { withFileTypes: true })
      .filter((entrada) => entrada.isFile())
      .map((entrada) => entrada.name)
      .filter((nombre) =>
        EXTENSIONES_IMAGEN_QR.has(path.extname(nombre).toLowerCase())
      )
      .sort((a, b) => a.localeCompare(b));

    if (archivos.length === 0) return null;

    return `/assets/qr/${encodeURIComponent(archivos[0])}`;
  } catch {
    return null;
  }
}

export function obtenerDatosCobro(): DatosCobro {
  return {
    banco: process.env.COBRO_BANCO?.trim() || 'Banco Demo Academico',
    titular: process.env.COBRO_TITULAR?.trim() || 'NubaGlow Simulacion',
    cuenta: process.env.COBRO_CUENTA?.trim() || '0000000000',
    referenciaQr: process.env.COBRO_REFERENCIA_QR?.trim() || 'NB-QR-DEMO-2026',
    avisoSimulacion: AVISO_SIMULACION
  };
}
