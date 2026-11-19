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

import { vistaInicio } from './vistas/publicas/inicio.js';
import { vistaCatalogo } from './vistas/publicas/catalogo.js';
import { vistaProducto } from './vistas/publicas/producto.js';
import { vistaPedidos } from './vistas/publicas/pedidos.js';
import { vistaCarrito } from './vistas/publicas/carrito.js';
import { vistaCuenta } from './vistas/publicas/cuenta.js';
import { vistaLogin } from './vistas/publicas/login.js';
import { vistaNoEncontrada } from './vistas/publicas/noEncontrado.js';

import { vistaLoginStaff } from './vistas/staff/login.js';
import { vistaDashboard } from './vistas/staff/dashboard.js';
import { vistaPos } from './vistas/staff/pos.js';
import { vistaOperaciones } from './vistas/staff/operaciones.js';
import { vistaProductos } from './vistas/staff/productos.js';
import { vistaUsuarios } from './vistas/staff/usuarios.js';
import { vistaReportes } from './vistas/staff/reportes.js';

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

// Rutas publicas
router
  .registrar('/', vistaInicio, { titulo: 'Inicio' })
  .registrar('/catalogo', vistaCatalogo, { titulo: 'Catálogo' })
  .registrar('/producto/:slug', vistaProducto, { titulo: 'Producto' })
  .registrar('/pedidos', vistaPedidos, { titulo: 'Rastreo de pedidos' })
  .registrar('/carrito', vistaCarrito, { titulo: 'Carrito', acceso: accesoCarrito })
  .registrar('/cuenta', vistaCuenta, { titulo: 'Mi cuenta', acceso: accesoCuenta })
  .registrar('/login', vistaLogin, { titulo: 'Iniciar sesión', acceso: accesoLoginCliente });

// Portal interno (acceso directo, sin enlaces desde la tienda publica)
router
  .registrar('/staff/login', vistaLoginStaff, {
    titulo: 'Acceso del personal',
    diseno: 'auth',
    acceso: accesoLoginStaff
  })
  .registrar('/staff/dashboard', vistaDashboard, {
    titulo: 'Panel',
    diseno: 'staff',
    acceso: accesoModulo('/staff/dashboard')
  })
  .registrar('/staff/pos', vistaPos, {
    titulo: 'Punto de venta',
    diseno: 'staff',
    acceso: accesoModulo('/staff/pos')
  })
  .registrar('/staff/operaciones', vistaOperaciones, {
    titulo: 'Operaciones',
    diseno: 'staff',
    acceso: accesoModulo('/staff/operaciones')
  })
  .registrar('/staff/productos', vistaProductos, {
    titulo: 'Productos',
    diseno: 'staff',
    acceso: accesoModulo('/staff/productos')
  })
  .registrar('/staff/usuarios', vistaUsuarios, {
    titulo: 'Usuarios',
    diseno: 'staff',
    acceso: accesoModulo('/staff/usuarios')
  })
  .registrar('/staff/reportes', vistaReportes, {
    titulo: 'Reportes',
    diseno: 'staff',
    acceso: accesoModulo('/staff/reportes')
  });

router.registrarNoEncontrada(vistaNoEncontrada, { titulo: 'Página no encontrada' });

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
