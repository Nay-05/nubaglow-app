/**
 * ============================================================================
 * NUBAGLOW APP - SUITE DE PRUEBAS AUTOMATIZADAS: BLOQUE A
 * ============================================================================
 * Valida:
 * 1. Inicializacion del servidor Express y lectura de .env
 * 2. Endpoint de salud /api/salud con diagnostico de DB y latencia
 * 3. Manejo de errores centralizado y rutas 404 (sin trazas ni SQL)
 * 4. Middleware verificarToken (rechazo 401 si falta o es invalido)
 * 5. Middleware requerirRol (rechazo 403 con permisos insuficientes)
 * 6. Soporte dual de token (Header Authorization Bearer y Cookie HttpOnly)
 */

import jwt from 'jsonwebtoken';
import app from '../index';
import { cerrarPool } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_super_segura_nubaglow_2026';
process.env.JWT_SECRET = JWT_SECRET;

async function ejecutarPruebas() {
  console.log('Iniciando suite de pruebas automatizadas: Bloque A (Base del servidor y RBAC)...');

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

  try {
    // 1. Diagnostico de salud /api/salud
    const resSalud = await fetch(`${baseUrl}/api/salud`);
    const dataSalud = (await resSalud.json()) as any;
    asegurar(
      resSalud.status === 200 || resSalud.status === 503,
      `GET /api/salud responde con codigo HTTP valido (${resSalud.status})`
    );
    asegurar(
      dataSalud.servicio && dataSalud.version === '1.0.0',
      'GET /api/salud devuelve estructura normalizada con version y servicio'
    );

    // 2. Ruta desconocida 404
    const res404 = await fetch(`${baseUrl}/api/ruta-desconocida-de-prueba`);
    const data404 = (await res404.json()) as any;
    asegurar(res404.status === 404, 'Ruta inexistente devuelve 404');
    asegurar(
      data404.exito === false && typeof data404.error === 'string',
      'Error 404 devuelve formato JSON seguro sin exponer stack trace'
    );

    // 3. Ruta protegida sin token -> 401
    const resSinToken = await fetch(`${baseUrl}/api/salud/protegida`);
    const dataSinToken = (await resSinToken.json()) as any;
    asegurar(resSinToken.status === 401, 'Ruta protegida sin token devuelve 401');
    asegurar(
      dataSinToken.error.includes('No autenticado'),
      'Respuesta 401 entrega mensaje amigable y seguro'
    );

    // 4. Ruta protegida con token invalido o alterado -> 401
    const resTokenInvalido = await fetch(`${baseUrl}/api/salud/protegida`, {
      headers: { Authorization: 'Bearer token_invalido_de_prueba' }
    });
    asegurar(resTokenInvalido.status === 401, 'Token invalido o manipulado devuelve 401');

    // 5. Usuario con rol 'cliente' accede a ruta protegida general -> 200
    const tokenCliente = jwt.sign(
      { id: 10, nombre: 'Camila Morales', email: 'cliente@nuba.bo', rol: 'cliente', activo: true },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const resClienteProtegida = await fetch(`${baseUrl}/api/salud/protegida`, {
      headers: { Authorization: `Bearer ${tokenCliente}` }
    });
    asegurar(
      resClienteProtegida.status === 200,
      'Cliente autenticado accede exitosamente a ruta protegida general (200)'
    );

    // 6. Usuario con rol 'cliente' intenta acceder a ruta exclusiva de 'admin' -> 403
    const resClienteAdmin = await fetch(`${baseUrl}/api/salud/solo-admin`, {
      headers: { Authorization: `Bearer ${tokenCliente}` }
    });
    const dataClienteAdmin = (await resClienteAdmin.json()) as any;
    asegurar(
      resClienteAdmin.status === 403,
      'Cliente intentando acceder a ruta de admin recibe 403 (Acceso denegado)'
    );
    asegurar(
      dataClienteAdmin.error.includes('Acceso denegado'),
      'Mensaje 403 contiene detalle de autorizacion denegada'
    );

    // 7. Usuario con rol 'admin' accede a ruta exclusiva de 'admin' -> 200
    const tokenAdmin = jwt.sign(
      { id: 1, nombre: 'Administradora Nuba', email: 'admin@nuba.bo', rol: 'admin', activo: true },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const resAdmin = await fetch(`${baseUrl}/api/salud/solo-admin`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const dataAdmin = (await resAdmin.json()) as any;
    asegurar(resAdmin.status === 200, 'Usuario con rol admin accede correctamente (200)');
    asegurar(
      dataAdmin.usuario && dataAdmin.usuario.rol === 'admin',
      'El rol inyectado en req.usuario coincide con el token firmado'
    );

    // 8. Soporte de autenticacion por Cookie HttpOnly
    const resCookieAdmin = await fetch(`${baseUrl}/api/salud/solo-admin`, {
      headers: { Cookie: `access_token=${tokenAdmin}` }
    });
    asegurar(
      resCookieAdmin.status === 200,
      'Autenticacion via Cookie HttpOnly procesada con exito (200)'
    );

    console.log(`\nResultado final de la suite: ${exitos} aprobadas, ${fallos} fallidas.\n`);
    server.close(async () => {
      await cerrarPool();
      process.exit(fallos > 0 ? 1 : 0);
    });
  } catch (error) {
    console.error('Error durante la ejecucion de la suite de pruebas:', error);
    server.close(async () => {
      await cerrarPool();
      process.exit(1);
    });
  }
}

ejecutarPruebas();
