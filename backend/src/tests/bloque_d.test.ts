/**
 * ============================================================================
 * NUBAGLOW APP - SUITE DE PRUEBAS AUTOMATIZADAS: BLOQUE D
 * ============================================================================
 * Valida:
 * 1. Ventas POS (vendedor y admin): registro atomico, descuento de stock, correlativo de factura.
 * 2. Segregacion en POS: vendedor solo ve sus ventas, admin ve todas.
 * 3. Inventario y Kardex: alerta stock bajo, ingresos y ajustes, stock negativo IMPOSIBLE (400).
 * 4. Reportes (admin): resumen web vs pos, ingresos por dia, ranking de mas vendidos.
 * 5. Gestion de Staff (admin): crear usuarios, listar, activar/desactivar, restablecer password.
 * 6. Reglas de proteccion admin: no auto-desactivarse, no desactivar al ultimo admin.
 * 7. Pruebas negativas de permisos RBAC:
 *    - Peticiones sin token -> 401
 *    - Cliente a POS, inventario, reportes o usuarios -> 403
 *    - Vendedor a reportes o usuarios -> 403
 *    - Operaciones a gestion de usuarios o POS -> 403
 * 8. Verificacion de registros en tabla auditoria (login, usuarios, precios, stock, envios).
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../index';
import { consultar, cerrarPool } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_super_segura_nubaglow_2026';
process.env.JWT_SECRET = JWT_SECRET;

async function ejecutarPruebas() {
  console.log('Iniciando suite de pruebas automatizadas: Bloque D (Modulos Internos Staff y RBAC)...');

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

  // Tokens y usuarios de prueba
  let adminId: number;
  let vendedor1Id: number;
  let vendedor2Id: number;
  let operacionesId: number;
  let clienteId: number;

  let tokenAdmin: string;
  let tokenVendedor1: string;
  let tokenVendedor2: string;
  let tokenOperaciones: string;
  let tokenCliente: string;

  let productoTestId: number;
  let varianteTestId: number;

  let nuevoOpId: number | undefined;
  let userStaffAuditId: number | undefined;
  let envioAuditId: number | undefined;
  let pedidoAuditId: number | undefined;
  let adminsEstadoOriginal: { id: number; activo: boolean }[] = [];

  try {
    // ------------------------------------------------------------------------
    // SETUP DE DATOS TEMPORALES
    // ------------------------------------------------------------------------
    const resAdmin = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Admin Principal', $1, 'hash_test', 'admin', TRUE) RETURNING id`,
      [`admin_test_${sufijo}@nuba.bo`]
    );
    adminId = resAdmin.rows[0].id;

    const resV1 = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Vendedor Uno', $1, 'hash_test', 'vendedor', TRUE) RETURNING id`,
      [`vendedor1_${sufijo}@nuba.bo`]
    );
    vendedor1Id = resV1.rows[0].id;

    const resV2 = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Vendedor Dos', $1, 'hash_test', 'vendedor', TRUE) RETURNING id`,
      [`vendedor2_${sufijo}@nuba.bo`]
    );
    vendedor2Id = resV2.rows[0].id;

    const resOp = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Operador Logistica', $1, 'hash_test', 'operaciones', TRUE) RETURNING id`,
      [`operaciones_d_${sufijo}@nuba.bo`]
    );
    operacionesId = resOp.rows[0].id;

    const resCli = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Cliente Comun', $1, 'hash_test', 'cliente', TRUE) RETURNING id`,
      [`cliente_d_${sufijo}@nuba.bo`]
    );
    clienteId = resCli.rows[0].id;

    tokenAdmin = jwt.sign(
      { id: adminId, nombre: 'Admin Principal', email: `admin_test_${sufijo}@nuba.bo`, rol: 'admin', activo: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    tokenVendedor1 = jwt.sign(
      { id: vendedor1Id, nombre: 'Vendedor Uno', email: `vendedor1_${sufijo}@nuba.bo`, rol: 'vendedor', activo: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    tokenVendedor2 = jwt.sign(
      { id: vendedor2Id, nombre: 'Vendedor Dos', email: `vendedor2_${sufijo}@nuba.bo`, rol: 'vendedor', activo: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    tokenOperaciones = jwt.sign(
      { id: operacionesId, nombre: 'Operador Logistica', email: `operaciones_d_${sufijo}@nuba.bo`, rol: 'operaciones', activo: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    tokenCliente = jwt.sign(
      { id: clienteId, nombre: 'Cliente Comun', email: `cliente_d_${sufijo}@nuba.bo`, rol: 'cliente', activo: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Producto y variante de prueba
    const resCat = await consultar('SELECT id FROM categorias LIMIT 1');
    const catId = resCat.rows[0].id;

    const resP = await consultar(
      `INSERT INTO productos (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo)
       VALUES ($1, $2, $3, 'Nuba Test', 'Todo tipo', 'Desc test', 'Ing test', 'Modo test', TRUE) RETURNING id`,
      [catId, `Producto POS Test ${sufijo}`, `prod-pos-${sufijo}`]
    );
    productoTestId = resP.rows[0].id;

    const resV = await consultar(
      `INSERT INTO variantes (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Tono Claro Test', 80.00, 15, 5, TRUE) RETURNING id`,
      [productoTestId, `SKU-POS-${sufijo}`]
    );
    varianteTestId = resV.rows[0].id;

    // ------------------------------------------------------------------------
    // 1. PRUEBAS NEGATIVAS DE PERMISOS RBAC
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Pruebas Negativas de Permisos (401 y 403) ---');
    // Sin token -> 401
    const resSinToken = await fetch(`${baseUrl}/api/pos/historial`);
    asegurar(resSinToken.status === 401, 'Acceso sin token devuelve 401 No Autenticado');

    // Cliente intentando entrar a POS -> 403
    const resCliPos = await fetch(`${baseUrl}/api/pos/historial`, {
      headers: { Authorization: `Bearer ${tokenCliente}` }
    });
    asegurar(resCliPos.status === 403, 'Cliente intentando acceder a POS recibe 403 Prohibido');

    // Cliente intentando entrar a Inventario -> 403
    const resCliInv = await fetch(`${baseUrl}/api/inventario`, {
      headers: { Authorization: `Bearer ${tokenCliente}` }
    });
    asegurar(resCliInv.status === 403, 'Cliente intentando acceder a Inventario recibe 403 Prohibido');

    // Cliente intentando entrar a Reportes -> 403
    const resCliRep = await fetch(`${baseUrl}/api/reportes/web-vs-pos`, {
      headers: { Authorization: `Bearer ${tokenCliente}` }
    });
    asegurar(resCliRep.status === 403, 'Cliente intentando acceder a Reportes recibe 403 Prohibido');

    // Vendedor intentando acceder a Reportes -> 403
    const resVenRep = await fetch(`${baseUrl}/api/reportes/web-vs-pos`, {
      headers: { Authorization: `Bearer ${tokenVendedor1}` }
    });
    asegurar(resVenRep.status === 403, 'Vendedor intentando acceder a Reportes recibe 403 Prohibido');

    // Operaciones intentando acceder a Gestion de Usuarios -> 403
    const resOpUsers = await fetch(`${baseUrl}/api/usuarios`, {
      headers: { Authorization: `Bearer ${tokenOperaciones}` }
    });
    asegurar(resOpUsers.status === 403, 'Operaciones intentando acceder a Gestion de Usuarios recibe 403 Prohibido');

    // ------------------------------------------------------------------------
    // 2. VENTAS POS Y FACTURACION CORRELATIVA
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Ventas POS y Facturas ---');
    // Vendedor 1 realiza venta en efectivo
    const resVenta1 = await fetch(`${baseUrl}/api/pos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVendedor1}`
      },
      body: JSON.stringify({
        items: [{ variante_id: varianteTestId, cantidad: 2 }],
        metodo_pago: 'Efectivo',
        monto_recibido: 200.00,
        cliente_nombre: 'Comprador Mostrador',
        cliente_nit_ci: '1234567'
      })
    });
    const dataVenta1 = (await resVenta1.json()) as any;
    asegurar(resVenta1.status === 201, 'Venta POS registrada exitosamente (201 Creado)');
    asegurar(
      dataVenta1.datos.venta.total === 160.00 && dataVenta1.datos.venta.cambio === 40.00,
      'Total calculado en servidor (2 * 80.00 = 160.00 Bs) y cambio exacto (40.00 Bs)'
    );
    asegurar(
      dataVenta1.datos.venta.vendedorId === vendedor1Id,
      'vendedor_id asignado estrictamente desde el token del vendedor 1'
    );
    asegurar(
      dataVenta1.datos.venta.factura && dataVenta1.datos.venta.factura.numeroFactura.startsWith('FAC-POS-'),
      'Factura correlativa registrada en BD'
    );

    // Stock paso de 15 a 13
    const resStockPostVenta = await consultar('SELECT stock FROM variantes WHERE id = $1', [varianteTestId]);
    asegurar(resStockPostVenta.rows[0].stock === 13, 'Stock descontado en BD de 15 a 13');

    // Vendedor 2 realiza otra venta por QR Simple
    const resVenta2 = await fetch(`${baseUrl}/api/pos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVendedor2}`
      },
      body: JSON.stringify({
        items: [{ variante_id: varianteTestId, cantidad: 1 }],
        metodo_pago: 'QR Simple'
      })
    });
    asegurar(resVenta2.status === 201, 'Vendedor 2 registra venta POS por QR Simple (201)');

    // ------------------------------------------------------------------------
    // 3. SEGREGACION DE HISTORIAL POS Y CIERRE DE CAJA
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Segregacion de Historial POS y Cierre de Caja ---');
    // Vendedor 1 consulta historial: SOLO debe ver su propia venta
    const resHistV1 = await fetch(`${baseUrl}/api/pos/historial`, {
      headers: { Authorization: `Bearer ${tokenVendedor1}` }
    });
    const dataHistV1 = (await resHistV1.json()) as any;
    asegurar(resHistV1.status === 200, 'Vendedor 1 consulta su historial POS (200)');
    const todasPertenecenAV1 = dataHistV1.datos.ventas.every((v: any) => v.vendedorId === vendedor1Id);
    asegurar(todasPertenecenAV1, 'El vendedor 1 solo ve sus propias ventas registradas');

    // Admin consulta historial: ve las ventas de ambos vendedores
    const resHistAdmin = await fetch(`${baseUrl}/api/pos/historial`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const dataHistAdmin = (await resHistAdmin.json()) as any;
    asegurar(resHistAdmin.status === 200, 'Admin consulta historial global POS (200)');
    const tieneV1 = dataHistAdmin.datos.ventas.some((v: any) => v.vendedorId === vendedor1Id);
    const tieneV2 = dataHistAdmin.datos.ventas.some((v: any) => v.vendedorId === vendedor2Id);
    asegurar(tieneV1 && tieneV2, 'Admin tiene visibilidad de las ventas de todos los vendedores');

    // Cierre de caja diario
    const resCierre = await fetch(`${baseUrl}/api/pos/cierre-caja`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const dataCierre = (await resCierre.json()) as any;
    asegurar(resCierre.status === 200, 'Cierre de caja diario responde 200');
    asegurar(
      dataCierre.datos.cierre.totalRecaudado >= 240.00,
      'Cierre de caja acumula ventas en Efectivo y QR'
    );

    // ------------------------------------------------------------------------
    // 4. INVENTARIO, KARDEX Y STOCK NEGATIVO IMPOSIBLE
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Inventario, Kardex y Prevencion de Stock Negativo ---');
    // Listado de inventario
    const resInv = await fetch(`${baseUrl}/api/inventario`, {
      headers: { Authorization: `Bearer ${tokenOperaciones}` }
    });
    const dataInv = (await resInv.json()) as any;
    asegurar(resInv.status === 200, 'Operador lista inventario consolidado (200)');
    asegurar(Array.isArray(dataInv.datos.inventario), 'Inventario contiene lista de variantes con alertas');

    // Ingreso de mercaderia (+10 unidades)
    const resIngreso = await fetch(`${baseUrl}/api/inventario/ajustes/${varianteTestId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOperaciones}`
      },
      body: JSON.stringify({
        tipo: 'entrada',
        cantidad: 10,
        motivo: 'Llegada de lote de importacion Nuba Skin'
      })
    });
    const dataIngreso = (await resIngreso.json()) as any;
    asegurar(resIngreso.status === 200, 'Ingreso de mercaderia registrado en Kardex');
    asegurar(
      dataIngreso.datos.stockNuevo === 22,
      'Stock incrementado correctamente de 12 a 22'
    );

    // Intento de ajuste que provocaria stock negativo -> 400
    const resAjusteNegativo = await fetch(`${baseUrl}/api/inventario/ajustes/${varianteTestId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOperaciones}`
      },
      body: JSON.stringify({
        tipo: 'ajuste',
        cantidad: -50, // Intentar restar mas del stock existente
        motivo: 'Intento de merma excesiva'
      })
    });
    asegurar(
      resAjusteNegativo.status === 400,
      'Operacion rechazada con 400 al intentar provocar stock negativo'
    );

    // Consulta de Kardex por variante
    const resKardex = await fetch(`${baseUrl}/api/inventario/kardex/${varianteTestId}`, {
      headers: { Authorization: `Bearer ${tokenOperaciones}` }
    });
    const dataKardex = (await resKardex.json()) as any;
    asegurar(resKardex.status === 200, 'Consulta de Kardex por variante responde 200');
    asegurar(
      dataKardex.datos.movimientos.length >= 3,
      'El Kardex refleja ventas POS e ingreso de mercaderia con motivo y usuario responsable'
    );

    // Cola de despachos de operaciones
    const resDespachos = await fetch(`${baseUrl}/api/inventario/despachos`, {
      headers: { Authorization: `Bearer ${tokenOperaciones}` }
    });
    asegurar(resDespachos.status === 200, 'Cola de pedidos pendientes de despacho responde 200');

    // ------------------------------------------------------------------------
    // 5. REPORTES GERENCIALES (ADMIN)
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Reportes Gerenciales (Admin) ---');
    // Resumen Web vs POS
    const resWebVsPos = await fetch(`${baseUrl}/api/reportes/web-vs-pos`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const dataWebVsPos = (await resWebVsPos.json()) as any;
    asegurar(resWebVsPos.status === 200, 'Reporte Web vs POS responde 200');
    asegurar(
      dataWebVsPos.datos.granTotal > 0 && typeof dataWebVsPos.datos.web.porcentaje === 'number',
      'Reporte entrega totales y porcentajes comparativos'
    );

    // Ingresos diarios
    const resIngresos = await fetch(`${baseUrl}/api/reportes/ingresos-diarios`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    asegurar(resIngresos.status === 200, 'Reporte de ingresos diarios responde 200');

    // Ranking de productos mas vendidos
    const resRanking = await fetch(`${baseUrl}/api/reportes/ranking`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const dataRanking = (await resRanking.json()) as any;
    asegurar(resRanking.status === 200, 'Ranking de productos mas vendidos responde 200');
    asegurar(Array.isArray(dataRanking.datos.ranking), 'Ranking contiene lista ordenada por ventas');

    // ------------------------------------------------------------------------
    // 6. GESTION DE USUARIOS STAFF Y REGLAS DE PROTECCION
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Gestion de Usuarios Staff y Reglas de Proteccion ---');
    // Crear nuevo usuario de staff
    const emailNuevoOp = `nuevo_operador_${sufijo}@nuba.bo`;
    const resCrearOp = await fetch(`${baseUrl}/api/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        nombre: 'Nuevo Operador Almacen',
        email: emailNuevoOp,
        password: 'PasswordNuevo!2026',
        rol: 'operaciones'
      })
    });
    const dataCrearOp = (await resCrearOp.json()) as any;
    asegurar(resCrearOp.status === 201, 'Admin crea cuenta de operaciones (201)');
    const nuevoOpId = dataCrearOp.datos.usuario.id;

    // Listar staff
    const resListarStaff = await fetch(`${baseUrl}/api/usuarios`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const dataListarStaff = (await resListarStaff.json()) as any;
    asegurar(resListarStaff.status === 200, 'Admin lista usuarios de staff');
    asegurar(
      dataListarStaff.datos.usuarios.some((u: any) => u.id === nuevoOpId),
      'El nuevo usuario figura en la lista de staff'
    );

    // Desactivar usuario nuevo
    const resDesact = await fetch(`${baseUrl}/api/usuarios/${nuevoOpId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({ activo: false })
    });
    const dataDesact = (await resDesact.json()) as any;
    asegurar(resDesact.status === 200, 'Admin desactiva cuenta de staff (200)');
    asegurar(dataDesact.datos.usuario.activo === false, 'Estado de la cuenta cambio a inactivo');

    // Regla de proteccion: Admin NO puede auto-desactivarse -> 400
    const resAutoDesact = await fetch(`${baseUrl}/api/usuarios/${adminId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({ activo: false })
    });
    asegurar(
      resAutoDesact.status === 400,
      'Bloqueo con 400: un admin no puede auto-desactivar su propia cuenta'
    );

    // Regla de proteccion: No se puede revocar rol ni desactivar al ultimo admin activo en la BD
    // Guardamos el estado original exacto de todos los administradores existentes en la BD (sin correos fijos)
    const resAdminsPrevios = await consultar(
      "SELECT id, activo FROM usuarios WHERE rol = 'admin' AND id != $1",
      [adminId]
    );
    adminsEstadoOriginal = resAdminsPrevios.rows;

    // Dejamos temporalmente a adminId como el UNICO administrador activo en el sistema
    await consultar("UPDATE usuarios SET activo = FALSE WHERE rol = 'admin' AND id != $1", [adminId]);

    // Intentamos revocar el rol de admin al unico admin activo
    const resRevocarUltimoAdmin = await fetch(`${baseUrl}/api/usuarios/${adminId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({ rol: 'vendedor' })
    });
    const dataRevocarUltimoAdmin = (await resRevocarUltimoAdmin.json()) as any;
    asegurar(
      resRevocarUltimoAdmin.status === 400,
      'Rechazo con 400 al intentar revocar el rol al unico administrador activo'
    );
    asegurar(
      dataRevocarUltimoAdmin.error && dataRevocarUltimoAdmin.error.includes('unico administrador activo'),
      'Mensaje claro de proteccion del ultimo administrador'
    );

    // Verificamos directamente en BD que permanece con rol = 'admin' y activo = true
    const checkAdminDb = await consultar('SELECT rol, activo FROM usuarios WHERE id = $1', [adminId]);
    asegurar(
      checkAdminDb.rows[0].rol === 'admin' && checkAdminDb.rows[0].activo === true,
      'El unico administrador permanece activo y con rol admin en la BD'
    );

    // Restauramos de inmediato el estado original exacto de cada administrador existente
    for (const adm of adminsEstadoOriginal) {
      await consultar('UPDATE usuarios SET activo = $1 WHERE id = $2', [adm.activo, adm.id]);
    }

    // Restablecer contrasena
    const resResetPass = await fetch(`${baseUrl}/api/usuarios/${nuevoOpId}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({ nueva_password: 'NuevaPassword!2026' })
    });
    asegurar(resResetPass.status === 200, 'Admin restablece contrasena de staff exitosamente (200)');

    // ------------------------------------------------------------------------
    // 7. VERIFICACION DE REGISTROS DE AUDITORIA
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Verificacion de Auditoria en la Base de Datos ---');

    // 7.1. Verificacion de LOGIN_STAFF con llamada HTTP real
    const passwordStaffPlana = 'StaffPassword!2026';
    const passwordStaffHash = await bcrypt.hash(passwordStaffPlana, 12);
    const emailStaffLogin = `staff_login_${sufijo}@nubaglow.bo`;
    const resStaffUser = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ('Staff Auditoria', $1, $2, 'vendedor', TRUE) RETURNING id`,
      [emailStaffLogin, passwordStaffHash]
    );
    const userStaffAuditId = resStaffUser.rows[0].id;

    const resStaffLoginHttp = await fetch(`${baseUrl}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailStaffLogin, password: passwordStaffPlana })
    });
    asegurar(resStaffLoginHttp.status === 200, 'Login real de staff por HTTP responde 200');

    const resAuditLogin = await consultar(
      "SELECT accion, detalles FROM auditoria WHERE accion = 'LOGIN_STAFF' AND usuario_id = $1",
      [userStaffAuditId]
    );
    asegurar(resAuditLogin.rows.length > 0, 'Accion LOGIN_STAFF persistida en tabla auditoria');

    // 7.2. Verificacion de CAMBIO_PRECIO con precio anterior y nuevo
    const resCambioPrecioHttp = await fetch(`${baseUrl}/api/variantes/${varianteTestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({ precio: 95.00 })
    });
    asegurar(resCambioPrecioHttp.status === 200, 'Admin actualiza precio de variante a 95.00 Bs (200)');

    const resAuditPrecio = await consultar(
      "SELECT accion, detalles FROM auditoria WHERE accion = 'CAMBIO_PRECIO' AND registro_id = $1",
      [varianteTestId]
    );
    asegurar(resAuditPrecio.rows.length > 0, 'Accion CAMBIO_PRECIO persistida en tabla auditoria');
    const detallesPrecio = typeof resAuditPrecio.rows[0].detalles === 'string'
      ? JSON.parse(resAuditPrecio.rows[0].detalles)
      : resAuditPrecio.rows[0].detalles;
    asegurar(
      Number(detallesPrecio.precioAnterior) === 80 && Number(detallesPrecio.precioNuevo) === 95,
      'Auditoria CAMBIO_PRECIO contiene precioAnterior (80) y precioNuevo (95)'
    );

    // 7.3. Verificacion de CAMBIAR_ESTADO_ENVIO con estado anterior y nuevo
    const codigoRastreoTest = `NB-2026-${sufijo}`;
    const resPedidoAudit = await consultar(
      `INSERT INTO pedidos (usuario_id, codigo_rastreo, subtotal, costo_envio, total, estado, nombre_cliente, celular_cliente, correo_cliente, ciudad, direccion)
       VALUES ($1, $2, 95.00, 0.00, 95.00, 'Pendiente', 'Cliente Auditoria', '71234567', 'cli_aud@test.bo', 'Sucre', 'Calle Calvo 100')
       RETURNING id`,
      [clienteId, codigoRastreoTest]
    );
    const pedidoAuditId = resPedidoAudit.rows[0].id;

    const resEnvioAudit = await consultar(
      `INSERT INTO envios (pedido_id, codigo_rastreo, estado, transportista)
       VALUES ($1, $2, 'Pendiente', 'Nuba Express Sucre')
       RETURNING id`,
      [pedidoAuditId, codigoRastreoTest]
    );
    const envioAuditId = resEnvioAudit.rows[0].id;

    await consultar(
      `INSERT INTO envio_eventos (envio_id, estado, descripcion, usuario_id)
       VALUES ($1, 'Pendiente', 'Orden recibida en sistema', $2)`,
      [envioAuditId, adminId]
    );

    const resCambioEstadoHttp = await fetch(`${baseUrl}/api/envios/${envioAuditId}/estado`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOperaciones}`
      },
      body: JSON.stringify({
        estado: 'En preparación',
        descripcion: 'Empaque verificado para productos cosmeticos'
      })
    });
    asegurar(resCambioEstadoHttp.status === 200, 'Operador avanza estado de envio a En preparación (200)');

    const resAuditEnvio = await consultar(
      "SELECT accion, detalles FROM auditoria WHERE accion = 'CAMBIAR_ESTADO_ENVIO' AND registro_id = $1",
      [envioAuditId]
    );
    asegurar(resAuditEnvio.rows.length > 0, 'Accion CAMBIAR_ESTADO_ENVIO persistida en tabla auditoria');
    const detallesEnvio = typeof resAuditEnvio.rows[0].detalles === 'string'
      ? JSON.parse(resAuditEnvio.rows[0].detalles)
      : resAuditEnvio.rows[0].detalles;
    asegurar(
      detallesEnvio.estadoAnterior === 'Pendiente' && detallesEnvio.nuevoEstado === 'En preparación',
      'Auditoria CAMBIAR_ESTADO_ENVIO registra estadoAnterior (Pendiente) y nuevoEstado (En preparación)'
    );

    // 7.4. Verificacion de acciones generales de auditoria
    const resAudit = await consultar(
      `SELECT DISTINCT accion 
       FROM auditoria 
       WHERE usuario_id IN ($1, $2, $3, $4, $5)
       ORDER BY accion ASC`,
      [adminId, vendedor1Id, vendedor2Id, operacionesId, userStaffAuditId]
    );
    const accionesRegistradas = resAudit.rows.map((r) => r.accion);

    asegurar(
      accionesRegistradas.includes('VENTA_POS'),
      'Accion de auditoria registrada: VENTA_POS'
    );
    asegurar(
      accionesRegistradas.includes('AJUSTE_STOCK'),
      'Accion de auditoria registrada: AJUSTE_STOCK'
    );
    asegurar(
      accionesRegistradas.includes('CREAR_USUARIO'),
      'Accion de auditoria registrada: CREAR_USUARIO'
    );
    asegurar(
      accionesRegistradas.includes('EDITAR_USUARIO'),
      'Accion de auditoria registrada: EDITAR_USUARIO'
    );
    asegurar(
      accionesRegistradas.includes('RESTABLECER_PASSWORD'),
      'Accion de auditoria registrada: RESTABLECER_PASSWORD'
    );

    console.log(`\n============================================================`);
    console.log(`Resultado final de la suite Bloque D: ${exitos} aprobadas, ${fallos} fallidas.`);
    console.log(`============================================================\n`);

    server.close(async () => {
      await limpiarDatosPrueba(
        productoTestId,
        [adminId, vendedor1Id, vendedor2Id, operacionesId, clienteId, nuevoOpId, userStaffAuditId],
        envioAuditId,
        pedidoAuditId,
        adminsEstadoOriginal
      );
      await cerrarPool();
      process.exit(fallos > 0 ? 1 : 0);
    });
  } catch (error) {
    console.error('Error critico durante la ejecucion de la suite Bloque D:', error);
    server.close(async () => {
      await limpiarDatosPrueba(
        productoTestId,
        [adminId, vendedor1Id, vendedor2Id, operacionesId, clienteId, nuevoOpId, userStaffAuditId],
        envioAuditId,
        pedidoAuditId,
        adminsEstadoOriginal
      );
      await cerrarPool();
      process.exit(1);
    });
  }
}

async function limpiarDatosPrueba(
  prodId?: number,
  userIds?: (number | undefined)[],
  envioId?: number,
  pedId?: number,
  adminsRestaurar?: { id: number; activo: boolean }[]
) {
  try {
    if (envioId) {
      await consultar('DELETE FROM envio_eventos WHERE envio_id = $1', [envioId]);
      await consultar('DELETE FROM auditoria WHERE tabla_afectada = $1 AND registro_id = $2', ['envios', envioId]);
      await consultar('DELETE FROM envios WHERE id = $1', [envioId]);
    }
    if (pedId) {
      await consultar('DELETE FROM pedidos WHERE id = $1', [pedId]);
    }
    if (prodId) {
      const vars = await consultar('SELECT id FROM variantes WHERE producto_id = $1', [prodId]);
      const varIds = vars.rows.map((v) => v.id);
      if (varIds.length > 0) {
        await consultar('DELETE FROM auditoria WHERE tabla_afectada = $1 AND registro_id = ANY($2::int[])', ['variantes', varIds]);
        await consultar('DELETE FROM movimientos_inventario WHERE variante_id = ANY($1::int[])', [varIds]);
        await consultar('DELETE FROM variantes WHERE id = ANY($1::int[])', [varIds]);
      }
      await consultar('DELETE FROM productos WHERE id = $1', [prodId]);
    }

    if (userIds && userIds.length > 0) {
      const idsValidos = userIds.filter((id) => id !== undefined && id !== null);
      if (idsValidos.length > 0) {
        const ventas = await consultar('SELECT id FROM ventas_pos WHERE vendedor_id = ANY($1::int[])', [idsValidos]);
        const vIds = ventas.rows.map((v) => v.id);
        if (vIds.length > 0) {
          await consultar('DELETE FROM facturas WHERE venta_pos_id = ANY($1::int[])', [vIds]);
          await consultar('DELETE FROM ventas_pos WHERE id = ANY($1::int[])', [vIds]);
        }
        await consultar('DELETE FROM movimientos_inventario WHERE usuario_id = ANY($1::int[])', [idsValidos]);
        await consultar('DELETE FROM auditoria WHERE usuario_id = ANY($1::int[])', [idsValidos]);
        await consultar('DELETE FROM usuarios WHERE id = ANY($1::int[])', [idsValidos]);
      }
    }

    // Restaurar estado exacto de administradores preexistentes sin asumir correos fijos
    if (adminsRestaurar && adminsRestaurar.length > 0) {
      for (const adm of adminsRestaurar) {
        await consultar('UPDATE usuarios SET activo = $1 WHERE id = $2', [adm.activo, adm.id]);
      }
    }
  } catch (err) {
    console.error('Nota: error menor durante la limpieza de datos de prueba:', err);
  }
}

ejecutarPruebas();
