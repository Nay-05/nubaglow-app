/**
 * NUBAGLOW APP - MÓDULO DE AUTENTICACIÓN Y SEGURIDAD (RBAC)
 * Control de acceso por roles: Administrador, Vendedor, Almacén, Logística y Cliente.
 * Conexión dual: Servidor Express + SQLite o Modo Demo local sin servidor.
 */

const API_URL = "http://localhost:4000";

// Nombres legibles para cada rol
const NOMBRES_ROLES = {
  administrador: "Administradora",
  vendedor: "Vendedor/a",
  almacen: "Gestor/a de Almacén",
  logistica: "Encargado/a de Logística",
  cliente: "Cliente Glow"
};

// Rutas a las que entra cada rol tras iniciar sesión
const RUTA_POR_ROL = {
  administrador: "panel.html",
  vendedor: "pos.html",
  almacen: "inventario.html",
  logistica: "envios.html",
  cliente: "index.html#catalogo"
};

// Usuarios de prueba precargados (modo demostración)
const USUARIOS_DEMO = [
  {
    id: 1,
    nombre: "Administradora Nuba",
    email: "admin@nuba.bo",
    password: "admin1234",
    rol: "administrador"
  },
  {
    id: 2,
    nombre: "Valeria Vendedora",
    email: "vendedor@nuba.bo",
    password: "vendedor1234",
    rol: "vendedor"
  },
  {
    id: 3,
    nombre: "Carlos Almacén",
    email: "almacen@nuba.bo",
    password: "almacen1234",
    rol: "almacen"
  },
  {
    id: 4,
    nombre: "Lucía Logística",
    email: "logistica@nuba.bo",
    password: "logistica1234",
    rol: "logistica"
  },
  {
    id: 5,
    nombre: "Camila Cliente",
    email: "cliente@nuba.bo",
    password: "cliente1234",
    rol: "cliente"
  }
];

/**
 * Obtiene la sesión actual almacenada en el navegador
 */
function obtenerSesion() {
  try {
    const token = localStorage.getItem("nuba_token");
    const usuarioTexto = localStorage.getItem("nuba_usuario");
    if (!token || !usuarioTexto) return null;
    return { token, usuario: JSON.parse(usuarioTexto) };
  } catch (e) {
    return null;
  }
}

/**
 * Guarda el token y los datos del usuario en localStorage
 */
function guardarSesion(token, usuario) {
  localStorage.setItem("nuba_token", token);
  localStorage.setItem("nuba_usuario", JSON.stringify(usuario));
}

/**
 * Cierra la sesión activa y redirige al inicio
 */
function cerrarSesion() {
  localStorage.removeItem("nuba_token");
  localStorage.removeItem("nuba_usuario");
  window.location.href = "login.html";
}

/**
 * Inicia sesión intentando conectar con el backend Express.
 * Si el backend no está corriendo, usa el modo demo local.
 */
async function iniciarSesion(email, password) {
  // 1. Intentar autenticar contra el backend real (Express + SQLite)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 segundos máximo

    const respuesta = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const datos = await respuesta.json();
    if (!respuesta.ok) {
      throw new Error(datos.error || "Credenciales incorrectas");
    }

    // Sesión exitosa por backend real
    guardarSesion(datos.token, datos.usuario);
    return { usuario: datos.usuario, modo: "backend" };
  } catch (error) {
    // Si el error fue explícito de credenciales del servidor, lo mostramos
    if (error.message === "Credenciales incorrectas") {
      throw error;
    }

    // 2. Si el servidor no está corriendo, activar Modo Demo local
    console.warn("Backend no detectado o fuera de línea. Usando verificación local demo.");
    const usuarioEncontrado = USUARIOS_DEMO.find(
      u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
    );

    if (usuarioEncontrado) {
      const sesionDemo = {
        id: usuarioEncontrado.id,
        nombre: usuarioEncontrado.nombre,
        email: usuarioEncontrado.email,
        rol: usuarioEncontrado.rol
      };
      guardarSesion("token-demo-" + usuarioEncontrado.rol, sesionDemo);
      return { usuario: sesionDemo, modo: "demo" };
    }

    throw new Error("Credenciales incorrectas. Prueba con admin@nuba.bo / admin1234");
  }
}

/**
 * Protege una página asegurando que solo usuarios con roles permitidos puedan entrar
 */
function protegerRuta(rolesPermitidos) {
  const sesion = obtenerSesion();
  if (!sesion) {
    window.location.href = "login.html";
    return null;
  }
  if (rolesPermitidos && !rolesPermitidos.includes(sesion.usuario.rol)) {
    alert("No tienes permiso para acceder a esta sección con tu rol actual (" + (NOMBRES_ROLES[sesion.usuario.rol] || sesion.usuario.rol) + ").");
    window.location.href = RUTA_POR_ROL[sesion.usuario.rol] || "index.html";
    return null;
  }
  return sesion.usuario;
}

/**
 * Renderiza dinámicamente el botón de usuario/login en la barra de navegación
 */
function actualizarBarraNavegacion() {
  const contenedorAuth = document.getElementById("auth-header-container");
  if (!contenedorAuth) return;

  const sesion = obtenerSesion();

  if (sesion && sesion.usuario) {
    const u = sesion.usuario;
    const rolNombre = NOMBRES_ROLES[u.rol] || u.rol;
    
    // Enlaces adicionales según rol
    let enlacesExtras = "";
    if (u.rol === "administrador") {
      enlacesExtras = `
        <a href="panel.html" class="text-xs font-semibold text-[#8F3E43] hover:underline">Panel Admin</a>
        <a href="pos.html" class="text-xs font-semibold text-neutral-600 hover:text-[#8F3E43]">POS</a>
        <a href="inventario.html" class="text-xs font-semibold text-neutral-600 hover:text-[#8F3E43]">Stock</a>
        <a href="envios.html" class="text-xs font-semibold text-neutral-600 hover:text-[#8F3E43]">Envíos</a>
      `;
    } else if (u.rol === "vendedor") {
      enlacesExtras = `<a href="pos.html" class="text-xs font-semibold text-[#8F3E43] hover:underline">Ir a POS</a>`;
    } else if (u.rol === "almacen") {
      enlacesExtras = `<a href="inventario.html" class="text-xs font-semibold text-[#8F3E43] hover:underline">Inventario</a>`;
    } else if (u.rol === "logistica") {
      enlacesExtras = `<a href="envios.html" class="text-xs font-semibold text-[#8F3E43] hover:underline">Envíos</a>`;
    }

    contenedorAuth.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="hidden xl:flex items-center gap-2.5 px-3 py-1 bg-white/80 rounded-full border border-rose-200 shadow-sm">
          ${enlacesExtras}
        </div>
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white border border-rose-200 shadow-sm">
          <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-[#E8A5A5] to-[#E6C387] flex items-center justify-center text-xs text-white font-bold">
            ${u.nombre.charAt(0).toUpperCase()}
          </div>
          <div class="text-left">
            <span class="block text-xs font-bold text-neutral-800 leading-tight">${u.nombre}</span>
            <span class="block text-[10px] text-[#C97A7E] font-semibold">${rolNombre}</span>
          </div>
        </div>
        <button onclick="cerrarSesion()" class="text-xs text-neutral-500 hover:text-[#8F3E43] font-semibold p-1.5" title="Cerrar sesión">
          Salir ↗
        </button>
      </div>
    `;
  } else {
    // Si no está logueado, botón para entrar
    contenedorAuth.innerHTML = `
      <a href="login.html" class="btn-secondary-glow text-xs sm:text-sm px-4 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-sm">
        <svg class="w-4 h-4 text-[#C97A7E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
        </svg>
        <span>Iniciar Sesión</span>
      </a>
    `;
  }
}

// Ejecutar automáticamente al cargar
document.addEventListener("DOMContentLoaded", actualizarBarraNavegacion);
