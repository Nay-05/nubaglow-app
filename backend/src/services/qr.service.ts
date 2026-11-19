/**
 * ============================================================================
 * NUBAGLOW APP - GENERACION DE QR SIMULADO
 * ============================================================================
 * El QR se construye en el servidor con el codigo del pedido y el monto total.
 * Su contenido es una simulacion academica, no una solicitud de pago real.
 */

import QRCode from 'qrcode';
import { obtenerDatosCobro } from '../config/cobro';

export async function generarQrSimulado(
  codigoRastreo: string,
  monto: number,
  referencia?: string | null
): Promise<string> {
  const datosCobro = obtenerDatosCobro();
  const contenido = [
    'NUBAGLOW - SIMULACION ACADEMICA',
    `Pedido: ${codigoRastreo}`,
    `Monto: Bs. ${Number(monto).toFixed(2)}`,
    `Referencia: ${referencia || datosCobro.referenciaQr}`,
    'No usar para pagos reales.'
  ].join('\n');

  return QRCode.toDataURL(contenido, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320
  });
}
