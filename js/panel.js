/**
 * NUBAGLOW APP - JS DEL PANEL DE ADMINISTRACIÓN DE USUARIOS (CRUD + RBAC)
 * Permite listar, crear, editar y eliminar usuarios.
 * Sincroniza con el backend Express si está activo, o con localStorage en modo demo.
 */

// Lista de usuarios en memoria (se inicia con demo si no hay datos)
let usuarios = [];
let editandoId = null;

// Clave para guardar en almacenamiento local en caso de estar offline
const STORAGE_KEY_USUARIOS = "nubaglow_usuarios_db";

function inicializarUsuariosDemo() {
  const guardados = localStorage.getItem(STORAGE_KEY_USUARIOS);
  if (guardados) {
    try {
      return JSON.parse(guardados);
    } catch (e) {}
  }
  return [
    { id: 1, nombre: "Administradora Nuba", email: "admin@nuba.bo", rol: "administrador", creadoEn: "2026-03-01 10:00" },
    { id: 2, nombre: "Valeria Vendedora", email: "vendedor@nuba.bo", rol: "vendedor", creadoEn: "2026-03-02 11:30" },
    { id: 3, nombre: "Carlos Almacén", email: "almacen@nuba.bo", rol: "almacen", creadoEn: "2026-03-03 09:15" },
    { id: 4, nombre: "Lucía Logística", email: "logistica@nuba.bo", rol: "logistica", creadoEn: "2026-03-04 14:00" },
    { id: 5, nombre: "Camila Cliente", email: "cliente@nuba.bo", rol: "cliente", creadoEn: "2026-03-05 16:45" }
  ];
}

async function cargarUsuarios() {
  const sesion = obtenerSesion();
  const token = sesion ? sesion.token : "";

  // Intentar cargar desde backend
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const respuesta = await fetch(`${API_URL}/usuarios`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (respuesta.ok) {
      const datos = await respuesta.json();
      usuarios = datos.usuarios;
      renderizarTabla();
      actualizarMetricas();
      return;
    }
  } catch (error) {
    console.warn("Backend no disponible. Cargando usuarios locales.");
  }

  // Fallback local
  usuarios = inicializarUsuariosDemo();
  renderizarTabla();
  actualizarMetricas();
}

function guardarUsuariosLocal() {
  localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(usuarios));
}

function renderizarTabla(filtroTexto = "", filtroRol = "todos") {
  const tbody = document.getElementById("usuarios-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtrados = usuarios.filter(u => {
    const coincideTexto = u.nombre.toLowerCase().includes(filtroTexto.toLowerCase()) || 
                          u.email.toLowerCase().includes(filtroTexto.toLowerCase());
    const coincideRol = filtroRol === "todos" || u.rol === filtroRol;
    return coincideTexto && coincideRol;
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-neutral-400">
          No se encontraron usuarios que coincidan con la búsqueda.
        </td>
      </tr>
    `;
    return;
  }

  filtrados.forEach(u => {
    const rolClase = {
      administrador: "badge-rol-admin",
      vendedor: "badge-rol-vendedor",
      almacen: "badge-rol-almacen",
      logistica: "badge-rol-logistica",
      cliente: "badge-rol-cliente"
    }[u.rol] || "badge-gold";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-rose-50/40 transition-colors";
    tr.innerHTML = `
      <td class="font-mono text-xs font-bold text-neutral-500">#${u.id}</td>
      <td class="font-semibold text-neutral-900">${u.nombre}</td>
      <td class="text-neutral-600">${u.email}</td>
      <td>
        <span class="text-xs px-2.5 py-1 rounded-full font-bold ${rolClase}">
          ${NOMBRES_ROLES[u.rol] || u.rol}
        </span>
      </td>
      <td class="text-xs text-neutral-400">${u.creadoEn || 'Reciente'}</td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-2">
          <button onclick="abrirModalEditar(${u.id})" class="text-xs font-bold text-[#8F3E43] hover:underline px-2 py-1 rounded-lg hover:bg-rose-100">
            Editar
          </button>
          <button onclick="eliminarUsuario(${u.id})" class="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50">
            Eliminar
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function actualizarMetricas() {
  const totalEl = document.getElementById("metric-total");
  const adminEl = document.getElementById("metric-admin");
  const staffEl = document.getElementById("metric-staff");
  const clientesEl = document.getElementById("metric-clientes");

  if (totalEl) totalEl.textContent = usuarios.length;
  if (adminEl) adminEl.textContent = usuarios.filter(u => u.rol === 'administrador').length;
  if (staffEl) staffEl.textContent = usuarios.filter(u => ['vendedor', 'almacen', 'logistica'].includes(u.rol)).length;
  if (clientesEl) clientesEl.textContent = usuarios.filter(u => u.rol === 'cliente').length;
}

function abrirModalCrear() {
  editandoId = null;
  document.getElementById("modal-titulo").textContent = "Nuevo Usuario del Sistema";
  document.getElementById("form-usuario").reset();
  document.getElementById("password-container").classList.remove("hidden");
  document.getElementById("modal-usuario").classList.remove("hidden");
}

function abrirModalEditar(id) {
  const usuario = usuarios.find(u => u.id === id);
  if (!usuario) return;

  editandoId = id;
  document.getElementById("modal-titulo").textContent = "Editar Usuario #" + id;
  document.getElementById("input-nombre").value = usuario.nombre;
  document.getElementById("input-email").value = usuario.email;
  document.getElementById("input-rol").value = usuario.rol;
  // Al editar, la contraseña no es obligatoria
  document.getElementById("password-container").classList.add("hidden");
  document.getElementById("modal-usuario").classList.remove("hidden");
}

function cerrarModal() {
  document.getElementById("modal-usuario").classList.add("hidden");
}

async function guardarUsuario(e) {
  e.preventDefault();
  const nombre = document.getElementById("input-nombre").value;
  const email = document.getElementById("input-email").value;
  const rol = document.getElementById("input-rol").value;
  const password = document.getElementById("input-password").value;

  const sesion = obtenerSesion();
  const token = sesion ? sesion.token : "";

  // Intentar guardar en backend
  try {
    if (editandoId) {
      await fetch(`${API_URL}/usuarios/${editandoId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nombre, email, rol })
      });
    } else {
      await fetch(`${API_URL}/usuarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nombre, email, password: password || "123456", rol })
      });
    }
  } catch (err) {
    console.warn("Guardando cambio localmente");
  }

  // Actualizar también array local
  if (editandoId) {
    const idx = usuarios.findIndex(u => u.id === editandoId);
    if (idx !== -1) {
      usuarios[idx].nombre = nombre;
      usuarios[idx].email = email;
      usuarios[idx].rol = rol;
    }
  } else {
    const nuevoId = usuarios.length > 0 ? Math.max(...usuarios.map(u => u.id)) + 1 : 1;
    usuarios.unshift({
      id: nuevoId,
      nombre,
      email,
      rol,
      creadoEn: "Hoy"
    });
  }

  guardarUsuariosLocal();
  cerrarModal();
  renderizarTabla();
  actualizarMetricas();
}

async function eliminarUsuario(id) {
  if (id === 1) {
    alert("No se puede eliminar la cuenta principal de Administrador.");
    return;
  }

  if (!confirm("¿Estás seguro de que deseas eliminar este usuario?")) return;

  const sesion = obtenerSesion();
  const token = sesion ? sesion.token : "";

  try {
    await fetch(`${API_URL}/usuarios/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err) {
    console.warn("Eliminando localmente");
  }

  usuarios = usuarios.filter(u => u.id !== id);
  guardarUsuariosLocal();
  renderizarTabla();
  actualizarMetricas();
}

document.addEventListener("DOMContentLoaded", () => {
  // Proteger ruta para rol administrador
  const usuario = protegerRuta(["administrador"]);
  if (!usuario) return;

  cargarUsuarios();

  const searchInput = document.getElementById("search-input");
  const rolFilter = document.getElementById("rol-filter");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderizarTabla(e.target.value, rolFilter.value);
    });
  }

  if (rolFilter) {
    rolFilter.addEventListener("change", (e) => {
      renderizarTabla(searchInput.value, e.target.value);
    });
  }

  const formUsuario = document.getElementById("form-usuario");
  if (formUsuario) {
    formUsuario.addEventListener("submit", guardarUsuario);
  }
});
