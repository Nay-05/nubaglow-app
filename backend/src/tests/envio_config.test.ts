/**
 * ============================================================================
 * NUBAGLOW APP - PRUEBA DE CONFIGURACION DE ENVIO POR ENTORNO
 * ============================================================================
 * Verifica que el costo de envio y el umbral de envio gratis los define el
 * negocio mediante ENVIO_COSTO y ENVIO_GRATIS_DESDE: al cambiar esas variables
 * el monto cotizado cambia sin modificar codigo.
 */

import { calcularCostoEnvio } from '../config/envio';

let exitos = 0;
let fallos = 0;

function asegurar(condicion: boolean, descripcion: string): void {
  if (condicion) {
    console.log(`[PASS] ${descripcion}`);
    exitos++;
  } else {
    console.error(`[FAIL] ${descripcion}`);
    fallos++;
  }
}

function aplicarEntorno(costo?: string, gratisDesde?: string): void {
  if (costo === undefined) {
    delete process.env.ENVIO_COSTO;
  } else {
    process.env.ENVIO_COSTO = costo;
  }

  if (gratisDesde === undefined) {
    delete process.env.ENVIO_GRATIS_DESDE;
  } else {
    process.env.ENVIO_GRATIS_DESDE = gratisDesde;
  }
}

async function ejecutarPruebas(): Promise<void> {
  console.log('Iniciando prueba de configuracion de envio por variables de entorno...');

  const costoOriginal = process.env.ENVIO_COSTO;
  const gratisOriginal = process.env.ENVIO_GRATIS_DESDE;

  try {
    // 1. Valores de ejemplo del negocio: 15 Bs. de costo y gratis desde 200 Bs.
    aplicarEntorno('15', '200');
    asegurar(calcularCostoEnvio(199.99) === 15, 'Con ENVIO_GRATIS_DESDE=200 un subtotal de 199.99 paga 15 Bs.');
    asegurar(calcularCostoEnvio(200) === 0, 'Con ENVIO_GRATIS_DESDE=200 un subtotal de 200 tiene envio gratis');

    // 2. Cambiar las variables cambia el cotizado (misma logica, otra politica).
    aplicarEntorno('25', '100');
    asegurar(calcularCostoEnvio(99.99) === 25, 'Con ENVIO_COSTO=25 un subtotal de 99.99 paga 25 Bs.');
    asegurar(calcularCostoEnvio(100) === 0, 'Con ENVIO_GRATIS_DESDE=100 un subtotal de 100 tiene envio gratis');

    // 3. Tambien se admiten valores decimales definidos por el negocio.
    aplicarEntorno('7.5', '150');
    asegurar(calcularCostoEnvio(149.99) === 7.5, 'Con ENVIO_COSTO=7.5 un subtotal de 149.99 paga 7.5 Bs.');
    asegurar(calcularCostoEnvio(150) === 0, 'Con ENVIO_GRATIS_DESDE=150 un subtotal de 150 tiene envio gratis');

    // 4. Un costo de envio en cero es una decision valida del negocio.
    aplicarEntorno('0', '200');
    asegurar(calcularCostoEnvio(50) === 0, 'Con ENVIO_COSTO=0 todo envio es gratuito');

    // 5. Sin subtotal no se cobra envio.
    aplicarEntorno('15', '200');
    asegurar(calcularCostoEnvio(0) === 0, 'Un subtotal de 0 no genera costo de envio');

    // 6. Valores invalidos vuelven al ejemplo por defecto (15 / 200).
    aplicarEntorno('abc', '');
    asegurar(calcularCostoEnvio(199.99) === 15, 'Un ENVIO_COSTO invalido usa el respaldo de 15 Bs.');
    asegurar(calcularCostoEnvio(200) === 0, 'Un ENVIO_GRATIS_DESDE vacio usa el respaldo de 200 Bs.');
  } finally {
    aplicarEntorno(costoOriginal, gratisOriginal);
  }

  console.log(`\nResultado: ${exitos} prueba(s) exitosa(s), ${fallos} fallo(s).`);
  if (fallos > 0) process.exit(1);
}

ejecutarPruebas();
