/**
 * NUBAGLOW APP - JS DEL PUNTO DE VENTA (POS)
 * Registro de ventas en mostrador físico para Vendedor y Administrador.
 * Cálculo de totales, cambio en efectivo y cobro instantáneo con QR Simple.
 */

// Catálogo de productos disponibles para venta en mostrador
const PRODUCTOS_POS = [
  {
    id: "p1",
    nombre: "Serum Glow Vitamina C + Ácido Hialurónico",
    categoria: "Skincare",
    precio: 145,
    stock: 9,
    imagen: "imagenes/1.jpg"
  },
  {
    id: "p2",
    nombre: "Base Líquida Matte Glow Ligera SPF 20",
    categoria: "Maquillaje",
    precio: 120,
    stock: 3,
    imagen: "imagenes/2.jpg"
  },
  {
    id: "p3",
    nombre: "Protector Solar Toque Seco SPF 50+ Invisible",
    categoria: "Skincare",
    precio: 130,
    stock: 18,
    imagen: "imagenes/3.jpg"
  },
  {
    id: "p4",
    nombre: "Paleta de Sombras Sunset Rosé",
    categoria: "Maquillaje",
    precio: 145,
    stock: 8,
    imagen: "imagenes/4.jpg"
  },
  {
    id: "p5",
    nombre: "Gel Limpiador Purificante con Ácido Salicílico",
    categoria: "Skincare",
    precio: 95,
    stock: 14,
    imagen: "imagenes/5.jpg"
  },
  {
    id: "p6",
    nombre: "Crema Hidratante Ceramide Barrier Relief",
    categoria: "Skincare",
    precio: 120,
    stock: 6,
    imagen: "imagenes/6.jpg"
  }
];

// Estado de la venta actual (líneas de venta)
let ticketActual = [];
let metodoPagoSeleccionado = "Efectivo";

function renderizarProductosPOS(filtro = "todos") {
  const contenedor = document.getElementById("pos-productos-grid");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  const filtrados = filtro === "todos" 
    ? PRODUCTOS_POS 
    : PRODUCTOS_POS.filter(p => p.categoria.toLowerCase() === filtro.toLowerCase());

  filtrados.forEach(prod => {
    const card = document.createElement("div");
    card.className = "bg-white rounded-2xl p-3 border border-rose-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between hover-lift cursor-pointer";
    card.onclick = () => agregarAlTicket(prod.id);

    card.innerHTML = `
      <div class="h-28 w-full rounded-xl overflow-hidden mb-2.5 bg-rose-50 flex items-center justify-center">
        <img src="${prod.imagen}" alt="${prod.nombre}" class="w-full h-full object-cover">
      </div>
      <div>
        <span class="text-[10px] font-bold text-[#C97A7E] uppercase block">${prod.categoria}</span>
        <h4 class="text-xs font-bold text-neutral-900 line-clamp-1">${prod.nombre}</h4>
      </div>
      <div class="mt-2.5 pt-2 border-t border-rose-50 flex items-center justify-between">
        <span class="text-sm font-extrabold text-[#8F3E43]">Bs. ${prod.precio}</span>
        <button class="w-7 h-7 rounded-lg btn-rose-primary text-xs font-bold flex items-center justify-center shadow-sm">
          +
        </button>
      </div>
    `;

    contenedor.appendChild(card);
  });
}

function agregarAlTicket(id) {
  const prod = PRODUCTOS_POS.find(p => p.id === id);
  if (!prod) return;

  const itemExistente = ticketActual.find(i => i.id === id);
  if (itemExistente) {
    itemExistente.cantidad += 1;
  } else {
    ticketActual.push({
      id: prod.id,
      nombre: prod.nombre,
      precio: prod.precio,
      cantidad: 1
    });
  }

  renderizarTicket();
}

function cambiarCantidad(id, delta) {
  const item = ticketActual.find(i => i.id === id);
  if (!item) return;

  item.cantidad += delta;
  if (item.cantidad <= 0) {
    ticketActual = ticketActual.filter(i => i.id !== id);
  }

  renderizarTicket();
}

function eliminarDelTicket(id) {
  ticketActual = ticketActual.filter(i => i.id !== id);
  renderizarTicket();
}

function vaciarTicket() {
  if (ticketActual.length === 0) return;
  if (confirm("¿Deseas cancelar la venta actual?")) {
    ticketActual = [];
    renderizarTicket();
  }
}

function calcularTotal() {
  return ticketActual.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
}

function renderizarTicket() {
  const listaContenedor = document.getElementById("ticket-items");
  const totalEl = document.getElementById("ticket-total");
  const subtotalEl = document.getElementById("ticket-subtotal");
  const btnCobrar = document.getElementById("btn-cobrar");

  if (!listaContenedor) return;

  listaContenedor.innerHTML = "";
  const total = calcularTotal();

  if (ticketActual.length === 0) {
    listaContenedor.innerHTML = `
      <div class="py-12 text-center text-neutral-400">
        <div class="text-3xl mb-2">🛍️</div>
        <p class="text-xs">Toca un producto para iniciar la venta</p>
      </div>
    `;
    if (totalEl) totalEl.textContent = "Bs. 0";
    if (subtotalEl) subtotalEl.textContent = "Bs. 0";
    if (btnCobrar) {
      btnCobrar.disabled = true;
      btnCobrar.textContent = "Cobrar Venta (Bs. 0)";
    }
    calcularCambio();
    return;
  }

  ticketActual.forEach(item => {
    const li = document.createElement("div");
    li.className = "flex items-center justify-between p-2.5 rounded-xl bg-white border border-rose-100 shadow-sm text-xs";
    li.innerHTML = `
      <div class="flex-1 pr-2">
        <strong class="block text-neutral-800 line-clamp-1">${item.nombre}</strong>
        <span class="text-neutral-500">Bs. ${item.precio} c/u</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button onclick="cambiarCantidad('${item.id}', -1)" class="w-6 h-6 rounded-md bg-rose-50 text-neutral-700 font-bold hover:bg-rose-100">-</button>
        <span class="w-6 text-center font-bold text-neutral-900">${item.cantidad}</span>
        <button onclick="cambiarCantidad('${item.id}', 1)" class="w-6 h-6 rounded-md bg-rose-50 text-neutral-700 font-bold hover:bg-rose-100">+</button>
        <span class="w-16 text-right font-bold text-[#8F3E43]">Bs. ${item.precio * item.cantidad}</span>
        <button onclick="eliminarDelTicket('${item.id}')" class="text-neutral-400 hover:text-red-500 ml-1">✕</button>
      </div>
    `;
    listaContenedor.appendChild(li);
  });

  if (totalEl) totalEl.textContent = `Bs. ${total}`;
  if (subtotalEl) subtotalEl.textContent = `Bs. ${total}`;
  if (btnCobrar) {
    btnCobrar.disabled = false;
    btnCobrar.textContent = `Cobrar Venta (Bs. ${total})`;
  }

  calcularCambio();
}

function seleccionarMetodoPago(metodo) {
  metodoPagoSeleccionado = metodo;
  const btnEfectivo = document.getElementById("metodo-efectivo");
  const btnQR = document.getElementById("metodo-qr");
  const panelEfectivo = document.getElementById("panel-pago-efectivo");

  if (metodo === "Efectivo") {
    btnEfectivo.className = "flex-1 py-2 rounded-xl text-xs font-bold bg-[#8F3E43] text-white shadow-sm";
    btnQR.className = "flex-1 py-2 rounded-xl text-xs font-bold bg-white text-neutral-700 border border-rose-200";
    if (panelEfectivo) panelEfectivo.classList.remove("hidden");
  } else {
    btnQR.className = "flex-1 py-2 rounded-xl text-xs font-bold bg-[#8F3E43] text-white shadow-sm";
    btnEfectivo.className = "flex-1 py-2 rounded-xl text-xs font-bold bg-white text-neutral-700 border border-rose-200";
    if (panelEfectivo) panelEfectivo.classList.add("hidden");
  }
}

function calcularCambio() {
  const inputRecibido = document.getElementById("input-efectivo-recibido");
  const cambioEl = document.getElementById("cambio-efectivo");
  if (!inputRecibido || !cambioEl) return;

  const total = calcularTotal();
  const recibido = parseFloat(inputRecibido.value) || 0;
  const cambio = recibido - total;

  if (cambio >= 0 && total > 0) {
    cambioEl.textContent = `Bs. ${cambio.toFixed(2)}`;
    cambioEl.className = "font-extrabold text-emerald-700";
  } else if (recibido > 0 && total > 0) {
    cambioEl.textContent = `Faltan Bs. ${Math.abs(cambio).toFixed(2)}`;
    cambioEl.className = "font-bold text-red-600";
  } else {
    cambioEl.textContent = "Bs. 0.00";
    cambioEl.className = "font-bold text-neutral-600";
  }
}

function procesarCobro() {
  const total = calcularTotal();
  if (total <= 0) return;

  const nroTicket = "POS-" + Math.floor(100000 + Math.random() * 900000);
  document.getElementById("recibo-nro").textContent = nroTicket;
  document.getElementById("recibo-total").textContent = `Bs. ${total}`;
  document.getElementById("recibo-metodo").textContent = metodoPagoSeleccionado;
  document.getElementById("recibo-fecha").textContent = new Date().toLocaleString();

  // Abrir modal de confirmación
  document.getElementById("modal-recibo").classList.remove("hidden");
}

function finalizarVenta() {
  ticketActual = [];
  document.getElementById("modal-recibo").classList.add("hidden");
  const inputRecibido = document.getElementById("input-efectivo-recibido");
  if (inputRecibido) inputRecibido.value = "";
  renderizarTicket();
}

document.addEventListener("DOMContentLoaded", () => {
  // Proteger ruta para roles vendedor y administrador
  const usuario = protegerRuta(["vendedor", "administrador"]);
  if (!usuario) return;

  renderizarProductosPOS();
  renderizarTicket();

  const inputRecibido = document.getElementById("input-efectivo-recibido");
  if (inputRecibido) {
    inputRecibido.addEventListener("input", calcularCambio);
  }
});
