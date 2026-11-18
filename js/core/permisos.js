/**
 * ============================================================================
 * NUBAGLOW APP - MAPA DE PERMISOS DEL PORTAL INTERNO
 * ============================================================================
 * Fuente unica para el sidebar y las guardas de ruta del frontend.
 * IMPORTANTE: esto es solo UX. El backend valida siempre el rol con
 * verificarToken + requerirRol en cada endpoint (CLAUDE.md Seccion 3).
 */

export const MODULOS_STAFF = [
  {
    ruta: '/staff/dashboard',
    etiqueta: 'Panel',
    descripcion: 'Resumen general y accesos rapidos',
    icono: 'panel',
    roles: ['admin']
  },
  {
    ruta: '/staff/pos',
    etiqueta: 'Punto de venta',
    descripcion: 'Ventas presenciales y recibos',
    icono: 'pos',
    roles: ['vendedor', 'admin']
  },
  {
    ruta: '/staff/operaciones',
    etiqueta: 'Operaciones',
    descripcion: 'Inventario, despachos y envios',
    icono: 'operaciones',
    roles: ['operaciones', 'admin']
  },
  {
    ruta: '/staff/productos',
    etiqueta: 'Productos',
    descripcion: 'Catalogo, variantes y precios',
    icono: 'productos',
    roles: ['admin']
  },
  {
    ruta: '/staff/usuarios',
    etiqueta: 'Usuarios',
    descripcion: 'Cuentas del personal interno',
    icono: 'usuarios',
    roles: ['admin']
  },
  {
    ruta: '/staff/reportes',
    etiqueta: 'Reportes',
    descripcion: 'Ventas web, POS y ranking',
    icono: 'reportes',
    roles: ['admin']
  }
];

export const RUTA_INICIO_POR_ROL = {
  vendedor: '/staff/pos',
  operaciones: '/staff/operaciones',
  admin: '/staff/dashboard',
  cliente: '/'
};

export const ETIQUETA_ROL = {
  cliente: 'Cliente',
  vendedor: 'Vendedor',
  operaciones: 'Operaciones',
  admin: 'Administrador'
};

export function rutaInicioPorRol(rol) {
  return RUTA_INICIO_POR_ROL[rol] || '/';
}

export function esRolStaff(rol) {
  return Boolean(rol) && rol !== 'cliente';
}

export function modulosPermitidos(rol) {
  return MODULOS_STAFF.filter((modulo) => modulo.roles.includes(rol));
}

export function puedeAccederModulo(rol, ruta) {
  const modulo = MODULOS_STAFF.find((item) => item.ruta === ruta);
  return Boolean(modulo && modulo.roles.includes(rol));
}

/**
 * Guarda de ruta para el portal interno. Devuelve la ruta a la que se debe
 * redirigir, o null si el acceso es valido.
 */
export function accesoModulo(rutaModulo) {
  return (usuario) => {
    if (!usuario) return '/staff/login';
    if (!esRolStaff(usuario.rol)) return '/';
    if (!puedeAccederModulo(usuario.rol, rutaModulo)) return rutaInicioPorRol(usuario.rol);
    return null;
  };
}
