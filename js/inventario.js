/**
 * NUBAGLOW APP - JS DE CONTROL DE INVENTARIO Y STOCK
 * Alertas automáticas de punto de reorden (stock <= 5 unidades).
 * Para Gestores de Almacén y Administradores.
 */

const UMBRAL_STOCK_BAJO = 5;
const STORAGE_KEY_INVENTARIO = "nubaglow_inventario_db";

// Lista de inventario inicial con fotos locales
let inventario = [
  {
    id: "p1",
    nombre: "Serum Glow Vitamina C + Ácido Hialurónico",
    categoria: "Skincare",
    precio: 145,
    stock: 9,
    almacen: "Central Sucre",
    imagen: "imagenes/1.jpg"
  },
  {
    id: "p2",
    nombre: "Base Líquida Matte Glow Ligera SPF 20",
    categoria: "Maquillaje",
    precio: 120,
    stock: 3, // Bajo stock para disparar alerta
    almacen: "Central Sucre",
    imagen: "imagenes/2.jpg"
  },
  {
    id: "p3",
    nombre: "Protector Solar Toque Seco SPF 50+ Invisible",
    categoria: "Skincare",
    precio: 130,
    stock: 18,
    almacen: "Central Sucre",
    imagen: "imagenes/3.jpg"
  },
  {
    id: "p4",
    nombre: "Paleta de Sombras Sunset Rosé",
    categoria: "Maquillaje",
    precio: 145,
    stock: 4, // Bajo stock para disparar alerta
    almacen: "Central Sucre",
    imagen: "imagenes/4.jpg"
  },
  {
    id: "p5",
    nombre: "Gel Limpiador Purificante con Ácido Salicílico",
    categoria: "Skincare",
    precio: 95,
    stock: 14,
    almacen: "Central Sucre",
    imagen: "imagenes/5.jpg"
  },
  {
    id: "p6",
    nombre: "Crema Hidratante Ceramide Barrier Relief",
    categoria: "Skincare",
    precio: 120,
    stock: 6,
    almacen: "Central Sucre",
    imagen: "imagenes/6.jpg"
  }
];

function cargarInventario() {
  const guardado = localStorage.getItem(STORAGE_KEY_INVENTARIO);
  if (guardado) {
    try {
      inventario = JSON.parse(guardado);
    } catch (e) {}
  }
  renderizarTablaInventario();
  actualizarMetricas();
}

function guardarInventario() {
  localStorage.setItem(STORAGE_KEY_INVENTARIO, JSON.stringify(inventario));
}

function renderizarTablaInventario(filtroTexto = "", filtroEstado = "todos") {
  const tbody = document.getElementById("inventario-tbody");
  const alertaBanner = document.getElementById("alerta-reorden-banner");
  const alertaConteo = document.getElementById("alerta-conteo");

  if (!tbody) return;

  tbody.innerHTML = "";

  // Calcular productos con bajo stock
  const productosCriticos = inventario.filter(p => p.stock <= UMBRAL_STOCK_BAJO);

  // Mostrar u ocultar banner de alerta
  if (alertaBanner && alertaConteo) {
    if (productosCriticos.length > 0) {
      alertaConteo.textContent = `${productosCriticos.length} producto${productosCriticos.length > 1 ? 's' : ''}`;
      alertaBanner.classList.remove("hidden");
    } else {
      alertaBanner.classList.add("hidden");
    }
  }

  // Filtrar
  const filtrados = inventario.filter(p => {
    const coincideTexto = p.nombre.toLowerCase().includes(filtroTexto.toLowerCase()) || 
                          p.categoria.toLowerCase().includes(filtroTexto.toLowerCase());
    
    let coincideEstado = true;
    if (filtroEstado === "critico") coincideEstado = p.stock <= UMBRAL_STOCK_BAJO;
    if (filtroEstado === "ok") coincideEstado = p.stock > UMBRAL_STOCK_BAJO;

    return coincideTexto && coincideEstado;
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-neutral-400">
          No hay productos que coincidan con el criterio seleccionado.
        </td>
      </tr>
    `;
    return;
  }

  filtrados.forEach(prod => {
    const esCritico = prod.stock <= UMBRAL_STOCK_BAJO;
    const badgeEstado = esCritico 
      ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 w-max">
           <span class="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
           Punto de Reorden
         </span>`
      : `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-max">
           <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
           Stock Óptimo
         </span>`;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-rose-50/40 transition-colors";
    tr.innerHTML = `
      <td>
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-white p-1 border border-rose-100 shrink-0 overflow-hidden shadow-sm">
            <img src="${prod.imagen}" alt="${prod.nombre}" class="w-full h-full object-cover rounded-lg">
          </div>
          <div>
            <strong class="text-sm font-bold text-neutral-900 block">${prod.nombre}</strong>
            <span class="text-xs text-neutral-400 font-mono">SKU: ${prod.id.toUpperCase()}</span>
          </div>
        </div>
      </td>
      <td class="text-xs font-semibold text-neutral-600">${prod.categoria}</td>
      <td class="text-xs font-bold text-[#8F3E43]">Bs. ${prod.precio}</td>
      <td>
        <div class="flex items-center gap-2">
          <button onclick="ajustarStock('${prod.id}', -1)" class="w-6 h-6 rounded-md bg-white border border-rose-200 text-neutral-700 font-bold hover:bg-rose-100">-</button>
          <span class="w-8 text-center text-sm font-black ${esCritico ? 'text-red-600' : 'text-neutral-900'}">${prod.stock}</span>
          <button onclick="ajustarStock('${prod.id}', 1)" class="w-6 h-6 rounded-md bg-white border border-rose-200 text-neutral-700 font-bold hover:bg-rose-100">+</button>
        </div>
      </td>
      <td>${badgeEstado}</td>
      <td class="text-xs text-neutral-500 font-medium">${prod.almacen}</td>
    `;

    tbody.appendChild(tr);
  });
}

function ajustarStock(id, delta) {
  const item = inventario.find(p => p.id === id);
  if (!item) return;

  item.stock = Math.max(0, item.stock + delta);
  guardarInventario();
  renderizarTablaInventario(
    document.getElementById("search-inventario")?.value || "",
    document.getElementById("filter-stock-estado")?.value || "todos"
  );
  actualizarMetricas();
}

function actualizarMetricas() {
  const totalUnidades = inventario.reduce((acc, p) => acc + p.stock, 0);
  const criticos = inventario.filter(p => p.stock <= UMBRAL_STOCK_BAJO).length;
  const valorInventario = inventario.reduce((acc, p) => acc + (p.stock * p.precio), 0);

  const totalEl = document.getElementById("metric-stock-total");
  const criticosEl = document.getElementById("metric-stock-criticos");
  const valorEl = document.getElementById("metric-stock-valor");

  if (totalEl) totalEl.textContent = `${totalUnidades} uds`;
  if (criticosEl) criticosEl.textContent = criticos;
  if (valorEl) valorEl.textContent = `Bs. ${valorInventario.toLocaleString()}`;
}

document.addEventListener("DOMContentLoaded", () => {
  // Proteger ruta para roles almacen y administrador
  const usuario = protegerRuta(["almacen", "administrador"]);
  if (!usuario) return;

  cargarInventario();

  const searchInput = document.getElementById("search-inventario");
  const filterEstado = document.getElementById("filter-stock-estado");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderizarTablaInventario(e.target.value, filterEstado.value);
    });
  }

  if (filterEstado) {
    filterEstado.addEventListener("change", (e) => {
      renderizarTablaInventario(searchInput.value, e.target.value);
    });
  }
});
