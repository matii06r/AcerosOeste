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
  document.querySelector(".cart-count").textContent = state.cart.reduce(
    (sum, item) => sum + item.qty,
    0,
  );
}
function openCart() {
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
function openCheckout() {
  if (state.usingFallback)
    return toast("El catálogo debe estar conectado para cobrar.", "error");
  const paymentType =
    document.querySelector("[name=paymentType]:checked")?.value || "full";
  closeCart();
  openModal(
    `<button class="modal-close" data-close>×</button><p class="eyebrow orange">PAGO SEGURO</p><h2>Datos para tu pedido</h2><form id="checkoutForm" class="form-grid"><div class="field full"><label>Nombre completo</label><input name="name" value="${escapeHtml(state.profile?.full_name || "")}" required></div><div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(state.user?.email || "")}" required></div><div class="field"><label>Teléfono</label><input name="phone" value="${escapeHtml(state.profile?.phone || "")}" required></div><input name="paymentType" type="hidden" value="${paymentType}"><button class="btn cta field full" type="submit">Continuar a Mercado Pago</button></form><p><small>El importe se vuelve a calcular de forma segura en el servidor.</small></p>`,
  );
  document.querySelector("#checkoutForm").onsubmit = startPayment;
}
async function startPayment(event) {
  event.preventDefault();
  const button = event.submitter,
    form = Object.fromEntries(new FormData(event.target));
  setBusy(button, true, "Abriendo Mercado Pago…");
  const { data, error } = await supabase.functions.invoke(
    "mp-create-preference",
    {
      body: {
        items: state.cart.map((i) => ({ productId: i.id, quantity: i.qty })),
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
  loadOrders();
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
  await supabase.auth.signOut();
  location.hash = "cuenta";
  toast("Sesión cerrada");
}
function customerDashboard() {
  return `<span class="session-badge">${isAdmin() ? "Administrador" : "Cliente"}</span><h3>Hola, ${escapeHtml(state.profile?.full_name || state.user.email)}</h3><p>${escapeHtml(state.user.email)}</p>${isAdmin() ? '<a class="btn cta" href="#panel-general">Abrir panel general</a>' : '<div id="ordersList"><div class="empty">Cargando pedidos…</div></div>'}<button class="btn outline" id="logout">Cerrar sesión</button>`;
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
  el.innerHTML = data?.length
    ? data
        .map(
          (order) =>
            `<article class="customer-order"><b>Pedido ${String(order.id).slice(0, 8).toUpperCase()}</b><span class="badge" style="position:static;float:right">${statusLabel(order.status)}</span><p>${new Date(order.created_at).toLocaleDateString("es-AR")} · ${money(order.subtotal)}</p><small>${(order.order_items || []).map((i) => `${i.quantity}× ${escapeHtml(i.product_name)}`).join(" · ")}</small></article>`,
        )
        .join("")
    : '<div class="notice">Todavía no tenés pedidos.</div>';
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
  return `<div class="admin-metrics"><div class="metric"><b>${state.products.length}</b><small>Productos publicados</small></div><div class="metric"><b>${state.settings.deposit_percentage || 30}%</b><small>Seña configurada</small></div></div><div class="admin-tabs"><button class="btn cta" id="addProduct">+ Crear producto</button><button class="btn secondary" id="categoriesBtn">Categorías</button><button class="btn secondary" id="clientsBtn">Clientes y trabajos</button><button class="btn secondary" id="settingsBtn">Configuración</button><button class="btn secondary" id="ordersBtn">Pedidos</button><button class="btn outline" id="logout">Cerrar sesión</button></div><div id="adminWorkspace"><h3>Productos publicados</h3>${state.products.map((p) => `<div class="admin-row"><b>${escapeHtml(p.name)}</b><span>${money(p.price)}</span><span>Stock: ${p.stock}</span><button class="remove" data-edit="${p.id}">Editar</button></div>`).join("")}</div>`;
}
function bindAdminDashboard() {
  if (!isAdmin()) return;
  document
    .querySelector("#addProduct")
    ?.addEventListener("click", () => openEditProduct());
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
  document
    .querySelectorAll("#adminWorkspace [data-edit]")
    .forEach((n) => (n.onclick = () => openEditProduct(n.dataset.edit)));
}
function openCategories() {
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
async function openAdminOrders() {
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
    `<button class="modal-close" data-close>×</button><p class="eyebrow orange">${id ? "EDITAR" : "NUEVO"} PRODUCTO</p><h2>${id ? "Actualizar publicación" : "Crear publicación"}</h2><form id="productForm" class="form-grid"><div class="field full"><label>Nombre</label><input name="name" value="${escapeHtml(product.name)}" required></div><div class="field"><label>Categoría</label><select name="category_id">${state.categories.map((c) => `<option value="${c.id}" ${product.categoryId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select></div><div class="field"><label>SKU</label><input name="sku" value="${escapeHtml(product.sku)}" required></div><div class="field"><label>Precio</label><input name="price" type="number" min="0" step="0.01" value="${product.price}" required></div><div class="field"><label>Stock</label><input name="stock_quantity" type="number" min="0" value="${product.stock}" required></div><div class="field full"><label>Descripción principal</label><textarea name="description" rows="3" required>${escapeHtml(product.desc)}</textarea></div><div class="field full"><label>Detalles adicionales</label><textarea name="details" rows="3">${escapeHtml(product.details)}</textarea></div><div class="field full"><label class="image-upload-label">Agregar fotos o videos<input id="productMedia" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" multiple hidden></label><small>Podés seleccionar varios archivos. Fotos hasta 5 MB y videos hasta 50 MB.</small><div id="existingMedia" class="media-admin-grid">${(product.images || []).map((url, index) => `<label class="media-admin-item">${isVideoUrl(url) ? `<video src="${escapeHtml(url)}" muted></video>` : `<img src="${escapeHtml(url)}" alt="Medio ${index + 1}">`}<span><input type="checkbox" value="${escapeHtml(url)}" data-remove-media> Quitar</span></label>`).join("")}</div><div id="newMediaPreview" class="media-admin-grid"></div></div><button class="btn cta">${id ? "Guardar cambios" : "Publicar producto"}</button>${id ? '<button class="btn danger" id="deleteInForm" type="button">Eliminar producto</button>' : ""}</form>`,
  );
  const mediaInput = document.querySelector("#productMedia");
  mediaInput.onchange = () => {
    const files = [...mediaInput.files];
    const invalid = files.find((file) =>
      file.type.startsWith("video/")
        ? file.size > 50_000_000
        : file.size > 5_000_000,
    );
    if (invalid) {
      toast(`${invalid.name} supera el tamaño permitido.`, "error");
      mediaInput.value = "";
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
  document.querySelector("#productForm").onsubmit = (e) =>
    saveProduct(e, product, [...mediaInput.files]);
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
