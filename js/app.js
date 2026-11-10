/**
 * NUBAGLOW APP - JAVASCRIPT PRINCIPAL
 * Experiencia interactiva Beauty-Tech (by Nuba Beauty)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Inicialización de módulos
  initCatalog();
  initCart();
  initAIAssistant();
  initOrderTracking();
  initContactForm();
  initMobileMenu();
});

/* ========================================================
   1. CATÁLOGO DE PRODUCTOS (BEAUTY & SKINCARE EN BOLIVIA)
   ======================================================== */
const PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Serum Glow Vitamina C + Ácido Hialurónico',
    category: 'Tratamiento Facial',
    skinTypes: ['mixta', 'seca', 'sensible'],
    price: 145,
    rating: 4.9,
    reviews: 84,
    stock: 9,
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80',
    description: 'Ilumina la piel, atenúa manchas y brinda un efecto glow natural sin sensación grasa.',
    aiBadge: 'Top Recomendado por IA ✨',
    tag: 'Bestseller'
  },
  {
    id: 'prod-2',
    name: 'Gel Limpiador Purificante con Ácido Salicílico',
    category: 'Limpieza Facial',
    skinTypes: ['grasa', 'mixta'],
    price: 95,
    rating: 4.8,
    reviews: 62,
    stock: 14,
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
    description: 'Controla el sebo, descongestiona los poros y deja la piel mate pero fresca y suave.',
    aiBadge: 'Ideal Piel Grasa 💧',
    tag: 'Control Sebo'
  },
  {
    id: 'prod-3',
    name: 'Crema Hidratante Ceramide Barrier Relief',
    category: 'Hidratación',
    skinTypes: ['seca', 'sensible'],
    price: 120,
    rating: 5.0,
    reviews: 49,
    stock: 6,
    image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=600&q=80',
    description: 'Restaura la barrera cutánea con 3 ceramidas esenciales, calmando rojeces y tirantez.',
    aiBadge: 'Fórmula Calmante 🌿',
    tag: 'Piel Sensible'
  },
  {
    id: 'prod-4',
    name: 'Protector Solar Toque Seco SPF 50+ Invisible',
    category: 'Protección Solar',
    skinTypes: ['grasa', 'mixta', 'seca', 'sensible'],
    price: 130,
    rating: 4.9,
    reviews: 112,
    stock: 18,
    image: 'https://images.unsplash.com/photo-1567928815104-b6cb72648fb1?auto=format&fit=crop&w=600&q=80',
    description: 'Alta protección solar adaptada al clima de Sucre y las alturas de Bolivia. Acabado aterciopelado sin residuo blanco.',
    aiBadge: 'Imprescindible Diario ☀️',
    tag: 'Toque Seco'
  },
  {
    id: 'prod-5',
    name: 'Tónico Exfoliante Suave con Niacinamida 5%',
    category: 'Tónico Facial',
    skinTypes: ['mixta', 'grasa'],
    price: 85,
    rating: 4.7,
    reviews: 38,
    stock: 11,
    image: 'https://images.unsplash.com/photo-1608248597359-009c9519c65a?auto=format&fit=crop&w=600&q=80',
    description: 'Minimiza la apariencia de poros y unifica el tono sin irritar ni resecar la piel.',
    aiBadge: 'Equilibrio Puro ✨',
    tag: 'Niacinamida'
  },
  {
    id: 'prod-6',
    name: 'Base de Maquillaje Glow Serum Ligera SPF 20',
    category: 'Maquillaje Híbrido',
    skinTypes: ['seca', 'mixta', 'sensible'],
    price: 160,
    rating: 4.8,
    reviews: 73,
    stock: 8,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
    description: 'Cobertura construible con acabado satinado radiante que hidrata mientras perfecciona.',
    aiBadge: 'Efecto Segunda Piel 🌸',
    tag: 'Make-up Glow'
  }
];

let activeFilter = 'all';

function initCatalog() {
  const container = document.getElementById('catalog-products-grid');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const filterCount = document.getElementById('filter-results-count');

  if (!container) return;

  function renderProducts(filter) {
    container.innerHTML = '';
    const filtered = filter === 'all' 
      ? PRODUCTS 
      : PRODUCTS.filter(p => p.skinTypes.includes(filter));

    if (filterCount) {
      filterCount.textContent = `${filtered.length} producto${filtered.length !== 1 ? 's' : ''} con disponibilidad en tiempo real`;
    }

    filtered.forEach(product => {
      const card = document.createElement('div');
      card.className = 'group bg-white rounded-3xl p-5 border border-rose-100/70 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between relative overflow-hidden';
      
      const skinPills = product.skinTypes.map(st => {
        const labels = { grasa: 'Grasa', seca: 'Seca', mixta: 'Mixta', sensible: 'Sensible' };
        return `<span class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#FFF8F5] text-[#8F3E43] border border-[#F4C2C2]/50">${labels[st]}</span>`;
      }).join(' ');

      card.innerHTML = `
        <!-- Badge Superior -->
        <div class="flex items-center justify-between mb-3 z-10">
          <span class="badge-gold text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 shadow-sm">
            <span>✨</span> ${product.aiBadge}
          </span>
          <span class="text-xs bg-rose-50 text-[#C97A7E] font-bold px-2.5 py-0.5 rounded-full border border-rose-100">
            ${product.tag}
          </span>
        </div>

        <!-- Imagen del producto -->
        <div class="relative w-full h-52 rounded-2xl overflow-hidden mb-4 bg-[#FFF8F5] flex items-center justify-center">
          <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
          
          <!-- Indicador de stock en tiempo real -->
          <div class="absolute bottom-2.5 left-2.5 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm text-neutral-800">
            <span class="w-2 h-2 rounded-full bg-emerald-500 pulse-dot"></span>
            <span>Stock: <strong class="text-emerald-700">${product.stock} disponibles</strong></span>
          </div>
        </div>

        <!-- Información -->
        <div class="flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-1.5 mb-1.5">
              <div class="flex text-amber-400 text-xs">
                ${'★'.repeat(Math.floor(product.rating))}
              </div>
              <span class="text-xs font-semibold text-neutral-600">${product.rating}</span>
              <span class="text-xs text-neutral-400">(${product.reviews} reseñas)</span>
            </div>

            <h3 class="text-base font-bold text-neutral-900 group-hover:text-[#C97A7E] transition-colors line-clamp-1 mb-1">
              ${product.name}
            </h3>
            <p class="text-xs text-neutral-500 line-clamp-2 mb-3">
              ${product.description}
            </p>
          </div>

          <!-- Tipo de piel -->
          <div class="mb-4">
            <p class="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold mb-1">Recomendado para piel:</p>
            <div class="flex flex-wrap gap-1">
              ${skinPills}
            </div>
          </div>

          <!-- Precio y Botón CTA -->
          <div class="pt-3 border-t border-neutral-100 flex items-center justify-between mt-auto">
            <div>
              <span class="text-[11px] text-neutral-400 block font-medium">Precio oficial</span>
              <span class="text-xl font-extrabold text-neutral-900">Bs. ${product.price}</span>
            </div>
            <button 
              onclick="addToCart('${product.id}')"
              class="btn-rose-primary px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
              </svg>
              <span>Añadir</span>
            </button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // Filtrado por botones
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filterValue = btn.getAttribute('data-filter') || 'all';
      activeFilter = filterValue;
      renderProducts(filterValue);
    });
  });

  // Render inicial
  renderProducts('all');
}

/* ========================================================
   2. CARRITO DE COMPRAS & CHECKOUT QR SIMPLE BOLIVIA
   ======================================================== */
let cart = [
  { productId: 'prod-1', quantity: 1 }
];

function initCart() {
  updateCartBadge();
  renderCartDrawer();
  setupCartEvents();
}

window.addToCart = function(productId, quantity = 1) {
  const existing = cart.find(item => item.productId === productId);
  const prod = PRODUCTS.find(p => p.id === productId);
  
  if (existing) {
    if (existing.quantity + quantity <= (prod ? prod.stock : 99)) {
      existing.quantity += quantity;
    } else {
      showToast('¡Has alcanzado el límite de stock en tiempo real!', 'warning');
      return;
    }
  } else {
    cart.push({ productId, quantity });
  }

  updateCartBadge();
  renderCartDrawer();
  showToast(`¡"${prod ? prod.name : 'Producto'}" añadido a tu carrito! ✨`, 'success');
};

window.removeFromCart = function(productId) {
  cart = cart.filter(item => item.productId !== productId);
  updateCartBadge();
  renderCartDrawer();
};

window.changeCartQty = function(productId, delta) {
  const item = cart.find(i => i.productId === productId);
  const prod = PRODUCTS.find(p => p.id === productId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    window.removeFromCart(productId);
  } else if (newQty > (prod ? prod.stock : 99)) {
    showToast('Límite de stock disponible alcanzado.', 'warning');
  } else {
    item.quantity = newQty;
    updateCartBadge();
    renderCartDrawer();
  }
};

function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-count-badge');
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  badges.forEach(b => {
    b.textContent = totalItems;
    if (totalItems > 0) {
      b.classList.remove('hidden');
    } else {
      b.classList.add('hidden');
    }
  });
}

function calculateSubtotal() {
  return cart.reduce((total, item) => {
    const prod = PRODUCTS.find(p => p.id === item.productId);
    return total + (prod ? prod.price * item.quantity : 0);
  }, 0);
}

function renderCartDrawer() {
  const itemsContainer = document.getElementById('cart-drawer-items');
  const subtotalEl = document.getElementById('cart-drawer-subtotal');
  const totalEl = document.getElementById('cart-drawer-total');
  const shippingEl = document.getElementById('cart-shipping-cost');
  const citySelect = document.getElementById('cart-shipping-city');

  if (!itemsContainer) return;

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="py-12 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-50 flex items-center justify-center text-rose-300">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
          </svg>
        </div>
        <p class="text-sm font-bold text-neutral-800">Tu carrito de belleza está vacío</p>
        <p class="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">Explora nuestro catálogo con filtro inteligente o consulta al asistente IA para armar tu rutina.</p>
        <button onclick="toggleCartDrawer(false); scrollToSection('catalogo');" class="mt-4 btn-rose-primary text-xs px-4 py-2 rounded-xl">
          Ver Catálogo NubaGlow
        </button>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = 'Bs. 0';
    if (totalEl) totalEl.textContent = 'Bs. 0';
    if (shippingEl) shippingEl.textContent = 'Bs. 0';
    return;
  }

  const subtotal = calculateSubtotal();
  const selectedCity = citySelect ? citySelect.value : 'sucre';
  
  // En Sucre envío gratis a partir de Bs. 150, sino Bs. 10. Envíos nacionales Bs. 25
  let shippingCost = 10;
  if (selectedCity === 'sucre') {
    shippingCost = subtotal >= 150 ? 0 : 10;
  } else {
    shippingCost = 25;
  }

  itemsContainer.innerHTML = '';
  cart.forEach(item => {
    const prod = PRODUCTS.find(p => p.id === item.productId);
    if (!prod) return;

    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 p-3 rounded-2xl bg-[#FFF8F5]/80 border border-rose-100/60 transition-all';
    row.innerHTML = `
      <img src="${prod.image}" alt="${prod.name}" class="w-14 h-14 rounded-xl object-cover border border-white">
      <div class="flex-1 min-w-0">
        <h4 class="text-xs font-bold text-neutral-900 truncate">${prod.name}</h4>
        <span class="text-xs font-extrabold text-[#C97A7E] block mt-0.5">Bs. ${prod.price}</span>
        <div class="flex items-center gap-2 mt-2">
          <div class="flex items-center border border-rose-200 rounded-lg bg-white overflow-hidden text-xs">
            <button onclick="changeCartQty('${prod.id}', -1)" class="px-2 py-0.5 text-neutral-600 hover:bg-rose-50 font-bold">-</button>
            <span class="px-2 py-0.5 font-bold text-neutral-800">${item.quantity}</span>
            <button onclick="changeCartQty('${prod.id}', 1)" class="px-2 py-0.5 text-neutral-600 hover:bg-rose-50 font-bold">+</button>
          </div>
          <span class="text-[11px] text-neutral-400">Subtotal: Bs. ${prod.price * item.quantity}</span>
        </div>
      </div>
      <button onclick="removeFromCart('${prod.id}')" class="text-neutral-400 hover:text-red-500 p-1 transition-colors" title="Eliminar">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      </button>
    `;
    itemsContainer.appendChild(row);
  });

  if (subtotalEl) subtotalEl.textContent = `Bs. ${subtotal}`;
  if (shippingEl) {
    shippingEl.textContent = shippingCost === 0 ? '¡Gratis! (Sucre)' : `Bs. ${shippingCost}`;
  }
  if (totalEl) totalEl.textContent = `Bs. ${subtotal + shippingCost}`;
}

function setupCartEvents() {
  const citySelect = document.getElementById('cart-shipping-city');
  if (citySelect) {
    citySelect.addEventListener('change', () => {
      renderCartDrawer();
    });
  }

  // Botón abrir carrito en navbar
  const openBtns = document.querySelectorAll('.open-cart-btn');
  openBtns.forEach(btn => {
    btn.addEventListener('click', () => toggleCartDrawer(true));
  });

  // Botón cerrar carrito
  const closeBtn = document.getElementById('close-cart-btn');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (closeBtn) closeBtn.addEventListener('click', () => toggleCartDrawer(false));
  if (backdrop) backdrop.addEventListener('click', () => toggleCartDrawer(false));

  // Botón Pagar con QR Simple
  const payBtn = document.getElementById('checkout-qr-btn');
  if (payBtn) {
    payBtn.addEventListener('click', () => {
      if (cart.length === 0) {
        showToast('Agrega al menos un producto a tu bolsa para continuar.', 'warning');
        return;
      }
      openQRModal();
    });
  }
}

window.toggleCartDrawer = function(isOpen) {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (!drawer || !backdrop) return;

  if (isOpen) {
    renderCartDrawer();
    drawer.classList.remove('translate-x-full');
    backdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } else {
    drawer.classList.add('translate-x-full');
    backdrop.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

/* ========================================================
   3. MODAL Y SIMULADOR DE PAGO POR QR SIMPLE (BOLIVIA)
   ======================================================== */
let qrTimerInterval = null;

function openQRModal() {
  const modal = document.getElementById('qr-payment-modal');
  const subtotal = calculateSubtotal();
  const citySelect = document.getElementById('cart-shipping-city');
  const selectedCity = citySelect ? citySelect.value : 'sucre';
  const shippingCost = selectedCity === 'sucre' ? (subtotal >= 150 ? 0 : 10) : 25;
  const total = subtotal + shippingCost;

  if (!modal) return;

  // Llenar datos de pago
  const amountEl = document.getElementById('qr-modal-amount');
  const refEl = document.getElementById('qr-modal-reference');
  const timerEl = document.getElementById('qr-modal-timer');

  const randomRef = 'NBG-' + Math.floor(100000 + Math.random() * 900000);
  if (amountEl) amountEl.textContent = `Bs. ${total}.00`;
  if (refEl) refEl.textContent = randomRef;

  modal.classList.remove('hidden');

  // Iniciar temporizador de 5 minutos
  let timeLeft = 300;
  if (qrTimerInterval) clearInterval(qrTimerInterval);

  qrTimerInterval = setInterval(() => {
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    if (timerEl) {
      timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    if (timeLeft <= 0) {
      clearInterval(qrTimerInterval);
      showToast('El código QR ha expirado. Genera uno nuevo.', 'warning');
      closeQRModal();
    }
  }, 1000);
}

window.closeQRModal = function() {
  const modal = document.getElementById('qr-payment-modal');
  if (modal) modal.classList.add('hidden');
  if (qrTimerInterval) clearInterval(qrTimerInterval);
};

window.simulatePaymentSuccess = function() {
  const btn = document.getElementById('confirm-qr-sim-btn');
  if (btn) {
    btn.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Verificando con Banco...`;
    btn.disabled = true;
  }

  setTimeout(() => {
    closeQRModal();
    toggleCartDrawer(false);
    cart = [];
    updateCartBadge();

    // Mostrar modal o toast de pedido generado
    const orderModal = document.getElementById('order-success-modal');
    if (orderModal) {
      const codeEl = document.getElementById('success-order-code');
      const newGuide = 'NG-SUC-' + Math.floor(1000 + Math.random() * 9000);
      if (codeEl) codeEl.textContent = newGuide;
      orderModal.classList.remove('hidden');
    } else {
      showToast('¡Pago QR Simple verificado exitosamente! Tu pedido fue registrado.', 'success');
    }

    if (btn) {
      btn.innerHTML = `Simular Pago Exitoso (Banca Móvil)`;
      btn.disabled = false;
    }
  }, 1500);
};

window.closeSuccessModal = function() {
  const orderModal = document.getElementById('order-success-modal');
  if (orderModal) orderModal.classList.add('hidden');
};

/* ========================================================
   4. ASISTENTE DE IA DE RUTINAS COSMÉTICAS
   ======================================================== */
const AI_KNOWLEDGE_BASE = {
  mixta: {
    summary: 'Para piel mixta (zona T con brillo y mejillas normales o secas), el secreto es hidratación en gel y equilibrio de poros sin resecar.',
    steps: [
      { step: 'Paso 1 (Día & Noche)', title: 'Limpiador Suave en Gel', desc: 'Gel Purificante con Ácido Salicílico para balancear la zona T.' },
      { step: 'Paso 2 (Día)', title: 'Iluminación y Antioxidantes', desc: 'Serum Glow Vitamina C + Ácido Hialurónico en todo el rostro.' },
      { step: 'Paso 3 (Día)', title: 'Toque Seco Esencial', desc: 'Protector Solar SPF 50+ Invisible para proteger sin aportar grasa.' },
      { step: 'Paso 4 (Noche)', title: 'Regeneración Nocturna', desc: 'Tónico Exfoliante Suave con Niacinamida 5% para afinar poros.' }
    ],
    recommendedProductIds: ['prod-1', 'prod-2', 'prod-4']
  },
  grasa: {
    summary: 'Para piel grasa con tendencia a poros dilatados o brotes, recomendamos controlar el sebo mientras mantienes la barrera cutánea hidratada.',
    steps: [
      { step: 'Paso 1 (Mañana & Noche)', title: 'Limpieza Profunda', desc: 'Gel Limpiador Purificante con Ácido Salicílico.' },
      { step: 'Paso 2 (Día & Noche)', title: 'Equilibrio de Poros', desc: 'Tónico con Niacinamida 5% para regular el exceso de brillo.' },
      { step: 'Paso 3 (Día)', title: 'Protección Mate', desc: 'Protector Solar Toque Seco SPF 50+ de textura ultra ligera.' }
    ],
    recommendedProductIds: ['prod-2', 'prod-5', 'prod-4']
  },
  seca: {
    summary: 'Para piel seca o deshidratada por el clima seco de Sucre y los valles, necesitas lípidos restauradores y ácido hialurónico profundo.',
    steps: [
      { step: 'Paso 1 (Mañana & Noche)', title: 'Limpieza Hidratante', desc: 'Limpieza delicada sin sulfatos agresivos.' },
      { step: 'Paso 2 (Mañana)', title: 'Bomba de Hidratación', desc: 'Serum Glow Vitamina C + Ácido Hialurónico sobre piel húmeda.' },
      { step: 'Paso 3 (Mañana & Noche)', title: 'Barrera Cutánea', desc: 'Crema Hidratante Ceramide Barrier Relief para sellar la humedad.' }
    ],
    recommendedProductIds: ['prod-1', 'prod-3', 'prod-4']
  },
  sensible: {
    summary: 'Para piel reactiva o con rojeces, aplicamos ingredientes calmantes como ceramidas, centella asiática y protectores 100% hipoalergénicos.',
    steps: [
      { step: 'Paso 1', title: 'Calmante Inmediato', desc: 'Crema Hidratante Ceramide Barrier Relief sin fragancias.' },
      { step: 'Paso 2', title: 'Fotoprotección Ultra Suave', desc: 'Protector Solar Toque Seco SPF 50+ formulado para alta tolerancia.' }
    ],
    recommendedProductIds: ['prod-3', 'prod-4']
  },
  maquillaje: {
    summary: 'Para un maquillaje natural que cuide tu piel durante todo el día, fusionamos skincare hidratante con pigmentos ultra ligeros.',
    steps: [
      { step: 'Paso 1', title: 'Preparación de Piel', desc: 'Serum Vitamina C para efecto luminoso antes de maquillar.' },
      { step: 'Paso 2', title: 'Base Híbrida', desc: 'Base de Maquillaje Glow Serum Ligera SPF 20 con acabado segunda piel.' }
    ],
    recommendedProductIds: ['prod-6', 'prod-1']
  }
};

function initAIAssistant() {
  const chatMessages = document.getElementById('ai-chat-messages');
  const chatInput = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-chat-send');
  const suggestionChips = document.querySelectorAll('.ai-suggestion-chip');

  if (!chatMessages) return;

  function addMessage(sender, htmlContent) {
    const msgDiv = document.createElement('div');
    msgDiv.className = sender === 'user' 
      ? 'flex justify-end mb-4 animate-fade-in' 
      : 'flex justify-start mb-4 animate-fade-in';

    if (sender === 'user') {
      msgDiv.innerHTML = `
        <div class="bg-gradient-to-r from-[#F4C2C2] to-[#E8A5A5] text-[#4A1A1E] font-semibold text-xs sm:text-sm px-4 py-3 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm">
          ${htmlContent}
        </div>
      `;
    } else {
      msgDiv.innerHTML = `
        <div class="flex items-start gap-2.5 max-w-[92%] sm:max-w-[85%]">
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-[#E6C387] to-[#F4C2C2] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
            ✨
          </div>
          <div class="glass-panel text-neutral-800 text-xs sm:text-sm p-4 rounded-2xl rounded-tl-none border border-rose-100 shadow-sm leading-relaxed">
            ${htmlContent}
          </div>
        </div>
      `;
    }

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function handleUserPrompt(text) {
    if (!text.trim()) return;

    addMessage('user', text);
    if (chatInput) chatInput.value = '';

    // Estado pensando...
    const loadingId = 'ai-loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'flex items-start gap-2.5 mb-4';
    loadingDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-[#E6C387] to-[#F4C2C2] flex items-center justify-center text-white text-xs font-bold shrink-0">
        ✨
      </div>
      <div class="bg-white/80 p-3 rounded-2xl text-xs text-neutral-500 flex items-center gap-2 border border-rose-100 shadow-sm">
        <span class="w-2 h-2 rounded-full bg-[#E8A5A5] animate-ping"></span>
        Analizando formulaciones dermatológicas y stock de Nuba Beauty...
      </div>
    `;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    setTimeout(() => {
      const loadEl = document.getElementById(loadingId);
      if (loadEl) loadEl.remove();

      // Clasificación semántica de la consulta
      const lower = text.toLowerCase();
      let key = 'mixta';
      if (lower.includes('grasa') || lower.includes('acné') || lower.includes('acne') || lower.includes('brillo')) {
        key = 'grasa';
      } else if (lower.includes('seca') || lower.includes('tirante') || lower.includes('deshidrat')) {
        key = 'seca';
      } else if (lower.includes('sensible') || lower.includes('rojez') || lower.includes('irrit')) {
        key = 'sensible';
      } else if (lower.includes('base') || lower.includes('maquillaje') || lower.includes('color')) {
        key = 'maquillaje';
      } else if (lower.includes('serum') || lower.includes('nocturno') || lower.includes('noche')) {
        key = 'mixta';
      }

      const rec = AI_KNOWLEDGE_BASE[key] || AI_KNOWLEDGE_BASE.mixta;
      
      const stepsHtml = rec.steps.map(s => `
        <div class="p-2.5 rounded-xl bg-white/70 border border-rose-100/70 mb-2">
          <span class="text-[11px] font-bold text-[#C97A7E] uppercase block">${s.step} • ${s.title}</span>
          <span class="text-xs text-neutral-600">${s.desc}</span>
        </div>
      `).join('');

      const productBadges = rec.recommendedProductIds.map(pid => {
        const p = PRODUCTS.find(prod => prod.id === pid);
        if (!p) return '';
        return `
          <div class="flex items-center justify-between p-2 rounded-xl bg-[#FFF8F5] border border-rose-100 text-xs">
            <span class="font-bold text-neutral-800 truncate pr-2">${p.name} (Bs. ${p.price})</span>
            <button onclick="addToCart('${p.id}')" class="btn-rose-primary px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0">
              + Agregar
            </button>
          </div>
        `;
      }).join('');

      const responseHtml = `
        <div class="space-y-3">
          <p class="font-medium text-neutral-900">${rec.summary}</p>
          <div class="my-2">
            <h5 class="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Tu Rutina Paso a Paso:</h5>
            ${stepsHtml}
          </div>
          <div>
            <h5 class="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Productos Sugeridos en Stock Real:</h5>
            <div class="space-y-1.5">
              ${productBadges}
            </div>
          </div>
          <div class="pt-2 flex items-center justify-between border-t border-rose-100">
            <span class="text-[11px] text-neutral-400">¿Quieres personalizarla más? Escríbeme otro detalle.</span>
            <button onclick="addFullRoutine('${key}')" class="btn-gold-accent px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm">
              <span>✨</span> Añadir Todo el Set
            </button>
          </div>
        </div>
      `;

      addMessage('ai', responseHtml);
    }, 900);
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (chatInput) handleUserPrompt(chatInput.value);
    });
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUserPrompt(chatInput.value);
      }
    });
  }

  suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt') || chip.textContent.trim();
      handleUserPrompt(promptText);
    });
  });
}

window.addFullRoutine = function(key) {
  const rec = AI_KNOWLEDGE_BASE[key];
  if (!rec) return;

  rec.recommendedProductIds.forEach(id => {
    window.addToCart(id, 1);
  });
  showToast(`¡Set completo de rutina "${key}" añadido al carrito!`, 'success');
  toggleCartDrawer(true);
};

/* ========================================================
   5. SEGUIMIENTO DE PEDIDOS EN TIEMPO REAL (BOLIVIA)
   ======================================================== */
const DEMO_TRACKING_DATA = {
  'NG-SUC-8924': {
    guide: 'NG-SUC-8924',
    city: 'Sucre (Chuquisaca)',
    destination: 'Zona San Roque / Av. Hernando Siles',
    currentStage: 3, // 1: Almacén, 2: Control Calidad, 3: En Camino (Delivery), 4: Entregado
    statusText: 'En camino con repartidor local express',
    courier: 'MotoGlow Express Sucre',
    eta: 'Hoy entre 16:30 y 17:15',
    lastUpdate: 'Hace 12 minutos (Salió del Hub Central Nuba Beauty)',
    items: ['Serum Glow Vitamina C', 'Protector Solar Toque Seco']
  },
  'NG-LPZ-5011': {
    guide: 'NG-LPZ-5011',
    city: 'La Paz',
    destination: 'Zona Sur / Calacoto',
    currentStage: 2,
    statusText: 'Empacado con protección térmica y listo para despacho nacional',
    courier: 'Transportes Bolivia Express Aéreo',
    eta: 'Mañana a mediodía',
    lastUpdate: 'Hace 45 minutos (Control de empaque completado)',
    items: ['Crema Hidratante Ceramide Barrier Relief']
  },
  'NG-SCZ-3329': {
    guide: 'NG-SCZ-3329',
    city: 'Santa Cruz de la Sierra',
    destination: 'Equipetrol Norte',
    currentStage: 4,
    statusText: 'Entregado a conformidad del cliente',
    courier: 'Nacional Courrier Bolivia',
    eta: 'Entregado con éxito',
    lastUpdate: 'Ayer 15:40',
    items: ['Base de Maquillaje Glow Serum', 'Gel Limpiador Purificante']
  }
};

function initOrderTracking() {
  const input = document.getElementById('tracking-code-input');
  const btn = document.getElementById('tracking-search-btn');
  const demoPills = document.querySelectorAll('.tracking-demo-pill');
  const resultContainer = document.getElementById('tracking-result-card');

  if (!btn || !resultContainer) return;

  function lookupTracking(code) {
    const clean = code.trim().toUpperCase();
    const data = DEMO_TRACKING_DATA[clean] || {
      guide: clean || 'NG-SUC-DEMO',
      city: 'Sucre (Chuquisaca)',
      destination: 'Dirección confirmada del comprador',
      currentStage: 3,
      statusText: 'En tránsito con delivery local',
      courier: 'NubaGlow Courier Local',
      eta: 'En transcurso de hoy',
      lastUpdate: 'Hace unos momentos',
      items: ['Rutina Skincare Personalizada']
    };

    renderTrackingTimeline(data);
  }

  function renderTrackingTimeline(data) {
    const stages = [
      { num: 1, title: 'Almacén Nuba Beauty', desc: 'Confirmación y preparación en Sucre' },
      { num: 2, title: 'Control de Calidad', desc: 'Verificación de lote y empaque Glow' },
      { num: 3, title: 'En Camino', desc: 'Courier express en ruta hacia tu ubicación' },
      { num: 4, title: 'Entrega en Mano', desc: 'Confirmación digital con firma/código' }
    ];

    let stepsHtml = '';
    stages.forEach((st, idx) => {
      const isDone = st.num < data.currentStage;
      const isCurrent = st.num === data.currentStage;
      const isPending = st.num > data.currentStage;

      let iconBg = 'bg-neutral-100 text-neutral-400 border-neutral-200';
      if (isDone) iconBg = 'bg-emerald-500 text-white border-emerald-500';
      if (isCurrent) iconBg = 'bg-[#E8A5A5] text-[#4A1A1E] border-[#E8A5A5] ring-4 ring-rose-100 animate-pulse';

      stepsHtml += `
        <div class="relative flex items-start gap-3.5 pb-6 last:pb-0">
          ${idx < stages.length - 1 ? `<div class="absolute left-4 top-8 -bottom-1 w-0.5 ${isDone ? 'bg-emerald-500' : 'bg-neutral-200'}"></div>` : ''}
          <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 shrink-0 ${iconBg}">
            ${isDone ? '✓' : st.num}
          </div>
          <div>
            <h4 class="text-xs sm:text-sm font-bold ${isCurrent ? 'text-[#8F3E43]' : 'text-neutral-900'}">${st.title}</h4>
            <p class="text-[11px] sm:text-xs text-neutral-500">${st.desc}</p>
            ${isCurrent ? `<span class="inline-block mt-1 text-[11px] bg-rose-50 text-[#8F3E43] font-semibold px-2 py-0.5 rounded-md border border-rose-200">Etapa actual: ${data.statusText}</span>` : ''}
          </div>
        </div>
      `;
    });

    resultContainer.innerHTML = `
      <div class="glass-panel p-6 sm:p-7 rounded-3xl border border-rose-100 shadow-lg">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-neutral-100 mb-6">
          <div>
            <span class="text-xs uppercase font-bold text-neutral-400 tracking-wider">Código de Rastreo</span>
            <h3 class="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
              ${data.guide}
              <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${data.currentStage === 4 ? 'bg-emerald-100 text-emerald-800' : 'badge-gold'}">
                ${data.currentStage === 4 ? 'Entregado' : 'En Tránsito'}
              </span>
            </h3>
          </div>
          <div class="text-right">
            <span class="text-xs uppercase font-bold text-neutral-400 tracking-wider">Destino</span>
            <p class="text-sm font-bold text-neutral-800">${data.city}</p>
            <p class="text-xs text-neutral-500">${data.destination}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Timeline -->
          <div class="space-y-1">
            ${stepsHtml}
          </div>

          <!-- Detalles adicionales -->
          <div class="bg-[#FFF8F5] p-5 rounded-2xl border border-rose-100 flex flex-col justify-between">
            <div class="space-y-3">
              <div>
                <span class="text-[11px] text-neutral-400 font-semibold uppercase block">Empresa de Despacho</span>
                <span class="text-xs font-bold text-neutral-800">${data.courier}</span>
              </div>
              <div>
                <span class="text-[11px] text-neutral-400 font-semibold uppercase block">Hora estimada de llegada (ETA)</span>
                <span class="text-xs font-extrabold text-[#C97A7E]">${data.eta}</span>
              </div>
              <div>
                <span class="text-[11px] text-neutral-400 font-semibold uppercase block">Última actualización de GPS</span>
                <span class="text-xs text-neutral-600">${data.lastUpdate}</span>
              </div>
              <div>
                <span class="text-[11px] text-neutral-400 font-semibold uppercase block">Artículos en este paquete</span>
                <p class="text-xs font-medium text-neutral-700">${data.items.join(', ')}</p>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-rose-200/60 flex items-center justify-between text-xs">
              <span class="text-neutral-500">¿Dudas con tu entrega?</span>
              <a href="https://wa.me/59170000000?text=Hola%20NubaGlow,%20consulto%20por%20mi%20guia%20${data.guide}" target="_blank" class="text-[#8F3E43] font-bold hover:underline flex items-center gap-1">
                WhatsApp Sucre →
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    resultContainer.classList.remove('hidden');
  }

  btn.addEventListener('click', () => {
    if (input) lookupTracking(input.value || 'NG-SUC-8924');
  });

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        lookupTracking(input.value || 'NG-SUC-8924');
      }
    });
  }

  demoPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const code = pill.getAttribute('data-code') || 'NG-SUC-8924';
      if (input) input.value = code;
      lookupTracking(code);
    });
  });

  // Carga inicial por defecto con el pedido de Sucre
  lookupTracking('NG-SUC-8924');
}

/* ========================================================
   6. FORMULARIO DE CONTACTO & NOTIFICACIONES (TOAST)
   ======================================================== */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('[name="name"]')?.value || '';
    const email = form.querySelector('[name="email"]')?.value || '';
    const city = form.querySelector('[name="city"]')?.value || '';
    const message = form.querySelector('[name="message"]')?.value || '';

    if (!name || !email || !message) {
      showToast('Por favor completa todos los campos requeridos.', 'warning');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Enviando mensaje...</span>`;
    }

    setTimeout(() => {
      form.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Enviar Mensaje</span>`;
      }
      showToast(`¡Gracias ${name}! Tu consulta ha sido enviada al equipo de Nuba Beauty en ${city || 'Bolivia'}. Te responderemos pronto.`, 'success');
    }, 1000);
  });
}

function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-[90%] sm:w-auto pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'bg-white border-[#E8A5A5] text-neutral-900',
    warning: 'bg-amber-50 border-amber-300 text-amber-900',
    info: 'bg-white border-neutral-200 text-neutral-900'
  };

  const icons = {
    success: '✨',
    warning: '⚠️',
    info: 'ℹ️'
  };

  toast.className = `pointer-events-auto p-4 rounded-2xl border shadow-xl flex items-start gap-3 transition-all duration-300 transform translate-y-3 opacity-0 toast-glow ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `
    <span class="text-base">${icons[type] || '✨'}</span>
    <div class="flex-1 text-xs sm:text-sm font-medium leading-snug">${message}</div>
    <button onclick="this.parentElement.remove()" class="text-neutral-400 hover:text-neutral-700 font-bold text-xs p-0.5">✕</button>
  `;

  toastContainer.appendChild(toast);

  // Animación de entrada
  setTimeout(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  }, 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

/* ========================================================
   7. MENÚ MÓVIL Y NAVEGACIÓN SUAVE
   ======================================================== */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const closeBtn = document.getElementById('mobile-menu-close');
  const menuLinks = document.querySelectorAll('.mobile-nav-link');

  if (!toggleBtn || !mobileMenu) return;

  function toggleMenu(open) {
    if (open) {
      mobileMenu.classList.remove('hidden');
    } else {
      mobileMenu.classList.add('hidden');
    }
  }

  toggleBtn.addEventListener('click', () => toggleMenu(true));
  if (closeBtn) closeBtn.addEventListener('click', () => toggleMenu(false));

  menuLinks.forEach(link => {
    link.addEventListener('click', () => toggleMenu(false));
  });
}

window.scrollToSection = function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
};
