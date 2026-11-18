/**
 * ============================================================================
 * NUBAGLOW APP - SUITE DE PRUEBAS DE SEGURIDAD (FASE 3)
 * ============================================================================
 * Valida los controles criticos de CLAUDE.md Secciones 3 y 9:
 * 1. Bloqueo temporal por cuenta tras 5 intentos fallidos consecutivos (429).
 * 2. El bloqueo es temporal y expira solo (no es permanente).
 * 3. Un login correcto resetea el contador de fallos.
 * 4. Proteccion CSRF:
 *    - Mutacion con cookies y Origin no autorizado -> 403 Forbidden
 *    - Mutacion con cookies y SIN Origin ni Referer -> 403 Forbidden
 *    - Mutacion con cookies y Origin autorizado -> 200 OK
 *    - Mutacion mediante Authorization Bearer (sin cookies) -> 200 OK
 *    - Mutacion publica sin cookies de sesion (ej. registro) -> 201 Creado
 */

import bcrypt from 'bcryptjs';
import app from '../index';
import { consultar, cerrarPool } from '../db';
import { gestorBloqueoCuenta } from '../middlewares/bloqueoCuenta';

async function ejecutarPruebas() {
  console.log('Iniciando suite de pruebas automatizadas: Seguridad (Fase 3)...');

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  let exitos = 0;
  let fallos = 0;

  function asegurar(condicion: boolean, descripcion: string) {
    if (condicion) {
      console.log(`[PASS] ${descripcion}`);
      exitos++;
    } else {
      console.error(`[FAIL] ${descripcion}`);
      fallos++;
    }
  }

  const sufijo = Date.now().toString().slice(-6);
  const emailPrueba = `seguridad_${sufijo}@test.bo`;
  const passwordValida = `Segura!${sufijo}2026`;
  let usuarioId: number | undefined;
  let variantePruebaId: number | undefined;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Usuario de prueba y variante para mutaciones
    // ------------------------------------------------------------------------
    const hash = await bcrypt.hash(passwordValida, 12);
    const resUser = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Usuario Seguridad', $1, $2, 'cliente', TRUE) RETURNING id`,
      [emailPrueba, hash]
    );
    usuarioId = resUser.rows[0].id;

    const resVar = await consultar('SELECT id FROM variantes WHERE stock > 5 AND activo = TRUE LIMIT 1');
    variantePruebaId = resVar.rows[0].id;

    gestorBloqueoCuenta.reiniciarParaPruebas(emailPrueba);

    // ------------------------------------------------------------------------
    // 1. PRUEBAS DE BLOQUEO TEMPORAL DE CUENTA (ANTI-FUERZA BRUTA)
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Pruebas de Bloqueo por Fuerza Bruta (Cuenta) ---');

    // 4 primeros intentos fallidos -> deben devolver 401
    for (let i = 1; i <= 4; i++) {
      const resFallo = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailPrueba, password: 'PasswordErronea!999' })
      });
      asegurar(
        resFallo.status === 401,
        `Intento fallido ${i}/5 rechazado con 401 Unauthorized`
      );
    }

    // 5to intento fallido -> devuelve 401 y activa el bloqueo de la cuenta
    const resQuintoFallo = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailPrueba, password: 'PasswordErronea!999' })
    });
    asegurar(
      resQuintoFallo.status === 401,
      '5to intento fallido rechazado con 401 (bloqueo activado)'
    );

    // 6to intento (incluso con la contrasena correcta) -> debe dar 429 Too Many Requests
    const resSextoIntento = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailPrueba, password: passwordValida })
    });
    const dataBloqueo = (await resSextoIntento.json()) as any;
    asegurar(
      resSextoIntento.status === 429,
      'Intento subsiguiente es bloqueado con codigo HTTP 429 Too Many Requests'
    );
    asegurar(
      dataBloqueo.error && dataBloqueo.error.includes('Cuenta temporalmente bloqueada'),
      'Mensaje claro informa bloqueo temporal por exceso de intentos'
    );

    // Verificacion de que el bloqueo expira solo (no es permanente)
    gestorBloqueoCuenta.simularExpiracionBloqueoParaPruebas(emailPrueba);

    const resLoginTrasExpiracion = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailPrueba, password: passwordValida })
    });
    asegurar(
      resLoginTrasExpiracion.status === 200,
      'Tras expirar el tiempo de bloqueo, el acceso se reanuda correctamente (200 OK)'
    );

    // Verificacion de que un login exitoso resetea el contador de fallos
    const resFalloAislado = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailPrueba, password: 'PasswordErronea!999' })
    });
    asegurar(
      resFalloAislado.status === 401,
      'Contador de fallos reseteado: un error posterior da 401 normal y no 429'
    );

    // ------------------------------------------------------------------------
    // 2. PRUEBAS DE PROTECCION CSRF
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Pruebas de Proteccion CSRF ---');

    // Login legitimo para obtener token y cookies HttpOnly
    const resLoginExitoso = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailPrueba, password: passwordValida })
    });
    const cookiesEncabezado = resLoginExitoso.headers.get('set-cookie') || '';
    const tokenAcceso = ((await resLoginExitoso.json()) as any).datos.accessToken;

    // Extraer cookies para peticiones posteriores
    const cookiesParaEnviar = cookiesEncabezado
      .split(',')
      .map((c) => c.split(';')[0].trim())
      .join('; ');

    // 2.1. Mutacion con cookies desde Origin NO autorizado -> 403 Forbidden
    const resCsrfOrigenInvalido = await fetch(`${baseUrl}/api/carrito/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookiesParaEnviar,
        Origin: 'http://sitio-malicioso-phishing.com'
      },
      body: JSON.stringify({ variante_id: variantePruebaId, cantidad: 1 })
    });
    asegurar(
      resCsrfOrigenInvalido.status === 403,
      'Mutacion con cookies desde Origin no autorizado es rechazada con 403 Forbidden'
    );

    // 2.2. Mutacion con cookies y SIN Origin ni Referer -> 403 Forbidden
    const resCsrfSinOrigen = await fetch(`${baseUrl}/api/carrito/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookiesParaEnviar
        // Sin Origin ni Referer
      },
      body: JSON.stringify({ variante_id: variantePruebaId, cantidad: 1 })
    });
    asegurar(
      resCsrfSinOrigen.status === 403,
      'Mutacion con cookies sin Origin ni Referer es rechazada con 403 Forbidden'
    );

    // 2.3. Mutacion con cookies y Origin autorizado (ej. localhost:3000) -> 200 OK
    const resCsrfOrigenValido = await fetch(`${baseUrl}/api/carrito/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookiesParaEnviar,
        Origin: 'http://localhost:3000'
      },
      body: JSON.stringify({ variante_id: variantePruebaId, cantidad: 1 })
    });
    asegurar(
      resCsrfOrigenValido.status === 200,
      'Mutacion con cookies y Origin autorizado es aceptada exitosamente (200 OK)'
    );

    // 2.4. Mutacion mediante Authorization Bearer (sin cookies) -> 200 OK
    const resBearerValido = await fetch(`${baseUrl}/api/carrito/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAcceso}`
      },
      body: JSON.stringify({ variante_id: variantePruebaId, cantidad: 1 })
    });
    asegurar(
      resBearerValido.status === 200,
      'Mutacion mediante Authorization Bearer (API cliente sin cookies) es aceptada (200 OK)'
    );

    // 2.5. Mutacion publica sin cookies (Registro publico) -> 201 Created
    const resRegistroSinCookies = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Nuevo Usuario Libre',
        email: `libre_${sufijo}@test.bo`,
        password: `PasswordLibre!${sufijo}`
      })
    });
    asegurar(
      resRegistroSinCookies.status === 201,
      'Mutacion publica sin cookies de sesion no es bloqueada por CSRF (201 Created)'
    );

    // Limpieza del usuario adicional creado
    const dataReg = (await resRegistroSinCookies.json()) as any;
    if (dataReg.datos?.usuario?.id) {
      await consultar('DELETE FROM usuarios WHERE id = $1', [dataReg.datos.usuario.id]);
    }

    console.log(`\n============================================================`);
    console.log(`Resultado final de la suite Seguridad: ${exitos} aprobadas, ${fallos} fallidas.`);
    console.log(`============================================================\n`);

    server.close(async () => {
      await limpiarDatosPrueba(usuarioId);
      await cerrarPool();
      process.exit(fallos > 0 ? 1 : 0);
    });
  } catch (error) {
    console.error('Error critico durante la ejecucion de la suite Seguridad:', error);
    server.close(async () => {
      await limpiarDatosPrueba(usuarioId);
      await cerrarPool();
      process.exit(1);
    });
  }
}

async function limpiarDatosPrueba(userId?: number) {
  try {
    if (userId) {
      const resCar = await consultar('SELECT id FROM carritos WHERE usuario_id = $1', [userId]);
      const carIds = resCar.rows.map((c) => c.id);
      if (carIds.length > 0) {
        await consultar('DELETE FROM carrito_items WHERE carrito_id = ANY($1::int[])', [carIds]);
        await consultar('DELETE FROM carritos WHERE id = ANY($1::int[])', [carIds]);
      }
      await consultar('DELETE FROM usuarios WHERE id = $1', [userId]);
    }
  } catch (err) {
    console.error('Nota: error menor durante la limpieza de seguridad:', err);
  }
}

ejecutarPruebas();
