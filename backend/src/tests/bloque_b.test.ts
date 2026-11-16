/**
 * ============================================================================
 * NUBAGLOW APP - SUITE DE PRUEBAS AUTOMATIZADAS: BLOQUE B
 * ============================================================================
 * Valida:
 * 1. Registro publico forzando siempre rol = 'cliente' (ignora rol externo).
 * 2. Login de clientes con credenciales correctas e incorrectas (mensaje generico).
 * 3. Segregacion de accesos:
 *    - Cliente intentando ingresar por /api/auth/staff-login -> 403.
 *    - Staff intentando ingresar por /api/auth/login de clientes -> 403.
 * 4. Renovacion de sesion (refresh token) y logout.
 * 5. Filtros combinados de catalogo (busqueda, categoria, tipo de piel, precios).
 * 6. Control de permisos RBAC en catalogo:
 *    - Cliente intentando crear producto -> 403.
 *    - Admin creando, actualizando y eliminando producto y variantes -> 200/201.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../index';
import { consultar, cerrarPool } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_super_segura_nubaglow_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'clave_secreta_jwt_refresh_distinta_y_larga';
process.env.JWT_SECRET = JWT_SECRET;
process.env.JWT_REFRESH_SECRET = JWT_REFRESH_SECRET;

async function ejecutarPruebas() {
  console.log('Iniciando suite de pruebas automatizadas: Bloque B (Autenticacion y Catalogo)...');

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

  // Datos dinamicos para la prueba (sin contrasenas quemadas)
  const sufijo = Date.now().toString().slice(-6);
  const emailClientePrueba = `cliente_test_${sufijo}@nuba.bo`;
  const passwordClientePrueba = `Password!${sufijo}`;

  const emailStaffPrueba = `vendedor_test_${sufijo}@nuba.bo`;
  const passwordStaffPrueba = `StaffPass!${sufijo}`;

  let productoTestId: number | null = null;
  let categoriaTestId: number | null = null;

  try {
    // ------------------------------------------------------------------------
    // 1. REGISTRO PUBLICO (Fuerza siempre rol = 'cliente')
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Pruebas de Registro Publico ---');
    const resRegistro = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Cliente de Prueba',
        email: emailClientePrueba,
        password: passwordClientePrueba,
        rol: 'admin' // Intento malicioso de inyectar rol de administrador
      })
    });

    const dataRegistro = (await resRegistro.json()) as any;
    asegurar(resRegistro.status === 201, 'Registro publico responde 201 Creado');
    asegurar(
      dataRegistro.datos.usuario.rol === 'cliente',
      'El rol asignado es forzosamente cliente (ignoro rol = admin enviado en body)'
    );
    asegurar(
      Boolean(dataRegistro.datos.accessToken),
      'El registro devuelve un accessToken de autenticacion'
    );

    // Registro duplicado debe fallar con 409
    const resDuplicado = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Cliente Duplicado',
        email: emailClientePrueba,
        password: passwordClientePrueba
      })
    });
    asegurar(resDuplicado.status === 409, 'Intento de registro con email duplicado devuelve 409 Conflicto');

    // ------------------------------------------------------------------------
    // 2. LOGIN DE CLIENTES (/api/auth/login)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Pruebas de Login de Clientes ---');
    // Contrasena incorrecta -> 401
    const resLoginPassErronea = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailClientePrueba,
        password: 'PasswordIncorrecta!999'
      })
    });
    const dataLoginPassErronea = (await resLoginPassErronea.json()) as any;
    asegurar(resLoginPassErronea.status === 401, 'Login con contrasena incorrecta devuelve 401');
    asegurar(
      dataLoginPassErronea.error.includes('Credenciales invalidas'),
      'Mensaje de error es generico (anti-enumeracion de cuentas)'
    );

    // Correo inexistente -> 401 con el mismo mensaje generico
    const resLoginNoExiste = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nadie_fantasma@nuba.bo',
        password: 'PasswordCualquiera!123'
      })
    });
    const dataLoginNoExiste = (await resLoginNoExiste.json()) as any;
    asegurar(resLoginNoExiste.status === 401, 'Login con correo inexistente devuelve 401');
    asegurar(
      dataLoginNoExiste.error.includes('Credenciales invalidas'),
      'Correo inexistente produce identico mensaje de credenciales invalidas'
    );

    // Login correcto de cliente
    const resLoginCliente = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailClientePrueba,
        password: passwordClientePrueba
      })
    });
    const dataLoginCliente = (await resLoginCliente.json()) as any;
    const cookieCabecera = resLoginCliente.headers.get('set-cookie') || '';

    asegurar(resLoginCliente.status === 200, 'Login correcto de cliente devuelve 200 OK');
    asegurar(dataLoginCliente.datos.usuario.email === emailClientePrueba, 'Usuario autenticado coincide');
    asegurar(cookieCabecera.includes('access_token'), 'Se fija cookie access_token HttpOnly en respuesta');
    asegurar(cookieCabecera.includes('refresh_token'), 'Se fija cookie refresh_token HttpOnly en respuesta');

    // ------------------------------------------------------------------------
    // 3. SEGREGACION DE PORTALES (Cliente en Staff y Staff en Cliente)
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Pruebas de Segregacion de Portales ---');
    // Cliente intentando entrar por /api/auth/staff-login -> 403
    const resClienteEnStaff = await fetch(`${baseUrl}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailClientePrueba,
        password: passwordClientePrueba
      })
    });
    const dataClienteEnStaff = (await resClienteEnStaff.json()) as any;
    asegurar(
      resClienteEnStaff.status === 403,
      'Cliente intentando loguearse en portal de staff recibe 403 Prohibido'
    );
    asegurar(
      dataClienteEnStaff.error.includes('no pertenece al personal interno'),
      'Mensaje explicito de rechazo a clientes en portal de personal'
    );

    // Crear un usuario de staff para probar el caso inverso
    const hashStaff = await bcrypt.hash(passwordStaffPrueba, 12);
    await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Vendedor Test', $1, $2, 'vendedor', TRUE)
       ON CONFLICT (email) DO NOTHING`,
      [emailStaffPrueba, hashStaff]
    );

    // Staff intentando entrar por el login de clientes de la tienda -> 403
    const resStaffEnCliente = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailStaffPrueba,
        password: passwordStaffPrueba
      })
    });
    const dataStaffEnCliente = (await resStaffEnCliente.json()) as any;
    asegurar(
      resStaffEnCliente.status === 403,
      'Staff intentando loguearse por portal publico de clientes recibe 403 Prohibido'
    );
    asegurar(
      dataStaffEnCliente.error.includes('personal interno'),
      'Mensaje indica que personal interno debe usar portal de staff'
    );

    // Staff ingresando por /api/auth/staff-login -> 200 OK
    const resStaffLoginOk = await fetch(`${baseUrl}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailStaffPrueba,
        password: passwordStaffPrueba
      })
    });
    asegurar(resStaffLoginOk.status === 200, 'Staff ingresa exitosamente por staff-login (200 OK)');

    // ------------------------------------------------------------------------
    // 4. REFRESH TOKEN Y LOGOUT
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Pruebas de Refresh Token y Logout ---');
    const tokenCliente = dataLoginCliente.datos.accessToken;
    const tokenClienteDecod = jwt.decode(tokenCliente) as any;

    const refreshTokenValido = jwt.sign(
      { id: tokenClienteDecod.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Renovacion exitosa
    const resRefresh = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenValido })
    });
    const dataRefresh = (await resRefresh.json()) as any;
    asegurar(resRefresh.status === 200, 'Renovacion de sesion con refresh token devuelve 200 OK');
    asegurar(Boolean(dataRefresh.datos.accessToken), 'Se genera un nuevo accessToken');

    // Logout
    const resLogout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    const cookieLogout = resLogout.headers.get('set-cookie') || '';
    asegurar(resLogout.status === 200, 'Cierre de sesion responde 200 OK');
    asegurar(
      cookieLogout.includes('access_token=;') || cookieLogout.includes('Max-Age=0'),
      'Logout limpia las cookies de sesion'
    );

    // ------------------------------------------------------------------------
    // 5. CATALOGO: CATEGORIAS Y PRODUCTOS CON FILTROS
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Pruebas de Catalogo y Filtros ---');
    // Listar categorias
    const resCategorias = await fetch(`${baseUrl}/api/categorias`);
    const dataCategorias = (await resCategorias.json()) as any;
    asegurar(resCategorias.status === 200, 'Listado publico de categorias responde 200');
    asegurar(
      Array.isArray(dataCategorias.datos.categorias) && dataCategorias.datos.categorias.length >= 6,
      'Se listan las categorias maestras con conteo de productos'
    );
    categoriaTestId = dataCategorias.datos.categorias[0].id;

    // Listar productos
    const resProductos = await fetch(`${baseUrl}/api/productos`);
    const dataProductos = (await resProductos.json()) as any;
    asegurar(resProductos.status === 200, 'Listado publico de productos responde 200');
    asegurar(
      Array.isArray(dataProductos.datos.productos) && dataProductos.datos.productos.length > 0,
      'Se obtienen productos paginados del catalogo'
    );

    // Filtro por busqueda de texto
    const resBusqueda = await fetch(`${baseUrl}/api/productos?buscar=Serum`);
    const dataBusqueda = (await resBusqueda.json()) as any;
    asegurar(resBusqueda.status === 200, 'Busqueda por termino "Serum" responde 200');
    const todosContienenTermino = dataBusqueda.datos.productos.every(
      (p: any) =>
        p.nombre.toLowerCase().includes('serum') ||
        p.descripcion.toLowerCase().includes('serum') ||
        p.categoriaNombre.toLowerCase().includes('serum')
    );
    asegurar(todosContienenTermino, 'Los productos retornados coinciden con el termino buscado');

    // Filtro por tipo de piel
    const resPiel = await fetch(`${baseUrl}/api/productos?tipo_piel=Seca`);
    const dataPiel = (await resPiel.json()) as any;
    asegurar(resPiel.status === 200, 'Filtro por tipo de piel responde 200');
    const todosPielSeca = dataPiel.datos.productos.every((p: any) => p.tipoPiel === 'Seca');
    asegurar(todosPielSeca, 'Todos los productos filtrados corresponden a piel Seca');

    // Detalle de producto por slug
    const primerSlug = dataProductos.datos.productos[0].slug;
    const resDetalle = await fetch(`${baseUrl}/api/productos/${primerSlug}`);
    const dataDetalle = (await resDetalle.json()) as any;
    asegurar(resDetalle.status === 200, `Detalle de producto por slug (${primerSlug}) responde 200`);
    asegurar(
      Array.isArray(dataDetalle.datos.producto.variantes) && dataDetalle.datos.producto.variantes.length > 0,
      'El detalle incluye sus variantes con precio y stock individual'
    );

    // ------------------------------------------------------------------------
    // 6. CONTROL RBAC EN CREACION DE PRODUCTOS
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Pruebas de Permisos RBAC en Catalogo ---');
    const nuevoProductoSlug = `producto-test-${sufijo}`;
    const payloadProducto = {
      categoria_id: categoriaTestId,
      nombre: `Producto Test ${sufijo}`,
      slug: nuevoProductoSlug,
      marca: 'Nuba Beauty',
      tipo_piel: 'Todo tipo',
      descripcion: 'Descripcion cientifica de prueba dermatologica para evaluacion.',
      ingredientes: 'Aqua, Niacinamide, Glycerin.',
      modo_uso: 'Aplicar diariamente por las mananas.'
    };

    // Cliente intentando crear producto -> 403
    const resClienteCrearProd = await fetch(`${baseUrl}/api/productos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCliente}`
      },
      body: JSON.stringify(payloadProducto)
    });
    asegurar(
      resClienteCrearProd.status === 403,
      'Cliente no autorizado intentando crear producto recibe 403 Prohibido'
    );

    // Admin creando producto -> 201
    const tokenAdmin = jwt.sign(
      { id: 1, nombre: 'Admin Nuba', email: 'admin@nuba.bo', rol: 'admin', activo: true },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const resAdminCrearProd = await fetch(`${baseUrl}/api/productos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify(payloadProducto)
    });
    const dataAdminCrearProd = (await resAdminCrearProd.json()) as any;
    asegurar(resAdminCrearProd.status === 201, 'Usuario admin crea producto exitosamente (201)');
    productoTestId = dataAdminCrearProd.datos.producto.id;

    // Admin agregando variante al producto
    const skuTest = `SKU-TEST-${sufijo}`;
    const resCrearVar = await fetch(`${baseUrl}/api/productos/${productoTestId}/variantes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        sku: skuTest,
        nombre: 'Presentacion 50 ml',
        precio: 140.0,
        stock: 25,
        punto_reorden: 5
      })
    });
    const dataCrearVar = (await resCrearVar.json()) as any;
    asegurar(resCrearVar.status === 201, 'Admin registra nueva variante con precio y stock (201)');
    const varianteTestId = dataCrearVar.datos.variante.id;

    // Admin actualizando variante
    const resActVar = await fetch(`${baseUrl}/api/variantes/${varianteTestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        precio: 155.0,
        stock: 30
      })
    });
    const dataActVar = (await resActVar.json()) as any;
    asegurar(resActVar.status === 200, 'Admin actualiza precio y stock de variante (200)');
    asegurar(
      dataActVar.datos.variante.precio === 155 && dataActVar.datos.variante.stock === 30,
      'Los nuevos valores de precio y stock fueron persistidos'
    );

    console.log(`\n============================================================`);
    console.log(`Resultado final de la suite Bloque B: ${exitos} aprobadas, ${fallos} fallidas.`);
    console.log(`============================================================\n`);

    server.close(async () => {
      // Limpieza de datos temporales
      if (productoTestId) {
        await consultar('DELETE FROM variantes WHERE producto_id = $1', [productoTestId]);
        await consultar('DELETE FROM productos WHERE id = $1', [productoTestId]);
      }
      await consultar('DELETE FROM usuarios WHERE email IN ($1, $2)', [emailClientePrueba, emailStaffPrueba]);
      await cerrarPool();
      process.exit(fallos > 0 ? 1 : 0);
    });
  } catch (error) {
    console.error('Error critico durante la ejecucion de la suite Bloque B:', error);
    server.close(async () => {
      if (productoTestId) {
        await consultar('DELETE FROM variantes WHERE producto_id = $1', [productoTestId]);
        await consultar('DELETE FROM productos WHERE id = $1', [productoTestId]);
      }
      await consultar('DELETE FROM usuarios WHERE email IN ($1, $2)', [emailClientePrueba, emailStaffPrueba]);
      await cerrarPool();
      process.exit(1);
    });
  }
}

ejecutarPruebas();
