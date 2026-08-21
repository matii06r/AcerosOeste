const money = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
const hasSupabaseConfig = Boolean(
  window.ACEROS_CONFIG?.SUPABASE_URL &&
    window.ACEROS_CONFIG?.SUPABASE_PUBLISHABLE_KEY,
);
const supabase =
  window.supabase?.createClient && hasSupabaseConfig
    ? window.supabase.createClient(
        window.ACEROS_CONFIG?.SUPABASE_URL,
        window.ACEROS_CONFIG?.SUPABASE_PUBLISHABLE_KEY,
      )
    : null;
const categoryVisuals = {
  "Mesas de Trabajo": "▱",
  "Mesadas con Bacha": "▰",
  Campanas: "⌂",
  Carros: "▤",
  Estanterías: "▥",
};
const fallbackProducts = [
  {
    id: "demo-1",
    slug: "mesa-trabajo-reforzada-120x60",
    name: "Mesa de trabajo reforzada 120×60",
    category: "Mesas de Trabajo",
    price: 289900,
    stock: 6,
    sku: "MT-120",
    images: [],
    desc: "Mesa profesional en acero inoxidable con estante inferior, patas reforzadas y regatones regulables.",
    details:
      "Fabricación soldada, terminación sanitaria y estructura preparada para uso gastronómico intensivo.",
  },
  {
    id: "demo-2",
    slug: "mesada-con-bacha-60x40",
    name: "Mesada con bacha 60×40",
    category: "Mesadas con Bacha",
    price: 349500,
    stock: 4,
    sku: "MB-6040",
    images: [],
    desc: "Mesada sanitaria con bacha profunda, zócalo posterior y estructura totalmente soldada.",
    details:
      "Bacha de 60 × 40 cm. Consultá por profundidad, ubicación y largo total a medida.",
  },
  {
    id: "demo-3",
    slug: "campana-gastronomica-150",
    name: "Campana gastronómica 150 cm",
    category: "Campanas",
    price: 425000,
    stock: 2,
    sku: "CG-150",
    images: [],
    desc: "Campana industrial en acero inoxidable con filtros desmontables. Lista para instalar.",
    details:
      "Diseñada para extracción gastronómica. Conducto y motor se cotizan según cada instalación.",
  },
  {
    id: "demo-4",
    slug: "carro-servicio-3-estantes",
    name: "Carro de servicio 3 estantes",
    category: "Carros",
    price: 238000,
    stock: 8,
    sku: "CS-3E",
    images: [],
    desc: "Carro utilitario con tres niveles, manijas y ruedas giratorias de alta resistencia.",
    details:
      "Ideal para cocinas, salones y depósitos. También disponible en medidas personalizadas.",
  },
];

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}
const state = {
  clients: [],
  pendingSignupEmail: "",
  recoveryMode:
    new URLSearchParams(location.search).get("auth") === "recovery",
  products: [],
  categories: [],
  questions: {},
  cart: safeRead("ao_cart_guest", []),
  settings: { deposit_percentage: 30, freight_whatsapp: "5491134322199" },
  user: null,
  profile: null,
  filter: "Todos",
  search: "",
  visibleCount: 24,
  loading: true,
  usingFallback: false,
  chatChannel: null,
};
const isAdmin = () => state.profile?.role === "admin";
const cartStorageKey = () => `ao_cart_${state.user?.id || "guest"}`;
const slugify = (text) =>
  String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ],
  );
const saveCart = () => {
  localStorage.setItem(cartStorageKey(), JSON.stringify(state.cart));
  renderCartCount();
};
function reconcileCart() {
  if (state.loading || state.usingFallback) return false;
  const availableProducts = new Map(
    state.products
      .filter((product) => product.active !== false && Number(product.stock) > 0)
      .map((product) => [String(product.id), product]),
  );
  const cleanCart = [];
  const cleanById = new Map();

  for (const item of Array.isArray(state.cart) ? state.cart : []) {
    const product = availableProducts.get(String(item?.id));
    const requested = Math.floor(Number(item?.qty));
    if (!product || !Number.isFinite(requested) || requested < 1) continue;
    const current = cleanById.get(String(product.id));
    if (current) {
      current.qty = Math.min(product.stock, current.qty + requested);
    } else {
      const next = {
        id: product.id,
        qty: Math.min(product.stock, requested),
      };
      cleanCart.push(next);
      cleanById.set(String(product.id), next);
    }
  }

  const changed = JSON.stringify(cleanCart) !== JSON.stringify(state.cart);
  state.cart = cleanCart;
  if (changed)
    localStorage.setItem(cartStorageKey(), JSON.stringify(state.cart));
  return changed;
}
function toast(message, type = "info") {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.dataset.type = type;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 3200);
}
function setBusy(button, busy, text = "Procesando…") {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}
function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    desc: row.description || "",
    details: row.details || "",
    price: Number(row.price),
    stock: Number(row.stock_quantity),
    categoryId: row.category_id,
    category: row.categories?.name || "Acero Inoxidable",
    images: Array.isArray(row.images) ? row.images : [],
    sku: row.sku || "",
    active: row.is_active,
  };
}

async function loadStoreData() {
  const [
    { data: categories, error: catError },
    { data: products, error: productError },
    { data: settings },
    { data: clients, error: clientsError },
  ] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("products")
      .select("*, categories(name,slug)")
      .order("created_at", { ascending: false }),
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("client_projects")
      .select("*")
      .order("sort_order")
      .order("created_at", { ascending: false }),
  ]);
  state.clients = clientsError ? [] : clients || [];
  if (catError || productError) {
    console.error(catError || productError);
    state.products = fallbackProducts;
    state.categories = [
      ...new Set(fallbackProducts.map((p) => p.category)),
    ].map((name, index) => ({
      id: `demo-cat-${index}`,
      name,
      slug: slugify(name),
    }));
    state.usingFallback = true;
    toast(
      "No pudimos conectar el catálogo. Mostramos productos de referencia.",
      "error",
    );
  } else if (products?.length) {
    state.categories = categories || [];
    state.products = (products || []).map(mapProduct);
    state.usingFallback = false;
  } else {
    state.products = fallbackProducts;
    state.categories = [
      ...new Set(fallbackProducts.map((product) => product.category)),
    ].map((name, index) => ({
      id: `demo-cat-${index}`,
      name,
      slug: slugify(name),
    }));
    state.usingFallback = true;
    toast(
      "El catálogo está listo para que el administrador publique productos.",
      "info",
    );
  }
  if (settings) state.settings = settings;
  state.loading = false;
  reconcileCart();
  renderClients();
  renderCategories();
  renderProducts();
  renderCartCount();
  handleRoute();
}

async function restoreSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  await applySession(session);
  supabase.auth.onAuthStateChange((event, nextSession) =>
    setTimeout(async () => {
      if (event === "PASSWORD_RECOVERY") {
        state.recoveryMode = true;
        await applySession(nextSession);
        showPasswordUpdate();
        return;
      }
      // Al volver a una pestaña Supabase renueva el token. Si el usuario no
      // cambió, no reconstruimos la pantalla ni alteramos la ruta actual.
      if (
        event === "TOKEN_REFRESHED" ||
        (event === "SIGNED_IN" &&
          state.user?.id &&
          state.user.id === nextSession?.user?.id)
      ) {
        state.user = nextSession?.user || state.user;
        return;
      }
      await applySession(nextSession);
    }, 0),
  );
}
async function applySession(session) {
  const previousUserId = state.user?.id || "guest";
  state.user = session?.user || null;
  state.profile = null;
  if (state.user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", state.user.id)
      .maybeSingle();
    if (!error) state.profile = data;
  }
  const nextUserId = state.user?.id || "guest";
  if (previousUserId !== nextUserId) {
    state.cart = safeRead(cartStorageKey(), []);
    reconcileCart();
    closeCart();
    renderCartCount();
  }
  updateSessionNavigation();
  if (state.recoveryMode) {
    renderProducts();
    handleRoute();
    return;
  }
  renderAccount();
  renderProducts();
  renderAdminPanel();
  if (location.hash.startsWith("#producto/")) handleRoute();
}

function updateSessionNavigation() {
  if (state.recoveryMode) {
    document.querySelector("#accountNavName").textContent = "Recuperación";
    document.querySelector("#adminNavLink").classList.add("hidden");
    return;
  }
  const name =
    state.profile?.full_name?.trim() ||
    state.user?.user_metadata?.full_name?.trim() ||
    state.user?.email?.split("@")[0] ||
    "Ingresar";
  document.querySelector("#accountNavName").textContent = name;
  document
    .querySelector("#adminNavLink")
    .classList.toggle("hidden", !isAdmin());
}

const isVideoUrl = (url) => /\.(mp4|webm|mov)(\?|$)/i.test(String(url));
function productVisual(product) {
  const media = product.images?.[0];
  return media
    ? isVideoUrl(media)
      ? `<video src="${escapeHtml(media)}" muted playsinline preload="metadata" aria-label="Video de ${escapeHtml(product.name)}"></video>`
      : `<img src="${escapeHtml(media)}" alt="${escapeHtml(product.name)}" loading="lazy">`
    : `<div class="shape ${product.category === "Campanas" ? "hood" : product.category.includes("Bacha") ? "sink" : "table"}"></div>`;
}
function productGallery(product) {
  const media = product.images || [];
  if (!media.length)
    return `<div class="product-page-image">${productVisual(product)}</div>`;
  const main = media[0];
  return `<div class="product-gallery"><div id="galleryMain" class="product-page-image">${isVideoUrl(main) ? `<video src="${escapeHtml(main)}" controls playsinline></video>` : `<img src="${escapeHtml(main)}" alt="${escapeHtml(product.name)}">`}</div>${media.length > 1 ? `<div class="gallery-thumbs">${media.map((url, index) => `<button type="button" class="gallery-thumb ${index === 0 ? "active" : ""}" data-media="${escapeHtml(url)}" data-video="${isVideoUrl(url)}">${isVideoUrl(url) ? `<video src="${escapeHtml(url)}" muted preload="metadata"></video><span>▶</span>` : `<img src="${escapeHtml(url)}" alt="Vista ${index + 1}">`}</button>`).join("")}</div>` : ""}</div>`;
}
function renderCategories() {
  const list = state.categories;
  document.querySelector("#categoryCards").innerHTML =
    list
      .map(
        (c) =>
          `<article class="category-card" data-cat="${escapeHtml(c.name)}"><span>${categoryVisuals[c.name] || "▱"}</span><h3>${escapeHtml(c.name)}</h3><small>Ver productos →</small></article>`,
      )
      .join("") ||
    '<div class="empty">Las categorías se están preparando.</div>';
  document.querySelectorAll("[data-cat]").forEach(
    (node) =>
      (node.onclick = () => {
        state.filter = node.dataset.cat;
        state.visibleCount = 24;
        location.hash = "productos";
        renderProducts();
        requestAnimationFrame(() =>
          document
            .querySelector("#productos")
            ?.scrollIntoView({ behavior: "smooth" }),
        );
      }),
  );
  document.querySelector("#footerCategories").innerHTML = list
    .map(
      (category) =>
        `<a href="#productos" data-footer-cat="${escapeHtml(category.name)}">${escapeHtml(category.name)}</a>`,
    )
    .join("");
  document.querySelectorAll("[data-footer-cat]").forEach((link) => {
    link.onclick = () => {
      state.filter = link.dataset.footerCat;
      state.visibleCount = 24;
      renderProducts();
    };
  });
}
function renderClients() {
  const grid = document.querySelector("#clientsGrid");
  if (!grid) return;
  const clients = state.clients.filter((client) => client.is_active !== false);
  grid.innerHTML = clients.length
    ? clients.map((client) => {
        const cover = client.logo_url;
        return `<article class="client-card"><div class="client-logo">${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(client.name)}" loading="lazy">` : `<span>${escapeHtml(client.name.slice(0, 2).toUpperCase())}</span>`}</div><a class="client-name-button" href="#cliente/${encodeURIComponent(client.id)}">${escapeHtml(client.name)}</a></article>`;
      }).join("")
    : '<div class="empty">Muy pronto vamos a publicar algunos de nuestros trabajos.</div>';
}
function showClientPage(clientId) {
  const client = state.clients.find(
    (item) => String(item.id) === String(clientId) && item.is_active !== false,
  );
  if (!client) {
    location.hash = "clientes";
    return;
  }
  showStandalonePage("#cliente-detalle");
  const page = document.querySelector("#clientDetailContent");
  const logo = client.logo_url;
  page.innerHTML = `<div class="client-detail-head">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(client.name)}">` : `<span>${escapeHtml(client.name.slice(0, 2).toUpperCase())}</span>`}<div><p class="eyebrow orange">${escapeHtml(client.category || "CLIENTE")}</p><h1>${escapeHtml(client.name)}</h1><p>${escapeHtml(client.description || "Equipamiento fabricado a medida por Aceros Oeste.")}</p></div></div><div class="client-detail-gallery">${client.images?.length ? client.images.map((url, index) => `<button type="button" data-client-detail-photo="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="Trabajo realizado para ${escapeHtml(client.name)}, foto ${index + 1}" loading="lazy"></button>`).join("") : '<div class="empty">Próximamente publicaremos las fotos de este trabajo.</div>'}</div>`;
  document.querySelectorAll("[data-client-detail-photo]").forEach((button) => {
    button.onclick = () => openModal(`<button class="modal-close" data-close>×</button><p class="eyebrow orange">TRABAJO REALIZADO</p><h2>${escapeHtml(client.name)}</h2><img class="client-photo-large" src="${escapeHtml(button.dataset.clientDetailPhoto)}" alt="Trabajo realizado para ${escapeHtml(client.name)}">`);
  });
  window.scrollTo(0, 0);
}
function renderFilters() {
  const names = [
    "Todos",
    ...new Set(state.categories.map((c) => c.name)),
    ...new Set(state.products.map((p) => p.category)),
  ];
  document.querySelector("#categoryFilters").innerHTML = [...new Set(names)]
    .map(
      (name) =>
        `<button class="chip ${state.filter === name ? "active" : ""}" data-filter="${escapeHtml(name)}">${escapeHtml(name)}</button>`,
    )
    .join("");
  document.querySelectorAll("[data-filter]").forEach(
    (node) =>
      (node.onclick = () => {
        state.filter = node.dataset.filter;
        state.visibleCount = 24;
        renderProducts();
      }),
  );
}
function renderProducts() {
  renderFilters();
  const grid = document.querySelector("#productGrid");
  if (state.loading) {
    grid.innerHTML = '<div class="empty">Cargando catálogo…</div>';
    return;
  }
  const list = state.products.filter(
    (p) =>
      (state.filter === "Todos" || p.category === state.filter) &&
      p.name.toLowerCase().includes(state.search.toLowerCase()),
  );
  document
    .querySelector("#emptyState")
    .classList.toggle("hidden", Boolean(list.length));
  const visible = list.slice(0, state.visibleCount);
  grid.innerHTML = visible
    .map(
      (p) =>
        `<article class="product-card"><a href="#producto/${encodeURIComponent(p.slug)}" class="product-image"><span class="badge ${p.stock < 3 ? "low" : ""}">${p.stock ? `${p.stock} en stock` : "A pedido"}</span>${productVisual(p)}</a><div class="product-info"><small>${escapeHtml(p.category)}</small><h3><a href="#producto/${encodeURIComponent(p.slug)}">${escapeHtml(p.name)}</a></h3><div class="price">${money(p.price)} <small>final</small></div><div class="product-actions"><a class="btn outline" href="#producto/${encodeURIComponent(p.slug)}">Ver producto</a><button class="btn cta" data-add="${p.id}" ${!p.stock ? "disabled" : ""}>Agregar</button></div>${isAdmin() && !String(p.id).startsWith("demo-") ? `<div class="admin-actions"><button class="btn secondary" data-edit="${p.id}">Editar</button><button class="btn danger" data-delete="${p.id}">Eliminar</button></div>` : ""}</div></article>`,
    )
    .join("");
  const loadMore = document.querySelector("#loadMoreProducts");
  loadMore.classList.toggle("hidden", visible.length >= list.length);
  loadMore.onclick = () => {
    state.visibleCount += 24;
    renderProducts();
  };
  bindProductActions();
}
function bindProductActions() {
  document
    .querySelectorAll("[data-add]")
    .forEach((n) => (n.onclick = () => addToCart(n.dataset.add)));
  document
    .querySelectorAll("[data-edit]")
    .forEach((n) => (n.onclick = () => openEditProduct(n.dataset.edit)));
  document
    .querySelectorAll("[data-delete]")
    .forEach((n) => (n.onclick = () => deleteProduct(n.dataset.delete)));
}

async function loadQuestions(productId) {
  if (String(productId).startsWith("demo-")) return [];
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  state.questions[productId] = data || [];
  return data || [];
}
async function showProductPage(slug) {
  const product = state.products.find((p) => p.slug === slug);
  if (!product) {
    location.hash = "productos";
    return;
  }
  document
    .querySelectorAll("main>section")
    .forEach((s) => s.classList.add("hidden"));
  const page = document.querySelector("#producto");
  page.classList.remove("hidden");
  page.querySelector("#productPageContent").innerHTML =
    '<div class="empty">Cargando producto…</div>';
  const questions = await loadQuestions(product.id);
  page.querySelector("#productPageContent").innerHTML =
    `<div class="product-page-layout">${productGallery(product)}<div class="product-page-info"><p class="eyebrow orange">${escapeHtml(product.category)}</p><h1>${escapeHtml(product.name)}</h1><div class="price">${money(product.price)}</div><div class="stock-line"><span class="badge ${product.stock < 3 ? "low" : ""}" style="position:static">${product.stock ? `${product.stock} unidades disponibles` : "Fabricación a pedido"}</span><small>SKU ${escapeHtml(product.sku)}</small></div><p>${escapeHtml(product.desc)}</p><div class="product-specs"><div><b>Material</b><br>Acero inoxidable</div><div><b>Fabricación</b><br>Nacional</div><div><b>Medidas</b><br>Estándar o a medida</div><div><b>Entrega</b><br>A coordinar</div></div><p>${escapeHtml(product.details)}</p><div class="stack"><button class="btn cta" data-add="${product.id}" ${!product.stock ? "disabled" : ""}>Agregar al carrito</button><a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/${state.settings.sales_whatsapp || "5491134322199"}?text=${encodeURIComponent("Hola Acerosoeste, quiero consultar por " + product.name)}">Consultar por WhatsApp</a>${isAdmin() && !String(product.id).startsWith("demo-") ? `<button class="btn outline" data-edit="${product.id}">Editar producto</button>` : ""}</div></div></div><div class="questions"><p class="eyebrow orange">PREGUNTAS</p><h2>Preguntá lo que necesitás saber</h2>${state.user ? `<form id="questionForm" class="question-form"><input name="question" maxlength="500" placeholder="Escribí tu pregunta sobre este producto..." required><button class="btn cta">Preguntar</button></form>` : '<div class="notice">Iniciá sesión para publicar una pregunta.</div>'}<div class="question-list">${renderQuestionList(questions)}</div></div>`;
  document.querySelectorAll("[data-media]").forEach((button) => {
    button.onclick = () => {
      const url = button.dataset.media;
      document.querySelector("#galleryMain").innerHTML =
        button.dataset.video === "true"
          ? `<video src="${escapeHtml(url)}" controls autoplay playsinline></video>`
          : `<img src="${escapeHtml(url)}" alt="${escapeHtml(product.name)}">`;
      document
        .querySelectorAll(".gallery-thumb")
        .forEach((thumb) => thumb.classList.toggle("active", thumb === button));
    };
  });
  bindProductActions();
  document
    .querySelector("#questionForm")
    ?.addEventListener("submit", (e) => submitQuestion(e, product));
  document
    .querySelectorAll("[data-answer]")
    .forEach(
      (n) => (n.onclick = () => answerQuestion(product, n.dataset.answer)),
    );
  document.querySelectorAll("[data-delete-question]").forEach((button) => {
    button.onclick = () =>
      deleteQuestion(product, button.dataset.deleteQuestion);
  });
  window.scrollTo(0, 0);
}
function renderQuestionList(questions) {
  if (!questions.length) return "<p>No hay preguntas todavía.</p>";
  return questions
    .map((question) => {
      const canDelete =
        isAdmin() || (state.user && question.user_id === state.user.id);
      return `<div class="question-item"><p><b>${escapeHtml(question.question)}</b></p>${question.answer ? `<p class="answer">Acerosoeste: ${escapeHtml(question.answer)}</p>` : isAdmin() ? `<button class="btn outline" data-answer="${question.id}">Responder</button>` : "<small>Esperando respuesta de Acerosoeste</small>"}${canDelete ? `<button class="text-button danger-text" data-delete-question="${question.id}">Eliminar pregunta</button>` : ""}</div>`;
    })
    .join("");
}
async function deleteQuestion(product, questionId) {
  if (!confirm("¿Querés eliminar esta pregunta?")) return;
  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId);
  if (error) return toast(error.message, "error");
  toast("Pregunta eliminada", "success");
  showProductPage(product.slug);
}
async function submitQuestion(event, product) {
  event.preventDefault();
  const button = event.submitter,
    text = new FormData(event.target).get("question").trim();
  if (!text) return;
  setBusy(button, true);
  const { error } = await supabase
    .from("questions")
    .insert({ product_id: product.id, user_id: state.user.id, question: text });
  setBusy(button, false);
  if (error) return toast(error.message, "error");
  toast("Pregunta publicada");
  showProductPage(product.slug);
}
async function answerQuestion(product, questionId) {
  const answer = prompt("Respuesta de Acerosoeste:");
  if (!answer?.trim()) return;
  const { error } = await supabase
    .from("questions")
    .update({ answer: answer.trim(), answered_at: new Date().toISOString() })
    .eq("id", questionId);
  if (error) return toast(error.message, "error");
  toast("Respuesta publicada");
  showProductPage(product.slug);
}
function showMainSections() {
  document
    .querySelectorAll("main>section")
    .forEach((s) => s.classList.remove("hidden"));
  document.querySelector("#producto").classList.add("hidden");
  document
    .querySelectorAll(".standalone-page")
    .forEach((page) => page.classList.add("hidden"));
}
function showStandalonePage(selector) {
  document
    .querySelectorAll("main>section")
    .forEach((section) => section.classList.add("hidden"));
  document.querySelector(selector)?.classList.remove("hidden");
  window.scrollTo(0, 0);
}
function handleRoute() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!["cuenta", "panel-general"].includes(hash)) stopChatRealtime();
  const recoveryRequested =
    new URLSearchParams(location.search).get("auth") === "recovery";
  const emailConfirmed =
    new URLSearchParams(location.search).get("auth") === "confirmed";
  if (recoveryRequested || state.recoveryMode || hash === "cambiar-contrasena") {
    state.recoveryMode = true;
    showStandalonePage("#cambiar-contrasena");
    renderPasswordUpdate();
  } else if (hash.startsWith("producto/"))
    showProductPage(hash.slice("producto/".length));
  else if (hash.startsWith("cliente/"))
    showClientPage(hash.slice("cliente/".length));
  else if (hash === "cuenta") {
    showStandalonePage("#cuenta");
    renderAccount();
  } else if (hash === "panel-general") {
    if (!isAdmin()) {
      location.hash = "cuenta";
      return;
    }
    showStandalonePage("#panel-general");
    renderAdminPanel();
  } else if (hash === "politicas") {
    showStandalonePage("#politicas");
  } else if (emailConfirmed) {
    showStandalonePage("#cuenta");
    renderAccount();
    history.replaceState(null, "", "/#cuenta");
    toast("Email confirmado. Ya podés usar tu cuenta.", "success");
  } else {
    showMainSections();
    renderCheckoutStatus(hash);
  }
}
function renderCheckoutStatus(hash) {
  if (hash === "checkout/exito") {
    toast(
      "Pago aprobado. Podés consultar el pedido desde Mi cuenta.",
      "success",
    );
    state.cart = [];
    saveCart();
  } else if (hash === "checkout/error")
    toast("El pago no pudo completarse. Tu carrito sigue guardado.", "error");
  else if (hash === "checkout/pendiente")
    toast("El pago quedó pendiente de confirmación.", "info");
}

function addToCart(id) {
  const product = state.products.find((p) => String(p.id) === String(id));
  if (!product || !product.stock) return;
  const item = state.cart.find((i) => String(i.id) === String(id));
  if (item) {
    if (item.qty >= product.stock)
      return toast("No hay más unidades disponibles");
    item.qty++;
  } else state.cart.push({ id: product.id, qty: 1 });
  saveCart();
  toast(`${product.name} agregado al carrito`);
}
function renderCartCount() {
  const countableItems =
    state.loading || state.usingFallback ? state.cart : cartLines();
  document.querySelector(".cart-count").textContent = countableItems.reduce(
    (sum, item) => sum + item.qty,
    0,
  );
}
function openCart() {
  const adjusted = reconcileCart();
  if (adjusted) {
    renderCartCount();
    toast(
      "Actualizamos el carrito porque cambió el stock o un producto ya no está disponible.",
      "info",
    );
  }
  renderCart();
  document.querySelector("#cartDrawer").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeCart() {
  document.querySelector("#cartDrawer").classList.add("hidden");
  document.body.style.overflow = "";
}
function cartLines() {
  return state.cart
    .map((item) => ({
      ...item,
      product: state.products.find((p) => String(p.id) === String(item.id)),
    }))
    .filter((item) => item.product);
}
function renderCart() {
  const wrap = document.querySelector("#cartItems"),
    items = cartLines();
  if (!items.length) {
    wrap.innerHTML =
      '<div class="empty"><h3>Tu carrito está vacío</h3><p>Agregá productos del catálogo para comenzar.</p></div>';
    document.querySelector("#cartSummary").innerHTML = "";
    return;
  }
  wrap.innerHTML = items
    .map(
      (i) =>
        `<div class="cart-item"><div><h4>${escapeHtml(i.product.name)}</h4><small>${money(i.product.price)} c/u</small><div class="qty"><button data-qty="${i.product.id}" data-delta="-1">−</button><b>${i.qty}</b><button data-qty="${i.product.id}" data-delta="1">+</button></div></div><div><b>${money(i.product.price * i.qty)}</b><br><button class="remove" data-remove="${i.product.id}">Eliminar</button></div></div>`,
    )
    .join("");
  const total = items.reduce((sum, i) => sum + i.product.price * i.qty, 0),
    percentage = Number(state.settings.deposit_percentage || 30),
    deposit = (total * percentage) / 100;
  document.querySelector("#cartSummary").innerHTML =
    `<div class="totals"><div class="total-row"><span>Subtotal</span><b>${money(total)}</b></div><div class="total-row grand"><span>Total</span><span>${money(total)}</span></div><div class="pay-options"><label class="pay-option active"><input type="radio" name="paymentType" value="full" checked> <b>Pagar total</b><br>${money(total)}</label><label class="pay-option"><input type="radio" name="paymentType" value="deposit"> <b>Seña ${percentage}%</b><br>${money(deposit)}</label></div><div class="stack"><button class="btn secondary" id="mpBtn">Pagar con Mercado Pago</button><button class="btn cta" id="freightBtn">Coordinar compra y flete</button></div></div>`;
  document
    .querySelectorAll("[data-qty]")
    .forEach(
      (n) =>
        (n.onclick = () => updateQty(n.dataset.qty, Number(n.dataset.delta))),
    );
  document.querySelectorAll("[data-remove]").forEach(
    (n) =>
      (n.onclick = () => {
        state.cart = state.cart.filter(
          (i) => String(i.id) !== n.dataset.remove,
        );
        saveCart();
        renderCart();
      }),
  );
  document
    .querySelectorAll("[name=paymentType]")
    .forEach(
      (r) =>
        (r.onchange = () =>
          document
            .querySelectorAll(".pay-option")
            .forEach((l) =>
              l.classList.toggle("active", l.contains(r) && r.checked),
            )),
    );
  document.querySelector("#mpBtn").onclick = openCheckout;
  document.querySelector("#freightBtn").onclick = () => openFreight(total);
}
function updateQty(id, delta) {
  const item = state.cart.find((i) => String(i.id) === String(id)),
    product = state.products.find((p) => String(p.id) === String(id));
  if (!item || !product) return;
  item.qty = Math.max(1, Math.min(product.stock, item.qty + delta));
  saveCart();
  renderCart();
}
async function getCheckoutSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session || null;
  if (error || !session?.user) return null;

  // En incógnito la sesión persistida puede recuperarse unos instantes antes
  // que el estado visual de la página. Sincronizamos sólo la identidad para no
  // vaciar el carrito que el cliente acaba de preparar.
  if (state.user?.id !== session.user.id) {
    const wasGuest = !state.user;
    state.user = session.user;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    state.profile = profile || null;
    if (wasGuest && state.cart.length) {
      localStorage.setItem(cartStorageKey(), JSON.stringify(state.cart));
      localStorage.removeItem("ao_cart_guest");
    }
    updateSessionNavigation();
  }
  return session;
}
async function openCheckout(event) {
  if (state.usingFallback)
    return toast("El catálogo debe estar conectado para cobrar.", "error");
  const button = event?.currentTarget;
  setBusy(button, true, "Verificando sesión…");
  const session = await getCheckoutSession();
  setBusy(button, false);
  if (!session) {
    closeCart();
    location.hash = "cuenta";
    toast(
      "Tu sesión no está activa. Ingresá nuevamente para continuar con el pago.",
      "info",
    );
    return;
  }
  const paymentType =
    document.querySelector("[name=paymentType]:checked")?.value || "full";
  closeCart();
  openModal(
    `<button class="modal-close" data-close>×</button><p class="eyebrow orange">PAGO SEGURO</p><h2>Datos para tu pedido</h2><form id="checkoutForm" class="form-grid"><div class="field full"><label>Nombre completo</label><input name="name" value="${escapeHtml(state.profile?.full_name || "")}" required></div><div class="field"><label>Email de la cuenta</label><input name="email" type="email" value="${escapeHtml(state.user?.email || "")}" readonly required></div><div class="field"><label>Teléfono</label><input name="phone" value="${escapeHtml(state.profile?.phone || "")}" required></div><input name="paymentType" type="hidden" value="${paymentType}"><button class="btn cta field full" type="submit">Continuar a Mercado Pago</button></form><p><small>El importe se vuelve a calcular de forma segura en el servidor.</small></p>`,
  );
  document.querySelector("#checkoutForm").onsubmit = startPayment;
}
async function startPayment(event) {
  event.preventDefault();
  const button = event.submitter,
    form = Object.fromEntries(new FormData(event.target));
  const adjusted = reconcileCart();
  const checkoutLines = cartLines();
  renderCartCount();
  if (adjusted || !checkoutLines.length) {
    closeModal();
    openCart();
    return toast(
      checkoutLines.length
        ? "El carrito cambió. Revisalo antes de continuar con el pago."
        : "Ese producto ya no está disponible. El carrito fue actualizado.",
      "error",
    );
  }
  setBusy(button, true, "Abriendo Mercado Pago…");
  if (state.user?.id) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: form.name, phone: form.phone })
      .eq("id", state.user.id);
    if (!profileError)
      state.profile = {
        ...state.profile,
        full_name: form.name,
        phone: form.phone,
      };
  }
  const { data, error } = await supabase.functions.invoke(
    "mp-create-preference",
    {
      body: {
        items: checkoutLines.map((item) => ({
          productId: item.product.id,
          quantity: item.qty,
        })),
        paymentType: form.paymentType,
        customer: { name: form.name, email: form.email, phone: form.phone },
      },
    },
  );
  if (error || !data?.initPoint) {
    setBusy(button, false);
    console.error(error || data);
    let backendMessage = data?.error;
    if (!backendMessage && error?.context?.json) {
      try {
        backendMessage = (await error.context.json())?.error;
      } catch {
        // El mensaje general cubre respuestas no JSON.
      }
    }
    return toast(
      backendMessage ||
        error?.message ||
        "No pudimos iniciar el pago. Revisá la configuración de Mercado Pago.",
      "error",
    );
  }
  window.location.assign(data.initPoint);
}
function openFreight(total) {
  closeCart();
  openModal(
    `<button class="modal-close" data-close>×</button><p class="eyebrow orange">COORDINAR ENTREGA</p><h2>Datos para el flete</h2><form id="freightForm" class="form-grid"><div class="field"><label>Nombre</label><input name="name" value="${escapeHtml(state.profile?.full_name || "")}" required></div><div class="field"><label>Teléfono</label><input name="phone" value="${escapeHtml(state.profile?.phone || "")}" required></div><div class="field"><label>Fecha preferida</label><input name="date" type="date" required></div><div class="field"><label>Horario</label><input name="time" type="time" required></div><div class="field full"><label>Dirección de entrega</label><input name="address" required></div><div class="field full"><label>Notas</label><textarea name="notes" rows="3"></textarea></div><button class="btn cta full field">Continuar por WhatsApp →</button></form>`,
  );
  document.querySelector("#freightForm").onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target)),
      lines = cartLines().map(
        (i) =>
          `• ${i.qty}× ${i.product.name} — ${money(i.product.price * i.qty)}`,
      ),
      message = `Hola Acerosoeste, quiero coordinar esta compra:\n\n${lines.join("\n")}\n\nTotal: ${money(total)}\nEntrega: ${d.date} a las ${d.time}\nDirección: ${d.address}\nNombre: ${d.name}\nTeléfono: ${d.phone}\nNotas: ${d.notes || "-"}`;
    window.open(
      `https://wa.me/${state.settings.freight_whatsapp || "5491134322199"}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener",
    );
    closeModal();
  };
}

function renderAccount() {
  const el = document.querySelector("#accountContent"),
    title = document.querySelector("#accountTitle");
  if (!state.user) {
    title.textContent = "Ingresá a tu cuenta";
    el.innerHTML = `<div class="account-switch"><button class="chip active" type="button">Iniciar sesión</button><button class="chip" id="showRegister" type="button">Crear cuenta</button></div><form id="loginForm" class="auth-form"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" placeholder="nombre@email.com" required></div><div class="field"><label>Contraseña</label><input name="password" type="password" autocomplete="current-password" minlength="6" placeholder="Tu contraseña" required></div><button class="btn cta full">Ingresar</button><button class="text-button" id="forgotPassword" type="button">¿Olvidaste tu contraseña?</button></form><p class="auth-help">Si acabás de registrarte, confirmá primero el email que te envió Acerosoeste.</p>`;
    document.querySelector("#loginForm").onsubmit = login;
    document.querySelector("#showRegister").onclick = renderRegister;
    document.querySelector("#forgotPassword").onclick = renderRecovery;
    return;
  }
  title.textContent = "Mi cuenta";
  el.innerHTML = customerDashboard();
  document.querySelector("#logout")?.addEventListener("click", logout);
  if (!isAdmin()) {
    document.querySelector("#accountOrdersTab")?.addEventListener("click", () => {
      setAccountTab("orders");
      document.querySelector("#accountWorkspace").innerHTML =
        '<div id="ordersList"><div class="empty">Cargando pedidos…</div></div>';
      loadOrders();
    });
    document.querySelector("#accountChatTab")?.addEventListener("click", () => {
      setAccountTab("chat");
      openCustomerChat();
    });
    loadOrders();
  }
}
function renderRegister() {
  document.querySelector("#accountTitle").textContent = "Creá tu cuenta";
  document.querySelector("#accountContent").innerHTML =
    `<div class="account-switch"><button class="chip" id="showLogin" type="button">Iniciar sesión</button><button class="chip active" type="button">Crear cuenta</button></div><form id="registerForm" class="auth-form"><div class="field"><label>Nombre completo</label><input name="name" autocomplete="name" required></div><div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>Teléfono</label><input name="phone" autocomplete="tel" required></div><div class="field"><label>Contraseña</label><input name="password" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label>Confirmar contraseña</label><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></div><button class="btn cta full">Crear mi cuenta</button></form><p class="auth-help">Te enviaremos un email para confirmar que la cuenta te pertenece.</p>`;
  document.querySelector("#showLogin").onclick = renderAccount;
  document.querySelector("#registerForm").onsubmit = register;
}
async function login(event) {
  event.preventDefault();
  const button = event.submitter,
    form = Object.fromEntries(new FormData(event.target));
  setBusy(button, true);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: form.email,
    password: form.password,
  });
  setBusy(button, false);
  if (error)
    return toast(
      /confirm/i.test(error.message)
        ? "Primero confirmá tu cuenta desde el email que recibiste."
        : "Email o contraseña incorrectos.",
      "error",
    );
  await applySession(data.session);
  toast("Sesión iniciada", "success");
  location.hash = isAdmin() ? "panel-general" : "cuenta";
}
async function register(event) {
  event.preventDefault();
  const button = event.submitter,
    form = Object.fromEntries(new FormData(event.target));
  if (form.password !== form.confirmPassword)
    return toast("Las contraseñas no coinciden.", "error");
  setBusy(button, true);
  const { data, error } = await supabase.auth.signUp({
    email: form.email,
    password: form.password,
    options: {
      data: { full_name: form.name, phone: form.phone },
      emailRedirectTo: `${location.origin}/?auth=confirmed`,
    },
  });
  setBusy(button, false);
  if (error) return toast(error.message, "error");
  state.pendingSignupEmail = form.email;
  toast(
    data.session
      ? "Cuenta creada."
      : "Revisá tu email para confirmar la cuenta.",
    "success",
  );
  if (data.session) await applySession(data.session);
  if (data.session) renderAccount();
  else renderSignupConfirmation();
}
function renderSignupConfirmation() {
  document.querySelector("#accountTitle").textContent = "Confirmá tu email";
  document.querySelector("#accountContent").innerHTML = `<div class="verification-state"><span class="verification-icon">✉</span><h3>Revisá tu correo</h3><p>Enviamos un enlace de confirmación a <b>${escapeHtml(state.pendingSignupEmail)}</b>. Revisá también Spam o Correo no deseado.</p><button class="btn secondary full" id="resendSignup" type="button">Reenviar verificación</button><button class="text-button" id="backToLogin" type="button">← Volver al ingreso</button></div>`;
  document.querySelector("#backToLogin").onclick = renderAccount;
  document.querySelector("#resendSignup").onclick = resendSignupConfirmation;
}
async function resendSignupConfirmation(event) {
  if (!state.pendingSignupEmail) return renderRegister();
  setBusy(event.currentTarget, true, "Enviando…");
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: state.pendingSignupEmail,
    options: { emailRedirectTo: `${location.origin}/?auth=confirmed` },
  });
  setBusy(event.currentTarget, false);
  toast(
    error ? error.message : "Email reenviado. Revisá también la carpeta Spam.",
    error ? "error" : "success",
  );
}
function renderRecovery() {
  document.querySelector("#accountTitle").textContent =
    "Recuperá tu contraseña";
  document.querySelector("#accountContent").innerHTML =
    `<button class="text-button" id="backToLogin" type="button">← Volver al ingreso</button><div class="recovery-copy"><h3>Te enviaremos un enlace seguro</h3><p>Ingresá el email de tu cuenta. Desde el botón del correo vas a poder elegir una contraseña nueva.</p></div><form id="recoveryForm" class="auth-form"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div><button class="btn cta full">Enviar email de recuperación</button></form>`;
  document.querySelector("#backToLogin").onclick = renderAccount;
  document.querySelector("#recoveryForm").onsubmit = resetPassword;
}
async function resetPassword(event) {
  event.preventDefault();
  const button = event.submitter;
  const email = new FormData(event.target).get("email");
  setBusy(button, true);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Supabase usa el fragmento (#) para transportar la sesión; la ruta de la
    // tienda debe ir en el query string para que no se pierda.
    redirectTo: `${location.origin}/?auth=recovery`,
  });
  setBusy(button, false);
  toast(
    error
      ? error.message
      : "Te enviamos un enlace para recuperar la contraseña.",
    error ? "error" : "success",
  );
}
function showPasswordUpdate() {
  state.recoveryMode = true;
  history.replaceState(null, "", "/?auth=recovery#cambiar-contrasena");
  showStandalonePage("#cambiar-contrasena");
  renderPasswordUpdate();
}
function renderPasswordUpdate() {
  const container = document.querySelector("#passwordUpdateContent");
  container.innerHTML = `<form id="passwordUpdateForm" class="auth-form"><div class="field"><label>Nueva contraseña</label><input name="password" type="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label>Confirmar contraseña</label><input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required></div><button class="btn cta full">Cambiar contraseña</button></form>`;
  document.querySelector("#passwordUpdateForm").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter,
      values = Object.fromEntries(new FormData(event.target));
    if (values.password !== values.confirmPassword)
      return toast("Las contraseñas no coinciden.", "error");
    setBusy(button, true);
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    setBusy(button, false);
    if (error) return toast(error.message, "error");
    state.recoveryMode = false;
    await supabase.auth.signOut();
    history.replaceState(null, "", "/#cuenta");
    updateSessionNavigation();
    renderAccount();
    showStandalonePage("#cuenta");
    toast("Contraseña actualizada. Ingresá nuevamente.", "success");
  };
}
async function logout() {
  stopChatRealtime();
  await supabase.auth.signOut();
  location.hash = "cuenta";
  toast("Sesión cerrada");
}
function customerDashboard() {
  return `<span class="session-badge">${isAdmin() ? "Administrador" : "Cliente"}</span><h3>Hola, ${escapeHtml(state.profile?.full_name || state.user.email)}</h3><p>${escapeHtml(state.user.email)}</p>${isAdmin() ? '<a class="btn cta" href="#panel-general">Abrir panel general</a>' : '<div class="account-tabs"><button class="btn secondary active" id="accountOrdersTab" type="button">Mis pedidos</button><button class="btn secondary" id="accountChatTab" type="button">Chat privado</button></div><div id="accountWorkspace"><div id="ordersList"><div class="empty">Cargando pedidos…</div></div></div>'}<button class="btn outline account-logout" id="logout">Cerrar sesión</button>`;
}
function setAccountTab(tab) {
  if (tab === "orders") stopChatRealtime();
  document
    .querySelector("#accountOrdersTab")
    ?.classList.toggle("active", tab === "orders");
  document
    .querySelector("#accountChatTab")
    ?.classList.toggle("active", tab === "chat");
}
async function loadOrders() {
  if (!state.user || isAdmin()) return;
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });
  const el = document.querySelector("#ordersList");
  if (!el) return;
  if (error) {
    el.innerHTML = '<div class="notice">No pudimos cargar tus pedidos.</div>';
    return;
  }
  const visibleOrders = (data || []).filter(
    (order) => !order.hidden_by_customer,
  );
  el.innerHTML = visibleOrders.length
    ? visibleOrders
        .map(
          (order) =>
            `<article class="customer-order" data-customer-order="${order.id}"><div class="customer-order-title"><b>Pedido ${String(order.id).slice(0, 8).toUpperCase()}</b><span class="badge" style="position:static">${statusLabel(order.status)}</span></div><p>${new Date(order.created_at).toLocaleDateString("es-AR")} · ${money(order.subtotal)}</p><small>${(order.order_items || []).map((i) => `${i.quantity}× ${escapeHtml(i.product_name)}`).join(" · ")}</small><div class="customer-order-actions">${order.status === "pending" ? `<button class="btn danger" data-cancel-order="${order.id}" type="button">Cancelar pedido</button>` : ""}${["cancelled", "fulfilled"].includes(order.status) ? `<button class="btn outline" data-hide-order="${order.id}" type="button">Quitar de mi cuenta</button>` : ""}${["deposit_paid", "paid", "in_transit"].includes(order.status) ? `<a class="btn outline" target="_blank" rel="noopener" href="https://wa.me/${state.settings.sales_whatsapp || "5491134322199"}?text=${encodeURIComponent(`Hola Aceros Oeste, quiero consultar por el pedido ${String(order.id).slice(0, 8).toUpperCase()}`)}">Consultar</a>` : ""}</div></article>`,
        )
        .join("")
    : '<div class="notice">Todavía no tenés pedidos.</div>';
  document.querySelectorAll("[data-cancel-order]").forEach((button) => {
    button.onclick = () => cancelCustomerOrder(button.dataset.cancelOrder, button);
  });
  document.querySelectorAll("[data-hide-order]").forEach((button) => {
    button.onclick = () => hideCustomerOrder(button.dataset.hideOrder, button);
  });
}
async function cancelCustomerOrder(orderId, button) {
  if (!confirm("¿Querés cancelar este pedido pendiente?")) return;
  setBusy(button, true, "Cancelando…");
  const { error } = await supabase.rpc("cancel_own_order", {
    p_order_id: orderId,
  });
  setBusy(button, false);
  if (error)
    return toast(
      "El pedido ya no puede cancelarse desde la cuenta. Contactanos si ya realizaste el pago.",
      "error",
    );
  toast("Pedido cancelado", "success");
  loadOrders();
}
async function hideCustomerOrder(orderId, button) {
  if (!confirm("¿Quitar este pedido de tu historial visible?")) return;
  setBusy(button, true, "Quitando…");
  const { error } = await supabase.rpc("hide_own_order", {
    p_order_id: orderId,
  });
  setBusy(button, false);
  if (error) return toast(error.message, "error");
  toast("Pedido quitado de tu cuenta", "success");
  loadOrders();
}

async function getCustomerConversation() {
  const { data: existing, error: readError } = await supabase
    .from("support_conversations")
    .select("*")
    .eq("user_id", state.user.id)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;
  const { data, error } = await supabase
    .from("support_conversations")
    .insert({ user_id: state.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}
function chatMessagesMarkup(messages) {
  if (!messages.length)
    return '<div class="empty">Todavía no hay mensajes. Escribinos tu consulta y te responderemos desde administración.</div>';
  return messages
    .map(
      (message) =>
        `<div class="chat-message ${message.sender_id === state.user.id ? "mine" : "theirs"}"><p>${escapeHtml(message.body)}</p><small>${new Date(message.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</small></div>`,
    )
    .join("");
}
async function loadConversationMessages(conversationId, target) {
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  target.innerHTML = chatMessagesMarkup(data || []);
  target.scrollTop = target.scrollHeight;
}
function stopChatRealtime() {
  if (!state.chatChannel || !supabase?.removeChannel) return;
  supabase.removeChannel(state.chatChannel);
  state.chatChannel = null;
}
function startChatRealtime(conversationId, refresh) {
  stopChatRealtime();
  if (!supabase?.channel) return;
  state.chatChannel = supabase
    .channel(`support-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      refresh,
    )
    .subscribe();
}
async function sendChatMessage(event, conversationId, refresh) {
  event.preventDefault();
  const button = event.submitter;
  const form = event.currentTarget;
  const body = String(new FormData(form).get("message") || "").trim();
  if (!body) return;
  setBusy(button, true, "Enviando…");
  const { error } = await supabase.from("support_messages").insert({
    conversation_id: conversationId,
    sender_id: state.user.id,
    body,
  });
  setBusy(button, false);
  if (error) return toast(error.message, "error");
  form.reset();
  await refresh();
}
async function openCustomerChat() {
  const workspace = document.querySelector("#accountWorkspace");
  if (!workspace) return;
  workspace.innerHTML = '<div class="empty">Abriendo chat privado…</div>';
  try {
    const conversation = await getCustomerConversation();
    workspace.innerHTML = `<div class="chat-head"><div><h3>Chat con Aceros Oeste</h3><p>Este chat es privado entre tu cuenta y administración.</p></div><button class="btn outline" id="refreshCustomerChat" type="button">Actualizar</button></div><div id="customerChatMessages" class="chat-messages"></div><form id="customerChatForm" class="chat-form"><textarea name="message" maxlength="2000" rows="3" placeholder="Escribí tu consulta…" required></textarea><button class="btn cta" type="submit">Enviar</button></form>`;
    const refresh = () =>
      loadConversationMessages(
        conversation.id,
        document.querySelector("#customerChatMessages"),
      );
    document.querySelector("#refreshCustomerChat").onclick = refresh;
    document.querySelector("#customerChatForm").onsubmit = (event) =>
      sendChatMessage(event, conversation.id, refresh);
    await refresh();
    startChatRealtime(conversation.id, refresh);
  } catch (error) {
    console.error(error);
    workspace.innerHTML = '<div class="notice">No pudimos abrir el chat. Aplicá la última migración de Supabase y volvé a intentar.</div>';
  }
}
function statusLabel(status) {
  return (
    {
      pending: "Pendiente",
      deposit_paid: "Seña pagada",
      paid: "Pagado",
      in_transit: "En camino",
      fulfilled: "Entregado",
      cancelled: "Cancelado",
    }[status] || status
  );
}

function renderAdminPanel() {
  const container = document.querySelector("#adminPanelContent");
  if (!container) return;
  if (!isAdmin()) {
    container.innerHTML =
      '<div class="notice">Acceso exclusivo para administración.</div>';
    return;
  }
  container.innerHTML = adminDashboard();
  bindAdminDashboard();
}
function adminDashboard() {
  return `<div class="admin-metrics"><div class="metric"><b>${state.products.length}</b><small>Productos publicados</small></div><div class="metric"><b>${state.settings.deposit_percentage || 30}%</b><small>Seña configurada</small></div></div><div class="admin-tabs"><button class="btn cta" id="addProduct">+ Crear producto</button><button class="btn secondary" id="productsBtn">Productos</button><button class="btn secondary" id="usersBtn">Usuarios</button><button class="btn secondary" id="categoriesBtn">Categorías</button><button class="btn secondary" id="clientsBtn">Clientes y trabajos</button><button class="btn secondary" id="chatsBtn">Chats</button><button class="btn secondary" id="settingsBtn">Configuración</button><button class="btn secondary" id="ordersBtn">Pedidos</button><button class="btn outline" id="logout">Cerrar sesión</button></div><div id="adminWorkspace">${adminProductsMarkup()}</div>`;
}
function adminProductsMarkup() {
  return `<div class="admin-section-title"><div><h3>Productos publicados</h3><p>Editá o abrí cualquier ficha sin salir del panel.</p></div></div>${state.products.length ? state.products.map((product) => `<div class="admin-row"><b>${escapeHtml(product.name)}</b><span>${money(product.price)}</span><span>Stock: ${product.stock}</span><div class="admin-row-actions"><a class="remove" href="#producto/${encodeURIComponent(product.slug)}">Ver</a><button class="remove" data-edit="${product.id}">Editar</button></div></div>`).join("") : '<div class="notice">Todavía no hay productos publicados.</div>'}`;
}
function bindAdminProductRows() {
  document
    .querySelectorAll("#adminWorkspace [data-edit]")
    .forEach((node) => (node.onclick = () => openEditProduct(node.dataset.edit)));
}
function openAdminProducts() {
  stopChatRealtime();
  document.querySelector("#adminWorkspace").innerHTML = adminProductsMarkup();
  bindAdminProductRows();
}
function bindAdminDashboard() {
  if (!isAdmin()) return;
  document
    .querySelector("#addProduct")
    ?.addEventListener("click", () => openEditProduct());
  document
    .querySelector("#productsBtn")
    ?.addEventListener("click", openAdminProducts);
  document
    .querySelector("#usersBtn")
    ?.addEventListener("click", openAdminUsers);
  document
    .querySelector("#categoriesBtn")
    ?.addEventListener("click", openCategories);
  document
    .querySelector("#clientsBtn")
    ?.addEventListener("click", openClientManager);
  document
    .querySelector("#settingsBtn")
    ?.addEventListener("click", openSettings);
  document
    .querySelector("#ordersBtn")
    ?.addEventListener("click", openAdminOrders);
  document.querySelector("#chatsBtn")?.addEventListener("click", openAdminChats);
  document.querySelector("#logout")?.addEventListener("click", logout);
  bindAdminProductRows();
}
async function openAdminUsers() {
  stopChatRealtime();
  const workspace = document.querySelector("#adminWorkspace");
  workspace.innerHTML = '<div class="empty">Cargando usuarios…</div>';
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,phone,role,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    console.error(error);
    workspace.innerHTML =
      '<div class="notice">No pudimos cargar los usuarios. Aplicá la migración 008 en Supabase y volvé a intentar.</div>';
    return;
  }
  const profiles = Array.isArray(data) ? data : data ? [data] : [];
  workspace.innerHTML = `<div class="admin-section-title"><div><h3>Usuarios registrados</h3><p>Datos de contacto declarados al crear la cuenta.</p></div><span class="session-badge">${profiles.length} usuarios</span></div><label class="admin-user-search"><span>⌕</span><input id="adminUserSearch" type="search" placeholder="Buscar por nombre, email o teléfono"></label><div id="adminUserList" class="admin-user-list">${profiles.length ? profiles.map(adminUserMarkup).join("") : '<div class="notice">Todavía no hay usuarios registrados.</div>'}</div>`;
  document
    .querySelector("#adminUserSearch")
    ?.addEventListener("input", (event) => {
      const term = String(event.target.value || "").trim().toLowerCase();
      document.querySelectorAll("[data-admin-user]").forEach((card) => {
        card.classList.toggle(
          "hidden",
          Boolean(term) && !card.dataset.adminUser.includes(term),
        );
      });
    });
}
function adminUserMarkup(profile) {
  const name = profile.full_name?.trim() || "Sin nombre";
  const email = profile.email?.trim() || "Sin email";
  const phone = profile.phone?.trim() || "Sin teléfono";
  const search = escapeHtml(`${name} ${email} ${phone}`.toLowerCase());
  const phoneDigits = phone.replace(/\D/g, "");
  const whatsapp = phoneDigits
    ? phoneDigits.startsWith("54")
      ? phoneDigits
      : `54${phoneDigits}`
    : "";
  const createdAt = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("es-AR")
    : "Sin fecha";
  return `<article class="admin-user-card" data-admin-user="${search}"><div class="admin-user-primary"><span class="person-icon" aria-hidden="true">●</span><div><b>${escapeHtml(name)}</b><small>${profile.role === "admin" ? "Administrador" : "Cliente"} · Alta ${escapeHtml(createdAt)}</small></div></div><div class="admin-user-details"><span><small>Email</small>${email !== "Sin email" ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : `<b>${email}</b>`}</span><span><small>Teléfono</small><b>${escapeHtml(phone)}</b></span></div><div class="admin-user-actions">${email !== "Sin email" ? `<a class="btn outline" href="mailto:${escapeHtml(email)}">Enviar email</a>` : ""}${whatsapp ? `<a class="btn secondary" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div></article>`;
}
function openCategories() {
  stopChatRealtime();
  const workspace = document.querySelector("#adminWorkspace");
  workspace.innerHTML = `<h3>Categorías del catálogo</h3><form id="categoryForm" class="inline-admin-form"><input name="name" maxlength="70" placeholder="Nombre de la nueva categoría" required><button class="btn cta">Agregar categoría</button></form><div class="category-admin-list">${state.categories.map((category) => `<div class="admin-row"><b>${escapeHtml(category.name)}</b><span>Orden ${category.sort_order || 0}</span><span></span><button class="remove" data-delete-category="${category.id}">Eliminar</button></div>`).join("")}</div>`;
  document.querySelector("#categoryForm").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    const name = String(new FormData(event.target).get("name")).trim();
    const nextOrder =
      Math.max(0, ...state.categories.map((item) => item.sort_order || 0)) + 10;
    setBusy(button, true);
    const { error } = await supabase.from("categories").insert({
      name,
      slug: slugify(name),
      sort_order: nextOrder,
    });
    setBusy(button, false);
    if (error) return toast(error.message, "error");
    await loadStoreData();
    renderAdminPanel();
    openCategories();
    toast("Categoría agregada", "success");
  };
  document.querySelectorAll("[data-delete-category]").forEach((button) => {
    button.onclick = async () => {
      if (!confirm("Los productos quedarán sin categoría. ¿Continuar?")) return;
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", button.dataset.deleteCategory);
      if (error) return toast(error.message, "error");
      await loadStoreData();
      renderAdminPanel();
      openCategories();
      toast("Categoría eliminada", "success");
    };
  });
}
function openClientManager() {
  stopChatRealtime();
  const ws = document.querySelector("#adminWorkspace");
  ws.innerHTML = `<div class="admin-section-title"><div><h3>Clientes y trabajos</h3><p>Publicá marcas y fotos de los trabajos realizados.</p></div><button class="btn cta" id="addClient">+ Agregar cliente</button></div><div class="client-admin-list">${state.clients.map((client) => `<div class="admin-row"><b>${escapeHtml(client.name)}</b><span>${escapeHtml(client.category || "Cliente")}</span><span>${client.images?.length || 0} fotos</span><div><button class="remove" data-edit-client="${client.id}">Editar</button> <button class="remove" data-delete-client="${client.id}">Eliminar</button></div></div>`).join("") || '<div class="notice">Todavía no agregaste clientes.</div>'}</div>`;
  document.querySelector("#addClient").onclick = () => openClientEditor();
  document.querySelectorAll("[data-edit-client]").forEach((button) => button.onclick = () => openClientEditor(button.dataset.editClient));
  document.querySelectorAll("[data-delete-client]").forEach((button) => {
    button.onclick = async () => {
      if (!confirm("¿Eliminar este cliente y su publicación?")) return;
      const { error } = await supabase.from("client_projects").delete().eq("id", button.dataset.deleteClient);
      if (error) return toast(error.message, "error");
      await loadStoreData(); renderAdminPanel(); openClientManager(); toast("Cliente eliminado", "success");
    };
  });
}
function openClientEditor(id) {
  const client = state.clients.find((item) => item.id === id) || { name: "", category: "Gastronomía", description: "", logo_url: "", images: [], sort_order: 0 };
  openModal(`<button class="modal-close" data-close>×</button><p class="eyebrow orange">${id ? "EDITAR" : "NUEVO"} CLIENTE</p><h2>${id ? "Actualizar publicación" : "Agregar cliente"}</h2><form id="clientForm" class="form-grid"><div class="field"><label>Nombre</label><input name="name" value="${escapeHtml(client.name)}" required></div><div class="field"><label>Rubro</label><input name="category" value="${escapeHtml(client.category)}"></div><div class="field full"><label>Descripción del trabajo</label><textarea name="description" rows="3">${escapeHtml(client.description)}</textarea></div><div class="field"><label>Orden</label><input name="sort_order" type="number" value="${Number(client.sort_order) || 0}"></div><div class="field"><label><input name="is_active" type="checkbox" ${client.is_active === false ? "" : "checked"}> Visible</label></div><div class="field full"><label class="image-upload-label">Logo del cliente<input id="clientLogo" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>${client.logo_url ? `<img class="preview-admin-img" src="${escapeHtml(client.logo_url)}" alt="Logo actual">` : ""}</div><div class="field full"><label class="image-upload-label">Fotos de trabajos<input id="clientPhotos" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label><div class="media-admin-grid">${(client.images || []).map((url) => `<label class="media-admin-item"><img src="${escapeHtml(url)}" alt="Trabajo"><span><input type="checkbox" value="${escapeHtml(url)}" data-remove-client-photo> Quitar</span></label>`).join("")}</div></div><button class="btn cta field full">Guardar cliente</button></form>`);
  document.querySelector("#clientForm").onsubmit = (event) => saveClient(event, client);
}
async function saveClient(event, current) {
  event.preventDefault();
  const button = event.submitter;
  const values = Object.fromEntries(new FormData(event.target));
  values.sort_order = Number(values.sort_order) || 0;
  values.is_active = Boolean(values.is_active);
  setBusy(button, true, "Guardando…");
  try {
    const logoFile = document.querySelector("#clientLogo").files[0];
    const photoFiles = [...document.querySelector("#clientPhotos").files];
    const uploadedLogo = logoFile ? (await uploadProductMedia([logoFile]))[0] : current.logo_url || null;
    const removed = new Set([...document.querySelectorAll("[data-remove-client-photo]:checked")].map((input) => input.value));
    const kept = (current.images || []).filter((url) => !removed.has(url));
    const uploadedPhotos = await uploadProductMedia(photoFiles);
    Object.assign(values, { logo_url: uploadedLogo, images: [...kept, ...uploadedPhotos], updated_at: new Date().toISOString() });
    const query = current.id ? supabase.from("client_projects").update(values).eq("id", current.id) : supabase.from("client_projects").insert(values);
    const { error } = await query;
    if (error) throw error;
    closeModal(); await loadStoreData(); renderAdminPanel(); openClientManager(); toast("Cliente guardado", "success");
  } catch (error) {
    toast(error.message || "No se pudo guardar el cliente", "error");
  } finally {
    setBusy(button, false);
  }
}
function openSettings() {
  stopChatRealtime();
  const ws = document.querySelector("#adminWorkspace");
  ws.innerHTML = `<h3>Configuración de la tienda</h3><form id="settingsForm" class="form-grid"><div class="field"><label>Porcentaje de seña</label><input name="deposit_percentage" type="number" min="1" max="100" value="${state.settings.deposit_percentage || 30}"></div><div class="field"><label>WhatsApp de ventas</label><input name="sales_whatsapp" value="${escapeHtml(state.settings.sales_whatsapp || "")}"></div><div class="field full"><label>Email de contacto</label><input name="contact_email" type="email" value="${escapeHtml(state.settings.contact_email || "")}"></div><button class="btn secondary">Guardar</button></form>`;
  document.querySelector("#settingsForm").onsubmit = async (e) => {
    e.preventDefault();
    const button = e.submitter,
      values = Object.fromEntries(new FormData(e.target));
    values.deposit_percentage = Number(values.deposit_percentage);
    setBusy(button, true);
    const { data, error } = await supabase
      .from("store_settings")
      .update(values)
      .eq("id", 1)
      .select()
      .single();
    setBusy(button, false);
    if (error) return toast(error.message, "error");
    state.settings = { ...state.settings, ...data };
    renderAccount();
    toast("Configuración guardada", "success");
  };
}
async function openAdminChats() {
  stopChatRealtime();
  const workspace = document.querySelector("#adminWorkspace");
  workspace.innerHTML = '<div class="empty">Cargando conversaciones…</div>';
  const { data: conversations, error } = await supabase
    .from("support_conversations")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error(error);
    workspace.innerHTML = '<div class="notice">No pudimos cargar los chats. Aplicá la última migración de Supabase.</div>';
    return;
  }
  const userIds = [...new Set((conversations || []).map((item) => item.user_id))];
  let profiles = [];
  if (userIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", userIds);
    profiles = Array.isArray(data) ? data : data ? [data] : [];
  }
  const profileNames = Object.fromEntries(
    profiles.map((profile) => [profile.id, profile.full_name]),
  );
  workspace.innerHTML = `<div class="admin-section-title"><div><h3>Chats privados</h3><p>Consultas de clientes autenticados. Usá Actualizar para ver mensajes nuevos.</p></div><button class="btn outline" id="refreshAdminChats" type="button">Actualizar</button></div><div class="admin-chat-list">${conversations?.length ? conversations.map((conversation) => {
    const name = profileNames[conversation.user_id] || "Cliente";
    return `<button class="admin-chat-card" type="button" data-open-admin-chat="${conversation.id}" data-admin-chat-name="${escapeHtml(name)}"><span><b>${escapeHtml(name)}</b><small>${conversation.status === "closed" ? "Cerrado" : "Abierto"}</small></span><time>${new Date(conversation.updated_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</time></button>`;
  }).join("") : '<div class="notice">Todavía no hay conversaciones.</div>'}</div>`;
  document.querySelector("#refreshAdminChats").onclick = openAdminChats;
  document.querySelectorAll("[data-open-admin-chat]").forEach((button) => {
    button.onclick = () =>
      openAdminConversation(
        button.dataset.openAdminChat,
        button.dataset.adminChatName,
      );
  });
}
async function openAdminConversation(conversationId, customerName) {
  const workspace = document.querySelector("#adminWorkspace");
  workspace.innerHTML = `<div class="chat-head"><div><button class="text-button" id="backToAdminChats" type="button">← Volver a chats</button><h3>${escapeHtml(customerName || "Cliente")}</h3><p>Conversación privada con administración.</p></div><button class="btn outline" id="refreshAdminConversation" type="button">Actualizar</button></div><div id="adminChatMessages" class="chat-messages"></div><form id="adminChatForm" class="chat-form"><textarea name="message" maxlength="2000" rows="3" placeholder="Responder al cliente…" required></textarea><button class="btn cta" type="submit">Enviar respuesta</button></form>`;
  const refresh = () =>
    loadConversationMessages(
      conversationId,
      document.querySelector("#adminChatMessages"),
    );
  document.querySelector("#backToAdminChats").onclick = openAdminChats;
  document.querySelector("#refreshAdminConversation").onclick = refresh;
  document.querySelector("#adminChatForm").onsubmit = (event) =>
    sendChatMessage(event, conversationId, refresh);
  try {
    await refresh();
    startChatRealtime(conversationId, refresh);
  } catch (error) {
    console.error(error);
    document.querySelector("#adminChatMessages").innerHTML =
      '<div class="notice">No pudimos cargar esta conversación.</div>';
  }
}
async function openAdminOrders() {
  stopChatRealtime();
  const ws = document.querySelector("#adminWorkspace");
  ws.innerHTML = '<div class="empty">Cargando pedidos…</div>';
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    ws.innerHTML = '<div class="notice">No pudimos cargar los pedidos.</div>';
    return;
  }
  ws.innerHTML = `<h3>Pedidos</h3>${data?.length ? data.map((o) => `<article class="customer-order" data-order-card="${o.id}"><div class="order-heading"><div><small>CLIENTE</small><b>${escapeHtml(o.customer_name || "Sin nombre")}</b></div><span>Pedido ${String(o.id).slice(0, 8).toUpperCase()}</span></div><div class="order-details"><span><small>Email</small>${escapeHtml(o.customer_email || "Sin email")}</span><span><small>Teléfono</small>${escapeHtml(o.customer_phone || "Sin teléfono")}</span><span><small>Total</small>${money(o.subtotal)}</span></div>${o.order_items?.length ? `<div class="order-items">${o.order_items.map((item) => `<span>${Number(item.quantity) || 0}× ${escapeHtml(item.product_name || "Producto")}</span>`).join("")}</div>` : ""}<label class="order-status-label">Estado<select data-order-status="${o.id}">${["pending", "deposit_paid", "paid", "in_transit", "fulfilled", "cancelled"].map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}</select></label>${["fulfilled", "cancelled"].includes(o.status) ? `<button class="btn danger" data-delete-order="${o.id}">Eliminar pedido</button>` : ""}</article>`).join("") : '<div class="notice">No hay pedidos.</div>'}`;
  document.querySelectorAll("[data-order-status]").forEach(
    (select) =>
      (select.onchange = async () => {
        const { error } = await supabase
          .from("orders")
          .update({ status: select.value })
          .eq("id", select.dataset.orderStatus);
        if (!error && select.value === "in_transit") {
          const { error: emailError } = await supabase.functions.invoke(
            "send-order-email",
            {
              body: { orderId: select.dataset.orderStatus, type: "in_transit" },
            },
          );
          if (emailError)
            toast("Estado guardado, pero no se pudo enviar el email.", "error");
        }
        toast(
          error ? error.message : "Estado actualizado",
          error ? "error" : "success",
        );
        if (!error && ["fulfilled", "cancelled"].includes(select.value))
          openAdminOrders();
      }),
  );
  document.querySelectorAll("[data-delete-order]").forEach((button) => {
    button.onclick = async () => {
      if (!confirm("¿Eliminar definitivamente este pedido finalizado?")) return;
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", button.dataset.deleteOrder)
        .in("status", ["fulfilled", "cancelled"]);
      if (error) return toast(error.message, "error");
      button.closest("[data-order-card]")?.remove();
      toast("Pedido eliminado", "success");
    };
  });
}

function openEditProduct(id) {
  if (!isAdmin()) return;
  const product = state.products.find((p) => String(p.id) === String(id)) || {
    id: null,
    name: "",
    categoryId: state.categories[0]?.id,
    price: "",
    stock: "",
    sku: "",
    images: [],
    desc: "",
    details: "",
  };
  openModal(
    `<button class="modal-close" data-close>×</button><p class="eyebrow orange">${id ? "EDITAR" : "NUEVO"} PRODUCTO</p><h2>${id ? "Actualizar publicación" : "Crear publicación"}</h2><form id="productForm" class="form-grid"><div class="field full"><label>Nombre</label><input name="name" value="${escapeHtml(product.name)}" required></div><div class="field"><label>Categoría</label><select name="category_id">${state.categories.map((c) => `<option value="${c.id}" ${product.categoryId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select></div><div class="field"><label>SKU</label><input name="sku" value="${escapeHtml(product.sku)}" required></div><div class="field"><label>Precio</label><input name="price" type="number" min="0" step="0.01" value="${product.price}" required></div><div class="field"><label>Stock</label><input name="stock_quantity" type="number" min="0" value="${product.stock}" required></div><div class="field full"><label>Descripción principal</label><textarea name="description" rows="3" required>${escapeHtml(product.desc)}</textarea></div><div class="field full"><label>Detalles adicionales</label><textarea name="details" rows="3">${escapeHtml(product.details)}</textarea></div><div class="field"><label class="image-upload-label">Seleccionar fotos<input id="productPhotos" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label><small>Elegí varias fotos a la vez, hasta 5 MB cada una.</small></div><div class="field"><label class="image-upload-label">Seleccionar videos<input id="productVideos" type="file" accept="video/mp4,video/webm" multiple hidden></label><small>MP4 o WebM, hasta 50 MB por video.</small></div><div class="field full"><p class="field-caption">Galería actual y archivos nuevos</p><div id="existingMedia" class="media-admin-grid">${(product.images || []).map((url, index) => `<label class="media-admin-item">${isVideoUrl(url) ? `<video src="${escapeHtml(url)}" muted></video>` : `<img src="${escapeHtml(url)}" alt="Medio ${index + 1}">`}<span><input type="checkbox" value="${escapeHtml(url)}" data-remove-media> Quitar</span></label>`).join("")}</div><div id="newMediaPreview" class="media-admin-grid"></div></div><button class="btn cta">${id ? "Guardar cambios" : "Publicar producto"}</button>${id ? '<button class="btn danger" id="deleteInForm" type="button">Eliminar producto</button>' : ""}</form>`,
  );
  const photoInput = document.querySelector("#productPhotos");
  const videoInput = document.querySelector("#productVideos");
  const selectedMedia = () => [...photoInput.files, ...videoInput.files];
  const renderNewMediaPreview = () => {
    const files = selectedMedia();
    const invalid = files.find((file) =>
      file.type.startsWith("video/")
        ? file.size > 50_000_000
        : file.size > 5_000_000,
    );
    if (invalid) {
      toast(`${invalid.name} supera el tamaño permitido.`, "error");
      if (invalid.type.startsWith("video/")) videoInput.value = "";
      else photoInput.value = "";
      renderNewMediaPreview();
      return;
    }
    document.querySelector("#newMediaPreview").innerHTML = files
      .map((file) => {
        const url = URL.createObjectURL(file);
        return file.type.startsWith("video/")
          ? `<video src="${url}" muted controls></video>`
          : `<img src="${url}" alt="Nueva foto">`;
      })
      .join("");
  };
  photoInput.onchange = renderNewMediaPreview;
  videoInput.onchange = renderNewMediaPreview;
  document.querySelector("#productForm").onsubmit = (e) =>
    saveProduct(e, product, selectedMedia());
  document.querySelector("#deleteInForm")?.addEventListener("click", () => {
    closeModal();
    deleteProduct(id);
  });
}
async function uploadProductMedia(files) {
  const urls = [];
  for (const file of files) {
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    urls.push(
      supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl,
    );
  }
  return urls;
}
async function saveProduct(event, current, files) {
  event.preventDefault();
  const button = event.submitter,
    values = Object.fromEntries(new FormData(event.target));
  values.price = Number(values.price);
  values.stock_quantity = Number(values.stock_quantity);
  values.slug = current.id ? current.slug : slugify(values.name);
  values.is_active = true;
  setBusy(button, true, "Guardando…");
  try {
    const removed = new Set(
      [...document.querySelectorAll("[data-remove-media]:checked")].map(
        (input) => input.value,
      ),
    );
    const kept = (current.images || []).filter((url) => !removed.has(url));
    const uploaded = await uploadProductMedia(files);
    values.images = [...kept, ...uploaded];
    const query = current.id
      ? supabase.from("products").update(values).eq("id", current.id)
      : supabase.from("products").insert(values);
    const { error } = await query;
    if (error) throw error;
    await loadStoreData();
    closeModal();
    renderAccount();
    renderAdminPanel();
    toast(
      current.id ? "Producto actualizado" : "Producto publicado",
      "success",
    );
  } catch (error) {
    console.error(error);
    toast(error.message || "No se pudo guardar el producto", "error");
  } finally {
    setBusy(button, false);
  }
}
async function deleteProduct(id) {
  if (!isAdmin() || !confirm("¿Seguro que querés eliminar este producto?"))
    return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return toast(error.message, "error");
  state.cart = state.cart.filter((i) => String(i.id) !== String(id));
  saveCart();
  await loadStoreData();
  renderAccount();
  renderAdminPanel();
  if (location.hash.startsWith("#producto/")) location.hash = "productos";
  toast("Producto eliminado", "success");
}

function openModal(html) {
  document.querySelector("#modalPanel").innerHTML = html;
  document.querySelector("#modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  document
    .querySelectorAll("[data-close]")
    .forEach((n) => (n.onclick = closeModal));
}
function closeModal() {
  document.querySelector("#modal").classList.add("hidden");
  document.body.style.overflow = "";
}
function bindStaticEvents() {
  document.querySelector("#searchInput").oninput = (e) => {
    state.search = e.target.value;
    state.visibleCount = 24;
    renderProducts();
  };
  document
    .querySelectorAll("[data-open-cart]")
    .forEach((n) => (n.onclick = openCart));
  document
    .querySelectorAll("[data-close-cart]")
    .forEach((n) => (n.onclick = closeCart));
  document.querySelector(".menu-btn").onclick = () =>
    document.querySelector(".nav-links").classList.toggle("open");
  document
    .querySelectorAll(".nav-links a")
    .forEach(
      (n) =>
        (n.onclick = () =>
          document.querySelector(".nav-links").classList.remove("open")),
    );
  document.querySelector("#backToProducts").onclick = () =>
    (location.hash = "productos");
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeCart();
    }
  });
  window.addEventListener("hashchange", handleRoute);
}

async function init() {
  bindStaticEvents();
  renderCartCount();
  renderProducts();
  renderAccount();
  if (!supabase || !hasSupabaseConfig) {
    state.products = fallbackProducts;
    state.categories = [
      ...new Set(fallbackProducts.map((product) => product.category)),
    ].map((name, index) => ({
      id: `demo-cat-${index}`,
      name,
      slug: slugify(name),
    }));
    state.loading = false;
    state.usingFallback = true;
    renderCategories();
    renderProducts();
    toast(
      "No se pudo conectar con la tienda. Reintentá en unos minutos.",
      "error",
    );
    return;
  }
  await Promise.all([loadStoreData(), restoreSession()]);
}
init().catch((error) => {
  console.error(error);
  toast("Ocurrió un error al iniciar la tienda.", "error");
});
