/**
 * ============================================================================
 * NUBAGLOW APP - PUNTO DE ENTRADA DE LA SPA
 * ============================================================================
 * Registra las rutas publicas y del portal interno, carga el perfil desde el
 * backend y arranca el router. No hay rutas de empleados enlazadas desde la
 * tienda publica (CLAUDE.md Secciones 3 y 4).
 */

import { Router } from './router/router.js';
import { crearDiseno } from './layouts/index.js';
import {
  cargarPerfil,
  obtenerUsuario,
  EVENTO_SESION_EXPIRADA
} from './core/sesion.js';
import { accesoModulo, rutaInicioPorRol } from './core/permisos.js';

// Cada pantalla se carga con import() dinámico dentro del router (try/catch),
// así un error de sintaxis en una vista no rompe el resto de la aplicación.
const cargadoresVistas = {
  inicio: () => import('./vistas/publicas/inicio.js').then((m) => m.vistaInicio),
  catalogo: () =>
    import('./vistas/publicas/catalogo.js').then((m) => m.vistaCatalogo),
  producto: () =>
    import('./vistas/publicas/producto.js').then((m) => m.vistaProducto),
  pedidos: () =>
    import('./vistas/publicas/pedidos.js').then((m) => m.vistaPedidos),
  pedidoDetalle: () =>
    import('./vistas/publicas/pedidoDetalle.js').then((m) => m.vistaPedidoDetalle),
  carrito: () =>
    import('./vistas/publicas/carrito.js').then((m) => m.vistaCarrito),
  cuenta: () =>
    import('./vistas/publicas/cuenta.js').then((m) => m.vistaCuenta),
  login: () =>
    import('./vistas/publicas/login.js').then((m) => m.vistaLogin),
  checkout: () =>
    import('./vistas/publicas/checkout.js').then((m) => m.vistaCheckout),
  pagoPaypalRetorno: () =>
    import('./vistas/publicas/pagoPaypalRetorno.js').then(
      (m) => m.vistaPagoPaypalRetorno
    ),
  pagoPaypalSimulado: () =>
    import('./vistas/publicas/pagoPaypalSimulado.js').then(
      (m) => m.vistaPagoPaypalSimulado
    ),
  noEncontrada: () =>
    import('./vistas/publicas/noEncontrado.js').then((m) => m.vistaNoEncontrada),
  loginStaff: () =>
    import('./vistas/staff/login.js').then((m) => m.vistaLoginStaff),
  dashboard: () =>
    import('./vistas/staff/dashboard.js').then((m) => m.vistaDashboard),
  pos: () => import('./vistas/staff/pos.js').then((m) => m.vistaPos),
  operaciones: () =>
    import('./vistas/staff/operaciones.js').then((m) => m.vistaOperaciones),
  productos: () =>
    import('./vistas/staff/productos.js').then((m) => m.vistaProductos),
  usuarios: () =>
    import('./vistas/staff/usuarios.js').then((m) => m.vistaUsuarios),
  reportes: () =>
    import('./vistas/staff/reportes.js').then((m) => m.vistaReportes)
};

const contenedor = document.getElementById('app');

if (!contenedor) {
  throw new Error('No se encontró el contenedor #app en index.html');
}

const router = new Router(contenedor, {
  crearDiseno,
  obtenerUsuario
});

function accesoLoginCliente(usuario) {
  if (!usuario) return null;
  return usuario.rol === 'cliente' ? '/cuenta' : rutaInicioPorRol(usuario.rol);
}

function accesoLoginStaff(usuario) {
  if (!usuario) return null;
  return usuario.rol === 'cliente' ? null : rutaInicioPorRol(usuario.rol);
}

function accesoCuenta(usuario) {
  return usuario ? null : '/login?redirigir=/cuenta';
}

function accesoCarrito(usuario) {
  if (!usuario) return null;
  return usuario.rol === 'cliente' ? null : rutaInicioPorRol(usuario.rol);
}

function accesoPedidoCliente(usuario, { params } = {}) {
  const codigo = params && params.codigo ? params.codigo : '';
  const destino = codigo ? `/pedido/${codigo}` : '/cuenta';
  if (!usuario) return `/login?redirigir=${encodeURIComponent(destino)}`;
  return usuario.rol === 'cliente' ? null : rutaInicioPorRol(usuario.rol);
}

function accesoPagoPaypal(usuario, { consulta, ruta } = {}) {
  if (!usuario) {
    const query =
      consulta && typeof consulta.toString === 'function'
        ? consulta.toString()
        : '';
    const destino = query ? `${ruta}?${query}` : ruta;
    return `/login?redirigir=${encodeURIComponent(destino)}`;
  }
  return usuario.rol === 'cliente' ? null : rutaInicioPorRol(usuario.rol);
}

// Rutas publicas
router
  .registrar('/', cargadoresVistas.inicio, { titulo: 'Inicio' })
  .registrar('/catalogo', cargadoresVistas.catalogo, { titulo: 'Catálogo' })
  .registrar('/producto/:slug', cargadoresVistas.producto, {
    titulo: 'Producto'
  })
  .registrar('/pedidos', cargadoresVistas.pedidos, {
    titulo: 'Rastreo de pedidos'
  })
  .registrar('/pedido/:codigo', cargadoresVistas.pedidoDetalle, {
    titulo: 'Detalle del pedido',
    acceso: accesoPedidoCliente
  })
  .registrar('/carrito', cargadoresVistas.carrito, {
    titulo: 'Carrito',
    acceso: accesoCarrito
  })
  .registrar('/checkout', cargadoresVistas.checkout, {
    titulo: 'Finalizar compra'
  })
  .registrar('/pago/paypal/retorno', cargadoresVistas.pagoPaypalRetorno, {
    titulo: 'Pago con PayPal',
    acceso: accesoPagoPaypal
  })
  .registrar('/pago/paypal/simulado', cargadoresVistas.pagoPaypalSimulado, {
    titulo: 'Simulación de PayPal',
    acceso: accesoPagoPaypal
  })
  .registrar('/cuenta', cargadoresVistas.cuenta, {
    titulo: 'Mi cuenta',
    acceso: accesoCuenta
  })
  .registrar('/login', cargadoresVistas.login, {
    titulo: 'Iniciar sesión',
    acceso: accesoLoginCliente
  });

// Portal interno (acceso directo, sin enlaces desde la tienda publica)
router
  .registrar('/staff/login', cargadoresVistas.loginStaff, {
    titulo: 'Acceso del personal',
    diseno: 'auth',
    acceso: accesoLoginStaff
  })
  .registrar('/staff/dashboard', cargadoresVistas.dashboard, {
    titulo: 'Panel',
    diseno: 'staff',
    acceso: accesoModulo('/staff/dashboard')
  })
  .registrar('/staff/pos', cargadoresVistas.pos, {
    titulo: 'Punto de venta',
    diseno: 'staff',
    acceso: accesoModulo('/staff/pos')
  })
  .registrar('/staff/operaciones', cargadoresVistas.operaciones, {
    titulo: 'Operaciones',
    diseno: 'staff',
    acceso: accesoModulo('/staff/operaciones')
  })
  .registrar('/staff/productos', cargadoresVistas.productos, {
    titulo: 'Productos',
    diseno: 'staff',
    acceso: accesoModulo('/staff/productos')
  })
  .registrar('/staff/usuarios', cargadoresVistas.usuarios, {
    titulo: 'Usuarios',
    diseno: 'staff',
    acceso: accesoModulo('/staff/usuarios')
  })
  .registrar('/staff/reportes', cargadoresVistas.reportes, {
    titulo: 'Reportes',
    diseno: 'staff',
    acceso: accesoModulo('/staff/reportes')
  });

router.registrarNoEncontrada(cargadoresVistas.noEncontrada, {
  titulo: 'Página no encontrada'
});

window.addEventListener(EVENTO_SESION_EXPIRADA, () => {
  const rutaActual = window.location.pathname;
  if (rutaActual.startsWith('/staff') && rutaActual !== '/staff/login') {
    router.navegar('/staff/login', { reemplazar: true });
  }
});

async function iniciarAplicacion() {
  await cargarPerfil();
  await router.iniciar();
}

iniciarAplicacion();
