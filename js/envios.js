/**
 * NUBAGLOW APP - JS DE GESTIÓN LOGÍSTICA Y DESPACHOS
 * Trazabilidad en 4 fases: Pendiente -> En preparación -> En tránsito -> Entregado.
 * Para Encargados de Logística y Administradores.
 */

const ETAPAS_ENVIO = ["Pendiente", "En preparación", "En tránsito", "Entregado"];
const STORAGE_KEY_ENVIOS = "nubaglow_envios_db";

let pedidosEnvio = [
  {
    id: "NG-SUC-8924",
    cliente: "Camila Morales",
    telefono: "71234567",
    ciudad: "Sucre (Chuquisaca)",
    direccion: "Calle Calvo #340, Zona Central",
    productos: "Serum Glow Vitamina C, Gel Limpiador",
    total: 240,
    fecha: "Hoy, 10:30 AM",
    etapa: "En tránsito"
  },
  {
    id: "NG-LPZ-5011",
    cliente: "Mariana Rojas",
    telefono: "78912345",
    ciudad: "La Paz (Sopocachi)",
    direccion: "Av. Sánchez Lima #2120",
    productos: "Crema Ceramide Barrier, Protector Solar SPF 50",
    total: 250,
    fecha: "Hoy, 09:15 AM",
    etapa: "En preparación"
  },
  {
    id: "NG-SCZ-3329",
    cliente: "Fabiana Justiniano",
    telefono: "70098765",
    ciudad: "Santa Cruz (Equipetrol)",
    direccion: "Condominio La Casona, Dpto 4B",
    productos: "Paleta Sunset Rosé, Base Glow Ligera",
    total: 305,
    fecha: "Ayer, 16:40 PM",
    etapa: "Entregado"
  },
  {
    id: "NG-CBB-1240",
    cliente: "Alejandro Torrez",
    telefono: "75543210",
    ciudad: "Cochabamba (Cala Cala)",
    direccion: "Calle Tarija #512",
    productos: "Serum Glow Vitamina C",
    total: 145,
    fecha: "Hoy, 11:00 AM",
    etapa: "Pendiente"
  }
];

function cargarEnvios() {
  const guardado = localStorage.getItem(STORAGE_KEY_ENVIOS);
  if (guardado) {
    try {
      pedidosEnvio = JSON.parse(guardado);
    } catch (e) {}
  }
  renderizarEnvios();
}

function guardarEnvios() {
  localStorage.setItem(STORAGE_KEY_ENVIOS, JSON.stringify(pedidosEnvio));
}

function renderizarEnvios(filtroTexto = "", filtroEtapa = "todas") {
  const contenedor = document.getElementById("envios-cards-container");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  const filtrados = pedidosEnvio.filter(p => {
    const coincideTexto = p.id.toLowerCase().includes(filtroTexto.toLowerCase()) || 
                          p.cliente.toLowerCase().includes(filtroTexto.toLowerCase()) ||
                          p.ciudad.toLowerCase().includes(filtroTexto.toLowerCase());
    const coincideEtapa = filtroEtapa === "todas" || p.etapa === filtroEtapa;
    return coincideTexto && coincideEtapa;
  });

  if (filtrados.length === 0) {
    contenedor.innerHTML = `
      <div class="glass-panel p-10 text-center rounded-3xl text-neutral-400">
        No hay despachos que coincidan con la búsqueda.
      </div>
    `;
    return;
  }

  filtrados.forEach(pedido => {
    const indiceActual = ETAPAS_ENVIO.indexOf(pedido.etapa);

    // Renderizar los 4 pasos del stepper con colores NubaGlow
    let stepperHTML = "";
    ETAPAS_ENVIO.forEach((etapa, idx) => {
      const completado = idx <= indiceActual;
      const esActual = idx === indiceActual;
      
      const circuloClase = completado 
        ? "bg-gradient-to-tr from-[#E8A5A5] to-[#8F3E43] text-white shadow-sm" 
        : "bg-white border-2 border-neutral-200 text-neutral-400";
      
      const textoClase = esActual 
        ? "text-[#8F3E43] font-black" 
        : (completado ? "text-neutral-800 font-semibold" : "text-neutral-400 font-medium");

      const barraProgreso = idx < ETAPAS_ENVIO.length - 1
        ? `<div class="flex-1 h-1 mx-2 rounded-full ${idx < indiceActual ? 'bg-[#E8A5A5]' : 'bg-neutral-200'}"></div>`
        : "";

      stepperHTML += `
        <div class="flex items-center ${idx < ETAPAS_ENVIO.length - 1 ? 'flex-1' : ''}">
          <div class="flex flex-col items-center">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${circuloClase}">
              ${completado ? "✓" : (idx + 1)}
            </div>
            <span class="text-[11px] mt-1.5 whitespace-nowrap text-center ${textoClase}">${etapa}</span>
          </div>
          ${barraProgreso}
        </div>
      `;
    });

    const card = document.createElement("div");
    card.className = "glass-panel p-6 rounded-3xl border border-rose-100 shadow-sm hover:shadow-md transition-all";
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-rose-100/70 gap-2 mb-5">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm font-extrabold text-[#8F3E43] bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
              ${pedido.id}
            </span>
            <span class="text-xs font-bold text-neutral-800">${pedido.cliente}</span>
            <span class="text-xs text-neutral-400 font-mono">(${pedido.telefono})</span>
          </div>
          <p class="text-xs text-neutral-500 mt-1">
            📍 Destino: <strong>${pedido.ciudad}</strong> • ${pedido.direccion}
          </p>
        </div>

        <!-- Selector para que el encargado de logística cambie de estado -->
        <div class="flex items-center gap-2">
          <label class="text-[11px] font-bold text-neutral-500 uppercase">Avanzar Estado:</label>
          <select onchange="actualizarEtapa('${pedido.id}', this.value)" class="input-glow text-xs py-1.5 px-3 bg-white font-bold text-[#8F3E43]">
            ${ETAPAS_ENVIO.map(e => `
              <option value="${e}" ${e === pedido.etapa ? 'selected' : ''}>${e}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Stepper Visual -->
      <div class="py-2 px-2 sm:px-6">
        <div class="flex items-center justify-between">
          ${stepperHTML}
        </div>
      </div>

      <!-- Resumen inferior -->
      <div class="mt-6 pt-4 border-t border-rose-100/60 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-neutral-600 gap-2">
        <div>
          <span>Paquete: <strong>${pedido.productos}</strong></span>
        </div>
        <div class="flex items-center gap-4">
          <span>Fecha: <strong>${pedido.fecha}</strong></span>
          <span class="text-sm font-black text-neutral-900">Total: Bs. ${pedido.total}</span>
        </div>
      </div>
    `;

    contenedor.appendChild(card);
  });
}

function actualizarEtapa(id, nuevaEtapa) {
  const pedido = pedidosEnvio.find(p => p.id === id);
  if (!pedido) return;

  pedido.etapa = nuevaEtapa;
  guardarEnvios();
  renderizarEnvios(
    document.getElementById("search-envios")?.value || "",
    document.getElementById("filter-etapa-envio")?.value || "todas"
  );
}

document.addEventListener("DOMContentLoaded", () => {
  // Proteger ruta para roles logistica y administrador
  const usuario = protegerRuta(["logistica", "administrador"]);
  if (!usuario) return;

  cargarEnvios();

  const searchInput = document.getElementById("search-envios");
  const filterEtapa = document.getElementById("filter-etapa-envio");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderizarEnvios(e.target.value, filterEtapa.value);
    });
  }

  if (filterEtapa) {
    filterEtapa.addEventListener("change", (e) => {
      renderizarEnvios(searchInput.value, e.target.value);
    });
  }
});
