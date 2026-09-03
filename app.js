const money = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
const ADMIN_CONTACT_EMAIL = "gestionacerosoestee@gmail.com";
const LEGACY_ADMIN_EMAIL = "gestionacerosoeste@gmail.com";
const TERMS_VERSION = "2026-08-31-v2";
const PRIMARY_WHATSAPP = "5491161781074";
const HOME_PRODUCT_LIMIT = 20;
const CATALOG_PAGE_SIZE = 24;
const HOME_CATEGORY_LIMIT = 5;
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
const avatarPresets = [
  { id: "orange", label: "Naranja" },
  { id: "blue", label: "Azul" },
  { id: "red", label: "Rojo" },
  { id: "purple", label: "Violeta" },
  { id: "pink", label: "Rosa" },
  { id: "green", label: "Verde" },
  { id: "sky", label: "Celeste" },
];
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
  settings: {
    deposit_percentage: 50,
    freight_whatsapp: PRIMARY_WHATSAPP,
    sales_whatsapp: PRIMARY_WHATSAPP,
    contact_email: ADMIN_CONTACT_EMAIL,
    vat_rate: 21,
    payment_fee_rate: 7,
    commercial_margin_rate: 0,
    pricing_rounding: 100,
    invoice_mode: "assisted",
    issuer_tax_status: "pending_accountant",
  },
  user: null,
  profile: null,
  filter: "Todos",
  search: "",
  visibleCount: CATALOG_PAGE_SIZE,
  loading: true,
  usingFallback: false,
  chatChannel: null,
  liveChannel: null,
  accountView: "orders",
  adminView: "products",
  productEditorId: null,
  verifyingCheckout: false,
  activeConversationId: null,
  activeConversationName: "",
  activeOrderId: null,
  notifications: [],
};
const realtimeTimers = new Map();
let revealObserver = null;
const isAdmin = () => state.profile?.role === "admin";
const normalizedContactEmail = (value) => {
  const email = String(value || "").trim();
  return !email || email.toLowerCase() === LEGACY_ADMIN_EMAIL
    ? ADMIN_CONTACT_EMAIL
    : email;
};
const accountDisplayEmail = () =>
  isAdmin()
    ? normalizedContactEmail(state.settings?.contact_email)
    : String(state.user?.email || "").trim();
const normalizedWhatsapp = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return !digits || ["1134322199", "5491134322199"].includes(digits)
    ? PRIMARY_WHATSAPP
    : digits;
};
const cartStorageKey = () => `ao_cart_${state.user?.id || "guest"}`;
const pendingCheckoutKey = "ao_pending_checkout";
const storeCacheKey = "ao_store_cache_v1";
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
function avatarMarkup(profile = {}, className = "user-avatar") {
  const url = String(profile?.avatar_url || "").trim();
  const preset =
    avatarPresets.find((item) => item.id === profile?.avatar_preset) ||
    avatarPresets.find((item) => item.id === "blue");
  const initial =
    String(profile?.full_name || profile?.email || "U")
      .trim()
      .slice(0, 1)
      .toUpperCase() || "U";
  return `<span class="${escapeHtml(className)} avatar-${escapeHtml(preset.id)}" aria-hidden="true">${url ? `<img src="${escapeHtml(url)}" alt="">` : `<b>${escapeHtml(initial)}</b>`}</span>`;
}
function rememberPendingCheckout(orderId, lines) {
  localStorage.setItem(
    pendingCheckoutKey,
    JSON.stringify({
      orderId,
      userId: state.user?.id || null,
      createdAt: new Date().toISOString(),
      items: lines.map((line) => ({
        id: line.product.id,
        qty: Math.max(1, Number(line.qty) || 1),
      })),
    }),
  );
}
function removePaidItemsFromCart(checkout) {
  const purchased = new Map(
    (checkout?.items || []).map((item) => [
      String(item.id),
      Math.max(1, Number(item.qty) || 1),
    ]),
  );
  state.cart = state.cart
    .map((item) => ({
      ...item,
      qty: item.qty - (purchased.get(String(item.id)) || 0),
    }))
    .filter((item) => item.qty > 0);
  saveCart();
  renderCart();
}
async function syncPaidCheckoutCart({ retry = false, notify = false } = {}) {
  if (!supabase || state.verifyingCheckout) return false;
  const checkout = safeRead(pendingCheckoutKey, null);
  if (!checkout?.orderId) return false;
  state.verifyingCheckout = true;
  try {
    const session = await getCheckoutSession();
    if (!session?.user || checkout.userId !== session.user.id) return false;
    const attempts = retry ? 8 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status")
        .eq("id", checkout.orderId)
        .maybeSingle();
      if (!error && ["deposit_paid", "paid", "in_transit", "fulfilled"].includes(data?.status)) {
        removePaidItemsFromCart(checkout);
        localStorage.removeItem(pendingCheckoutKey);
        if (notify)
          toast(
            "Pago acreditado. Quitamos del carrito los productos de esta compra.",
            "success",
          );
        return true;
      }
      if (attempt < attempts - 1)
        await new Promise((resolve) => setTimeout(resolve, 900));
    }
    return false;
  } finally {
    state.verifyingCheckout = false;
  }
}
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
function readableFunctionError(message, fallback) {
  const value = String(message || "").trim();
  return /non-2xx|failed to send a request to the edge function/i.test(value)
    ? fallback
    : value || fallback;
}
const busyButtonMarkup = new WeakMap();
function setBusy(button, busy, text = "Procesando…") {
  if (!button) return;
  if (busy) {
    if (!busyButtonMarkup.has(button))
      busyButtonMarkup.set(button, button.innerHTML);
    button.textContent = text;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  } else {
    if (busyButtonMarkup.has(button)) {
      button.innerHTML = busyButtonMarkup.get(button);
      busyButtonMarkup.delete(button);
    }
    button.disabled = false;
    button.removeAttribute("aria-busy");
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
    saleType: row.sale_type || "standard",
  };
}

function saleTypeLabel(value) {
  return (
    {
      standard: "Producto estándar",
      customizable: "Estándar personalizable",
      made_to_order: "Fabricado a medida",
    }[value] || "Producto estándar"
  );
}

function suggestedFinalPrice({
  baseNetPrice,
  vatRate,
  paymentFeeRate,
  commercialMarginRate,
  roundingUnit,
}) {
  const base = Math.max(0, Number(baseNetPrice) || 0);
  const vat = Math.max(0, Number(vatRate) || 0) / 100;
  const fee = Math.min(0.99, Math.max(0, Number(paymentFeeRate) || 0) / 100);
  const margin = Math.max(0, Number(commercialMarginRate) || 0) / 100;
  const raw = (base * (1 + margin) * (1 + vat)) / (1 - fee);
  const rounding = Math.max(0, Number(roundingUnit) || 0);
  return rounding ? Math.ceil(raw / rounding) * rounding : Math.round(raw * 100) / 100;
}

function restoreStoreCache() {
  const cached = safeRead(storeCacheKey, null);
  if (!cached?.products || !Array.isArray(cached.products)) return false;
  state.products = cached.products;
  state.categories = Array.isArray(cached.categories) ? cached.categories : [];
  state.clients = Array.isArray(cached.clients) ? cached.clients : [];
  if (cached.settings)
    state.settings = {
      ...cached.settings,
      freight_whatsapp: normalizedWhatsapp(cached.settings.freight_whatsapp),
      sales_whatsapp: normalizedWhatsapp(cached.settings.sales_whatsapp),
    };
  state.loading = false;
  state.usingFallback = false;
  return true;
}
function persistStoreCache() {
  try {
    localStorage.setItem(
      storeCacheKey,
      JSON.stringify({
        products: state.products,
        categories: state.categories,
        clients: state.clients,
        settings: state.settings,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn("No se pudo guardar el catálogo local", error);
  }
}

async function loadStoreData({ route = true, retry = true } = {}) {
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
  if (!clientsError) state.clients = clients || [];
  if (catError || productError) {
    console.error(catError || productError);
    const keptCatalog = Boolean(state.products.length) || restoreStoreCache();
    state.loading = false;
    toast(
      keptCatalog
        ? "La conexión se interrumpió. Conservamos el catálogo completo mientras reconectamos."
        : "No pudimos cargar el catálogo. Reintentamos automáticamente.",
      "error",
    );
    if (retry)
      setTimeout(() => loadStoreData({ route: false, retry: false }), 1200);
  } else {
    state.categories = categories || [];
    state.products = (products || []).map(mapProduct);
    state.usingFallback = false;
    persistStoreCache();
  }
  if (settings) {
    state.settings = {
      ...settings,
      contact_email: normalizedContactEmail(settings.contact_email),
      freight_whatsapp: normalizedWhatsapp(settings.freight_whatsapp),
      sales_whatsapp: normalizedWhatsapp(settings.sales_whatsapp),
    };
  }
  state.loading = false;
  reconcileCart();
  renderClients();
  renderCategories();
  renderProducts();
  renderCartCount();
  if (route) handleRoute();
}

function scheduleRealtimeRefresh(key, callback, delay = 140) {
  clearTimeout(realtimeTimers.get(key));
  realtimeTimers.set(
    key,
    setTimeout(async () => {
      realtimeTimers.delete(key);
      try {
        await callback();
      } catch (error) {
        console.error(`No se pudo sincronizar ${key}`, error);
      }
    }, delay),
  );
}
async function refreshStoreFromRealtime() {
  const hash = decodeURIComponent(location.hash.slice(1));
  await loadStoreData({ route: false });
  if (hash.startsWith("producto/")) {
    await showProductPage(hash.slice("producto/".length));
    return;
  }
  if (!isAdmin() || hash !== "panel-general") return;
  if (state.adminView === "products") openAdminProducts();
  else if (state.adminView === "categories") openCategories();
  else if (state.adminView === "clients") openClientManager();
  else if (state.adminView === "settings") openSettings();
}
function refreshOrdersFromRealtime() {
  syncPaidCheckoutCart({ notify: true });
  const hash = decodeURIComponent(location.hash.slice(1));
  if (isAdmin() && hash === "panel-general" && state.adminView === "orders") {
    return openAdminOrders();
  }
  if (
    state.user &&
    !isAdmin() &&
    hash === "cuenta" &&
    state.accountView === "orders"
  ) {
    return loadOrders();
  }
}
async function refreshProfilesFromRealtime() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (state.user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", state.user.id)
      .maybeSingle();
    if (data) {
      state.profile = data;
      updateSessionNavigation();
      if (hash.split("?")[0] === "cuenta") renderAccount();
    }
  }
  if (isAdmin() && hash === "panel-general" && state.adminView === "users") {
    return openAdminUsers();
  }
}
function handleConversationRealtime(payload) {
  const hash = decodeURIComponent(location.hash.slice(1));
  const changedId = payload?.new?.id || payload?.old?.id;
  if (
    isAdmin() &&
    hash === "panel-general" &&
    state.adminView === "chats"
  ) {
    scheduleRealtimeRefresh("admin-chats", openAdminChats);
    return;
  }
  if (
    payload?.eventType === "DELETE" &&
    changedId &&
    changedId === state.activeConversationId
  ) {
    stopChatRealtime();
    state.activeConversationId = null;
    if (isAdmin() && state.adminView === "order-conversation")
      scheduleRealtimeRefresh("deleted-admin-order-chat", openAdminOrders);
    else if (isAdmin())
      scheduleRealtimeRefresh("deleted-admin-chat", openAdminChats);
    else if (hash === "cuenta" && state.accountView === "order-chat")
      scheduleRealtimeRefresh("deleted-customer-order-chat", loadOrders);
    else if (hash === "cuenta" && state.accountView === "chat")
      scheduleRealtimeRefresh("deleted-customer-chat", openCustomerChat);
  }
}
function notificationTarget(notification) {
  if (isAdmin() && notification?.type === "question" && notification.product_id) {
    const product = state.products.find(
      (item) => String(item.id) === String(notification.product_id),
    );
    if (product) return `/#producto/${encodeURIComponent(product.slug)}`;
  }
  if (isAdmin() && notification?.type === "withdrawal")
    return "/#panel-general";
  if (isAdmin() && notification?.type === "invoice")
    return "/#panel-general";
  return isAdmin() ? "/#panel-general" : "/#cuenta";
}
async function showDeviceNotification(notification) {
  if (
    !state.user ||
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    !navigator.serviceWorker
  )
    return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(notification.title || "Aceros Oeste", {
      body: notification.body || "Tenés una novedad en el panel.",
      icon: "/assets/favicon.png",
      badge: "/assets/favicon.png",
      tag: `aceros-${notification.id}`,
      data: { url: notificationTarget(notification) },
    });
  } catch (error) {
    console.warn("No se pudo mostrar la notificación del dispositivo", error);
  }
}
async function enableDeviceNotifications() {
  if (!("Notification" in window))
    return toast("Este navegador no admite notificaciones.", "error");
  const permission = await Notification.requestPermission();
  renderNotificationCenter();
  toast(
    permission === "granted"
      ? "Notificaciones del dispositivo activadas"
      : "El navegador no autorizó las notificaciones",
    permission === "granted" ? "success" : "error",
  );
}
function renderNotificationCenter() {
  const center = document.querySelector("#adminNotificationCenter");
  const dropdown = document.querySelector("#notificationDropdown");
  const count = document.querySelector("#notificationCount");
  if (!center || !dropdown || !count) return;
  center.classList.toggle("hidden", !state.user);
  if (!state.user) return;
  const unread = state.notifications.filter((item) => !item.is_read).length;
  count.textContent = unread > 99 ? "99+" : String(unread);
  count.classList.toggle("hidden", unread === 0);
  const icon = (type) =>
    ({
      question: "?",
      message: "…",
      sale: "$",
      order: "✓",
      withdrawal: "↩",
      invoice: "F",
      feedback: "✦",
    })[type] || "•";
  dropdown.innerHTML = `<header><div><b>Notificaciones</b><small>${unread ? `${unread} nueva${unread === 1 ? "" : "s"}` : "Todo al día"}</small></div>${state.notifications.length ? '<button id="readAllNotifications" type="button">Limpiar todo</button>' : ""}</header>${"Notification" in window && Notification.permission !== "granted" ? '<button id="enableDeviceNotifications" class="notification-permission" type="button"><b>Activar avisos en este dispositivo</b><small>Recibilos en la computadora o el celular mientras la tienda esté activa.</small></button>' : ""}<div class="notification-list">${state.notifications.length ? state.notifications.map((item) => `<button class="notification-item ${item.is_read ? "" : "unread"}" data-notification-id="${escapeHtml(item.id)}" type="button"><i>${icon(item.type)}</i><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.body)}</small><time>${new Date(item.created_at).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></span></button>`).join("") : '<p class="notification-empty">No hay notificaciones nuevas.</p>'}</div>`;
  document.querySelector("#enableDeviceNotifications")?.addEventListener(
    "click",
    enableDeviceNotifications,
  );
  document.querySelector("#readAllNotifications")?.addEventListener(
    "click",
    markAllNotificationsRead,
  );
  dropdown.querySelectorAll("[data-notification-id]").forEach((button) => {
    button.onclick = () =>
      openNotification(
        state.notifications.find(
          (item) => String(item.id) === button.dataset.notificationId,
        ),
      );
  });
}
const notificationTable = () =>
  isAdmin() ? "admin_notifications" : "user_notifications";
async function loadNotifications() {
  if (!supabase || !state.user) {
    state.notifications = [];
    renderNotificationCenter();
    return;
  }
  const { data, error } = await supabase
    .from(notificationTable())
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("No se pudieron cargar las notificaciones", error);
    return;
  }
  state.notifications = data || [];
  renderNotificationCenter();
  const unread = state.notifications.filter((item) => !item.is_read).length;
  if (navigator.setAppBadge) {
    if (unread) navigator.setAppBadge(unread).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
  }
}
async function markAllNotificationsRead() {
  if (!state.notifications.length) return;
  const { error } = await supabase
    .from(notificationTable())
    .delete()
    .in(
      "id",
      state.notifications.map((item) => item.id),
    );
  if (error) return toast("No pudimos actualizar las notificaciones.", "error");
  state.notifications = [];
  renderNotificationCenter();
  navigator.clearAppBadge?.().catch(() => {});
}
async function removeNotification(notification) {
  if (!notification) return;
  const { error } = await supabase
    .from(notificationTable())
    .delete()
    .eq("id", notification.id);
  if (error) console.error("No se pudo limpiar la notificación", error);
  state.notifications = state.notifications.filter(
    (item) => String(item.id) !== String(notification.id),
  );
  renderNotificationCenter();
}
async function clearConversationNotifications(conversationId) {
  if (!state.user || !conversationId) return;
  const table = notificationTable();
  const ids = state.notifications
    .filter(
      (item) =>
        item.type === "message" &&
        String(item.conversation_id) === String(conversationId),
    )
    .map((item) => item.id);
  if (!ids.length) return;
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (!error) {
    state.notifications = state.notifications.filter(
      (item) => !ids.includes(item.id),
    );
    renderNotificationCenter();
  }
}
async function clearOrderNotifications(orderIds = []) {
  if (!state.user || !orderIds.length) return;
  const ids = state.notifications
    .filter(
      (item) =>
        item.order_id &&
        orderIds.some(
          (orderId) => String(orderId) === String(item.order_id),
        ),
    )
    .map((item) => item.id);
  if (!ids.length) return;
  const { error } = await supabase
    .from(notificationTable())
    .delete()
    .in("id", ids);
  if (!error) {
    state.notifications = state.notifications.filter(
      (item) => !ids.includes(item.id),
    );
    renderNotificationCenter();
  }
}
async function openNotification(notification) {
  if (!notification) return;
  document.querySelector("#notificationDropdown")?.classList.add("hidden");
  document.querySelector("#notificationBell")?.setAttribute("aria-expanded", "false");
  await removeNotification(notification);
  if (!isAdmin()) {
    location.hash = "cuenta";
    renderAccount();
    if (notification.type === "message" && !notification.order_id) {
      setAccountTab("chat");
      await openCustomerChat();
      return;
    }
    if (notification.type === "message" && notification.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", notification.order_id)
        .maybeSingle();
      await openCustomerOrderChat(notification.order_id, order);
      return;
    }
    setAccountTab("orders");
    document.querySelector("#accountWorkspace").innerHTML =
      '<div id="ordersList"><div class="empty">Cargando compras…</div></div>';
    await loadOrders();
    return;
  }
  if (notification.type === "question" && notification.product_id) {
    const product = state.products.find(
      (item) => String(item.id) === String(notification.product_id),
    );
    if (product) {
      location.hash = `producto/${encodeURIComponent(product.slug)}`;
      return;
    }
  }
  if (notification.type === "feedback") {
    await openFeedbackNotification(notification);
    return;
  }
  location.hash = "panel-general";
  if (notification.type === "sale") {
    state.adminView = "orders";
    renderAdminPanel({ openSection: false });
    await openAdminOrders();
    return;
  }
  if (notification.type === "withdrawal") {
    state.adminView = "withdrawals";
    renderAdminPanel({ openSection: false });
    await openAdminWithdrawals();
    return;
  }
  if (notification.type === "invoice") {
    state.adminView = "invoices";
    renderAdminPanel({ openSection: false });
    await openAdminInvoices();
    return;
  }
  state.adminView = "chats";
  renderAdminPanel({ openSection: false });
  if (notification.type === "message" && notification.conversation_id) {
    const { data: conversation } = await supabase
      .from("support_conversations")
      .select("*")
      .eq("id", notification.conversation_id)
      .maybeSingle();
    if (conversation) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", conversation.user_id)
        .maybeSingle();
      await openAdminConversation(
        conversation.id,
        profile?.full_name || "Cliente",
        {
          orderId: conversation.order_id || null,
          backToOrders: Boolean(conversation.order_id),
        },
      );
      return;
    }
  }
  await openAdminChats();
}

async function openFeedbackNotification(notification) {
  if (!notification.feedback_id) {
    openModal(`<button class="modal-close" data-close>×</button><p class="eyebrow orange">SUGERENCIA</p><h2>${escapeHtml(notification.title || "Nueva sugerencia")}</h2><div class="feedback-admin-message">${escapeHtml(notification.body || "Sin detalle")}</div><div class="feedback-email-state pending"><b>Envío no confirmado</b><small>Este aviso fue creado antes de incorporar el seguimiento de correo. La sugerencia quedó registrada.</small></div>`);
    return;
  }
  const { data: feedback, error } = await supabase
    .from("feedback_submissions")
    .select("*")
    .eq("id", notification.feedback_id)
    .maybeSingle();
  if (error || !feedback) {
    toast("No pudimos abrir el detalle de la sugerencia.", "error");
    return;
  }
  await supabase
    .from("feedback_submissions")
    .update({ status: "reviewed" })
    .eq("id", feedback.id);
  const categories = {
    producto: "Producto",
    atencion: "Atención",
    entrega: "Entrega o retiro",
    sitio: "Página web",
    general: "Sugerencia general",
  };
  const emailSent = Boolean(feedback.email_sent_at);
  openModal(`<button class="modal-close" data-close>×</button><p class="eyebrow orange">SUGERENCIA</p><h2>${escapeHtml(categories[feedback.category] || "Sugerencia general")}</h2><div class="feedback-admin-data"><span><small>Nombre</small><b>${escapeHtml(feedback.name)}</b></span><span><small>Email</small><a href="mailto:${escapeHtml(feedback.email)}">${escapeHtml(feedback.email)}</a></span>${feedback.order_reference ? `<span><small>Pedido</small><b>${escapeHtml(feedback.order_reference)}</b></span>` : ""}</div><div class="feedback-admin-message">${escapeHtml(feedback.message)}</div><div class="feedback-email-state ${emailSent ? "sent" : "pending"}"><b>${emailSent ? "Correo enviado" : "Correo pendiente"}</b><small>${emailSent ? `Confirmado el ${new Date(feedback.email_sent_at).toLocaleString("es-AR")}.` : escapeHtml(feedback.email_error || "Resend todavía no confirmó la entrega.")}</small></div><div class="feedback-admin-actions"><button class="btn outline" type="button" data-close>Cerrar</button>${emailSent ? "" : `<button class="btn cta" id="retryFeedbackEmail" type="button">Reintentar correo</button>`}</div>`);
  document.querySelector("#retryFeedbackEmail")?.addEventListener("click", (event) =>
    retryFeedbackEmail(feedback.id, event.currentTarget),
  );
}

async function retryFeedbackEmail(feedbackId, button) {
  setBusy(button, true, "Reintentando…");
  const { data, error } = await supabase.functions.invoke(
    "retry-feedback-email",
    { body: { feedbackId } },
  );
  setBusy(button, false);
  if (error || !data?.sent) {
    let message = data?.error;
    if (!message && error?.context?.json) {
      try {
        message = (await error.context.json())?.error;
      } catch {
        // El mensaje general cubre respuestas no JSON.
      }
    }
    return toast(
      readableFunctionError(
        message || error?.message,
        "El correo sigue pendiente. Revisá la API key de Resend.",
      ),
      "error",
    );
  }
  closeModal();
  toast("Sugerencia enviada al correo de gestión.", "success");
}
function handleNotificationRealtime(payload) {
  if (!state.user) return;
  scheduleRealtimeRefresh("notifications", loadNotifications, 80);
  if (payload?.eventType === "INSERT" && payload.new) {
    toast(payload.new.title || "Tenés una novedad", "notification");
    showDeviceNotification(payload.new);
  }
}
function stopAppRealtime() {
  if (!state.liveChannel || !supabase?.removeChannel) return;
  supabase.removeChannel(state.liveChannel);
  state.liveChannel = null;
}
function startAppRealtime() {
  stopAppRealtime();
  if (!supabase?.channel) return;
  const channel = supabase.channel(
    `aceros-live-${state.user?.id || "public"}-${Date.now()}`,
  );
  ["products", "categories", "client_projects", "store_settings"].forEach(
    (table) =>
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => scheduleRealtimeRefresh("store", refreshStoreFromRealtime),
      ),
  );
  ["orders", "order_items"].forEach((table) =>
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => scheduleRealtimeRefresh("orders", refreshOrdersFromRealtime),
    ),
  );
  ["invoices", "withdrawal_requests"].forEach((table) =>
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => {
        const hash = decodeURIComponent(location.hash.slice(1));
        if (isAdmin() && hash === "panel-general") {
          if (state.adminView === "invoices")
            scheduleRealtimeRefresh("invoices", openAdminInvoices);
          if (state.adminView === "withdrawals")
            scheduleRealtimeRefresh("withdrawals", openAdminWithdrawals);
        } else if (state.user && hash === "cuenta") {
          scheduleRealtimeRefresh("customer-documents", loadOrders);
        }
      },
    ),
  );
  channel
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "questions" },
      (payload) =>
        scheduleRealtimeRefresh("questions", () =>
          refreshVisibleQuestions(payload),
        ),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "support_conversations" },
      handleConversationRealtime,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      () => scheduleRealtimeRefresh("profiles", refreshProfilesFromRealtime),
    )
  if (state.user)
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: notificationTable() },
      handleNotificationRealtime,
    );
  state.liveChannel = channel.subscribe();
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
  if (state.user) await loadNotifications();
  else {
    state.notifications = [];
    renderNotificationCenter();
  }
  startAppRealtime();
  if (state.user) syncPaidCheckoutCart({ notify: true });
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
    const avatar = document.querySelector("#accountNavAvatar");
    if (avatar)
      avatar.outerHTML = avatarMarkup({}, "user-avatar nav-avatar").replace(
        "<span class=",
        '<span id="accountNavAvatar" class=',
      );
    document.querySelector("#adminNavLink").classList.add("hidden");
    return;
  }
  const name =
    state.profile?.full_name?.trim() ||
    state.user?.user_metadata?.full_name?.trim() ||
    state.user?.email?.split("@")[0] ||
    "Ingresar";
  document.querySelector("#accountNavName").textContent = name;
  const avatar = document.querySelector("#accountNavAvatar");
  if (avatar) {
    const markup = avatarMarkup(
      state.profile,
      "user-avatar nav-avatar",
    ).replace("<span class=", '<span id="accountNavAvatar" class=');
    avatar.outerHTML = markup;
  }
  document
    .querySelector("#adminNavLink")
    .classList.toggle("hidden", !isAdmin());
}

const isVideoUrl = (url) => /\.(mp4|webm|mov)(\?|$)/i.test(String(url));
const MAX_PRODUCT_PHOTOS = 10;

function productDescriptionMarkup(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p>${paragraph
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function productVisual(product) {
  const media =
    product.images?.find((url) => !isVideoUrl(url)) || product.images?.[0];
  return media
    ? isVideoUrl(media)
      ? `<video src="${escapeHtml(media)}" muted playsinline preload="none" aria-label="Video de ${escapeHtml(product.name)}"></video>`
      : `<img src="${escapeHtml(media)}" alt="${escapeHtml(product.name)}" loading="lazy">`
    : `<div class="shape ${product.category === "Campanas" ? "hood" : product.category.includes("Bacha") ? "sink" : "table"}"></div>`;
}
function productCardVisual(product) {
  const media =
    product.images?.find((url) => !isVideoUrl(url)) || product.images?.[0];
  if (!media) return productVisual(product);
  if (isVideoUrl(media))
    return `<video class="product-card-main" src="${escapeHtml(media)}" muted playsinline preload="metadata" aria-label="Video de ${escapeHtml(product.name)}"></video>`;
  return `<span class="product-image-backdrop" aria-hidden="true"><img src="${escapeHtml(media)}" alt="" loading="lazy"></span><img class="product-card-main" src="${escapeHtml(media)}" alt="${escapeHtml(product.name)}" loading="lazy">`;
}
function productCardMarkup(product, index = 0) {
  return `<article class="product-card reveal-on-scroll" style="--reveal-delay:${Math.min(index % 4, 3) * 80}ms"><a href="#producto/${encodeURIComponent(product.slug)}" class="product-image"><span class="badge ${product.stock < 3 ? "low" : ""}">${product.stock ? `${product.stock} en stock` : "A pedido"}</span>${productCardVisual(product)}</a><div class="product-info"><small>${escapeHtml(product.category)}</small><h3><a href="#producto/${encodeURIComponent(product.slug)}">${escapeHtml(product.name)}</a></h3><div class="price">${money(product.price)} <small>final</small></div><div class="product-actions"><a class="btn outline" href="#producto/${encodeURIComponent(product.slug)}">Ver producto</a><button class="btn cta" data-add="${product.id}" ${!product.stock ? "disabled" : ""}>Agregar</button></div>${isAdmin() && !String(product.id).startsWith("demo-") ? `<div class="admin-actions"><button class="btn secondary" data-edit="${product.id}">Editar</button><button class="btn danger" data-delete="${product.id}">Eliminar</button></div>` : ""}</div></article>`;
}
function categoryCover(categoryName) {
  const product = state.products.find(
    (item) =>
      item.active !== false &&
      item.category === categoryName &&
      item.images?.some((url) => !isVideoUrl(url)),
  );
  return product?.images?.find((url) => !isVideoUrl(url)) || "";
}
function productGallery(product) {
  const media = product.images || [];
  if (!media.length)
    return `<div class="product-page-image product-page-image-fallback">${productVisual(product)}</div>`;
  const main = media[0];
  return `<div class="product-gallery"><div id="galleryMain" class="product-page-image ${isVideoUrl(main) ? "has-video" : "has-image"}">${isVideoUrl(main) ? `<video src="${escapeHtml(main)}" controls playsinline preload="metadata"></video>` : `<img src="${escapeHtml(main)}" alt="${escapeHtml(product.name)}">`}</div>${media.length > 1 ? `<div class="gallery-thumbs" aria-label="Galería del producto">${media.map((url, index) => `<button type="button" class="gallery-thumb ${index === 0 ? "active" : ""}" data-media="${escapeHtml(url)}" data-video="${isVideoUrl(url)}" aria-label="${isVideoUrl(url) ? `Reproducir video ${index + 1}` : `Ver foto ${index + 1}`}">${isVideoUrl(url) ? `<span class="gallery-video-thumb"><i>▶</i><small>Video ${index + 1}</small></span>` : `<img src="${escapeHtml(url)}" alt="Vista ${index + 1}" loading="lazy">`}</button>`).join("")}</div>` : ""}</div>`;
}
function renderCategories() {
  const list = state.categories;
  const homeCategories = list.slice(0, HOME_CATEGORY_LIMIT);
  document.querySelector("#categoryCards").innerHTML =
    homeCategories
      .map((category) => {
        const cover = categoryCover(category.name);
        return `<a class="category-card category-photo-card ${cover ? "has-cover" : "has-fallback"}" href="#catalogo" data-cat="${escapeHtml(category.name)}">${cover ? `<img class="category-card-cover" src="${escapeHtml(cover)}" alt="" loading="lazy">` : ""}<span class="category-card-shade" aria-hidden="true"></span><span class="category-card-content"><i class="category-card-icon" aria-hidden="true">${categoryVisuals[category.name] || "▱"}</i><b>${escapeHtml(category.name)}</b><small>Ver productos →</small></span></a>`;
      })
      .join("") ||
    '<div class="empty">Las categorías se están preparando.</div>';
  document.querySelectorAll("[data-cat]").forEach(
    (node) =>
      (node.onclick = () => {
        state.filter = node.dataset.cat;
        state.visibleCount = CATALOG_PAGE_SIZE;
        location.hash = "catalogo";
        renderProducts();
      }),
  );
  document.querySelector("#footerCategories").innerHTML = list
    .map(
      (category) =>
        `<a href="#catalogo" data-footer-cat="${escapeHtml(category.name)}">${escapeHtml(category.name)}</a>`,
    )
    .join("");
  document.querySelectorAll("[data-footer-cat]").forEach((link) => {
    link.onclick = () => {
      state.filter = link.dataset.footerCat;
      state.visibleCount = CATALOG_PAGE_SIZE;
      renderProducts();
    };
  });
  refreshRevealAnimations(document.querySelector("#categoryCards"));
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
  const description = String(client.description || "").trim();
  page.innerHTML = `<article class="client-profile-card"><p class="eyebrow orange">${escapeHtml(client.category || "CLIENTE")}</p><div class="client-profile-logo">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(client.name)}">` : `<span>${escapeHtml(client.name.slice(0, 2).toUpperCase())}</span>`}</div><h1>${escapeHtml(client.name)}</h1></article><section class="client-project-content">${description ? `<div class="client-project-copy">${escapeHtml(description)}</div>` : ""}<div class="client-detail-gallery client-photo-stack">${client.images?.length ? client.images.map((url, index) => `<button type="button" data-client-detail-photo="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="Trabajo para ${escapeHtml(client.name)}, foto ${index + 1}" loading="lazy"></button>`).join("") : '<div class="empty">Todavía no hay fotos publicadas para este cliente.</div>'}</div></section>`;
  document.querySelectorAll("[data-client-detail-photo]").forEach((button) => {
    button.onclick = () => openModal(`<button class="modal-close" data-close>×</button><h2>${escapeHtml(client.name)}</h2><img class="client-photo-large" src="${escapeHtml(button.dataset.clientDetailPhoto)}" alt="Trabajo para ${escapeHtml(client.name)}">`);
  });
  window.scrollTo(0, 0);
}
function renderFilters() {
  const names = [
    "Todos",
    ...new Set(state.categories.map((c) => c.name)),
    ...new Set(state.products.map((p) => p.category)),
  ];
  const markup = [...new Set(names)]
    .map(
      (name) =>
        `<button class="chip ${state.filter === name ? "active" : ""}" type="button" data-filter="${escapeHtml(name)}">${escapeHtml(name)}</button>`,
    )
    .join("");
  ["categoryFilters", "catalogCategoryFilters"].forEach((id) => {
    const filters = document.querySelector(`#${id}`);
    if (!filters) return;
    filters.innerHTML = markup;
    bindCategoryCarousel(id);
  });
  document.querySelectorAll("#searchInput, #catalogSearchInput").forEach((input) => {
    if (input.value !== state.search) input.value = state.search;
  });
  document.querySelectorAll("[data-filter]").forEach(
    (node) =>
      (node.onclick = () => {
        state.filter = node.dataset.filter;
        state.visibleCount = CATALOG_PAGE_SIZE;
        renderProducts();
      }),
  );
}
function bindCategoryCarousel(id) {
  const scroller = document.querySelector(`#${id}`);
  const carousel = document.querySelector(`[data-category-carousel="${id}"]`);
  if (!scroller || !carousel) return;
  const arrows = [...carousel.querySelectorAll("[data-category-move]")];
  const updateArrows = () => {
    const atStart = scroller.scrollLeft <= 2;
    const atEnd =
      scroller.scrollWidth <= scroller.clientWidth + 2 ||
      scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
    arrows.forEach((arrow) => {
      arrow.disabled = Number(arrow.dataset.categoryMove) < 0 ? atStart : atEnd;
    });
  };
  arrows.forEach((arrow) => {
    arrow.onclick = () => {
      const distance = Math.max(220, Math.round(scroller.clientWidth * 0.72));
      const left = distance * Number(arrow.dataset.categoryMove);
      if (typeof scroller.scrollBy === "function")
        scroller.scrollBy({ left, behavior: "smooth" });
      else scroller.scrollLeft += left;
      window.setTimeout(updateArrows, 350);
    };
  });
  scroller.onscroll = updateArrows;
  requestAnimationFrame(() => {
    updateArrows();
    const active = scroller.querySelector(".chip.active");
    if (typeof active?.scrollIntoView === "function")
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  });
}
function filteredProducts() {
  return state.products.filter(
    (product) =>
      (state.filter === "Todos" || product.category === state.filter) &&
      product.name.toLowerCase().includes(state.search.toLowerCase()),
  );
}
function renderProducts() {
  renderFilters();
  const grid = document.querySelector("#productGrid");
  if (state.loading) {
    grid.innerHTML = '<div class="empty">Cargando catálogo…</div>';
    renderCatalogProducts();
    return;
  }
  const list = filteredProducts();
  document
    .querySelector("#emptyState")
    .classList.toggle("hidden", Boolean(list.length));
  const visible = list.slice(0, HOME_PRODUCT_LIMIT);
  grid.innerHTML = visible
    .map(productCardMarkup)
    .join("");
  renderCatalogProducts();
  bindProductActions();
  refreshRevealAnimations(grid);
}
function renderCatalogProducts() {
  const grid = document.querySelector("#catalogProductGrid");
  if (!grid) return;
  const empty = document.querySelector("#catalogEmptyState");
  const count = document.querySelector("#catalogCount");
  const loadMore = document.querySelector("#catalogLoadMoreProducts");
  if (state.loading) {
    grid.innerHTML = '<div class="empty">Cargando catálogo…</div>';
    empty?.classList.add("hidden");
    loadMore?.classList.add("hidden");
    if (count) count.textContent = "Cargando…";
    return;
  }
  const list = filteredProducts();
  const visible = list.slice(0, state.visibleCount);
  grid.innerHTML = visible.map(productCardMarkup).join("");
  empty?.classList.toggle("hidden", Boolean(list.length));
  if (count)
    count.textContent = `${list.length} ${list.length === 1 ? "producto" : "productos"}`;
  loadMore?.classList.toggle("hidden", visible.length >= list.length);
  if (loadMore)
    loadMore.onclick = () => {
      state.visibleCount += CATALOG_PAGE_SIZE;
      renderCatalogProducts();
      bindProductActions();
      refreshRevealAnimations(grid);
    };
  bindProductActions();
  refreshRevealAnimations(grid);
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
function refreshRevealAnimations(root = document) {
  if (!root) return;
  const selectors = [
    ".hero-content",
    ".trust-grid>div",
    ".section-head",
    ".category-card",
    ".product-card",
    ".custom-inner",
    ".about-grid",
    ".location-grid",
    ".client-card",
  ].join(",");
  const elements = [...root.querySelectorAll(selectors)].filter(
    (element) => !element.classList.contains("reveal-ready"),
  );
  if (!elements.length) return;
  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || !("IntersectionObserver" in window)) {
    elements.forEach((element) =>
      element.classList.add("reveal-ready", "is-visible"),
    );
    return;
  }
  if (!revealObserver)
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
    );
  elements.forEach((element) => {
    element.classList.add("reveal-ready");
    revealObserver.observe(element);
  });
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
    location.hash = "catalogo";
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
    `<div class="product-page-layout">${productGallery(product)}<div class="product-page-info"><p class="eyebrow orange">${escapeHtml(product.category)}</p><h1>${escapeHtml(product.name)}</h1><div class="price">${money(product.price)}</div><small class="final-price-note">Precio final al público · impuestos incluidos</small><div class="stock-line"><span class="badge ${product.stock < 3 ? "low" : ""}" style="position:static">${product.stock ? `${product.stock} unidades disponibles` : "Fabricación a pedido"}</span><small>SKU ${escapeHtml(product.sku)}</small></div><p>${escapeHtml(product.desc)}</p><div class="product-specs"><div><b>Material</b><br>Acero inoxidable</div><div><b>Fabricación</b><br>Nacional</div><div><b>Modalidad</b><br>${escapeHtml(saleTypeLabel(product.saleType))}</div><div><b>Entrega</b><br>A coordinar</div></div><p>${escapeHtml(product.details)}</p><div class="product-legal-note">${product.saleType === "standard" ? "Producto estándar sujeto a las condiciones de compra y al derecho de arrepentimiento cuando corresponda." : "Este producto puede fabricarse siguiendo medidas o especificaciones particulares. Las condiciones se informarán y aprobarán antes de iniciar la fabricación."}</div><div class="stack"><button class="btn cta" data-add="${product.id}" ${!product.stock ? "disabled" : ""}>Agregar al carrito</button><a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/${state.settings.sales_whatsapp || PRIMARY_WHATSAPP}?text=${encodeURIComponent("Hola Acerosoeste, quiero consultar por " + product.name)}">Consultar por WhatsApp</a>${isAdmin() && !String(product.id).startsWith("demo-") ? `<button class="btn outline" data-edit="${product.id}">Editar producto</button>` : ""}</div></div></div><div class="questions"><p class="eyebrow orange">PREGUNTAS</p><h2>Preguntá lo que necesitás saber</h2>${state.user ? `<form id="questionForm" class="question-form"><input name="question" maxlength="500" placeholder="Escribí tu pregunta sobre este producto..." required><button class="btn cta">Preguntar</button></form>` : '<div class="notice">Iniciá sesión para publicar una pregunta.</div>'}<div class="question-list">${renderQuestionList(questions)}</div></div>`;
  const productInfo = page.querySelector(".product-page-info");
  productInfo
    ?.querySelectorAll(":scope > p:not(.eyebrow)")
    .forEach((paragraph) => paragraph.remove());
  const descriptionMarkup = [product.desc, product.details]
    .map(productDescriptionMarkup)
    .filter(Boolean)
    .join("");
  page
    .querySelector(".questions")
    ?.insertAdjacentHTML(
      "beforebegin",
      `<section class="product-description-section"><p class="eyebrow orange">DESCRIPCIÓN</p><h2>Descripción del producto</h2><div class="product-description-copy">${descriptionMarkup || "<p>Consultanos para conocer todos los detalles de este producto.</p>"}</div></section>`,
    );
  document.querySelectorAll("[data-media]").forEach((button) => {
    button.onclick = () => {
      const url = button.dataset.media;
      const galleryMain = document.querySelector("#galleryMain");
      const isVideo = button.dataset.video === "true";
      galleryMain.classList.toggle("has-video", isVideo);
      galleryMain.classList.toggle("has-image", !isVideo);
      galleryMain.innerHTML =
        isVideo
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
  bindQuestionActions(product);
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
function bindQuestionActions(product) {
  const list = document.querySelector("#producto .question-list");
  list
    ?.querySelectorAll("[data-answer]")
    .forEach(
      (node) =>
        (node.onclick = () => answerQuestion(product, node.dataset.answer)),
    );
  list?.querySelectorAll("[data-delete-question]").forEach((button) => {
    button.onclick = () =>
      deleteQuestion(product, button.dataset.deleteQuestion);
  });
}
async function refreshVisibleQuestions(payload = null) {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash.startsWith("producto/")) return;
  const product = state.products.find(
    (item) => item.slug === hash.slice("producto/".length),
  );
  const list = document.querySelector("#producto .question-list");
  if (!product || !list) return;
  const changedProductId =
    payload?.new?.product_id || payload?.old?.product_id || null;
  if (changedProductId && String(changedProductId) !== String(product.id)) return;
  const questions = await loadQuestions(product.id);
  if (!document.body.contains(list)) return;
  list.innerHTML = renderQuestionList(questions);
  bindQuestionActions(product);
}
async function deleteQuestion(product, questionId) {
  if (
    !(await confirmAction({
      title: "Eliminar pregunta",
      message:
        "La pregunta dejará de verse en la publicación. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar pregunta",
    }))
  )
    return;
  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId);
  if (error) return toast(error.message, "error");
  toast("Pregunta eliminada", "success");
  await refreshVisibleQuestions({ old: { product_id: product.id } });
}
async function submitQuestion(event, product) {
  event.preventDefault();
  const button = event.submitter,
    text = new FormData(event.target).get("question").trim();
  if (!text) return;
  setBusy(button, true);
  const { data, error } = await supabase
    .from("questions")
    .insert({ product_id: product.id, user_id: state.user.id, question: text })
    .select("id")
    .single();
  setBusy(button, false);
  if (error) return toast(error.message, "error");
  event.target.reset();
  toast("Pregunta publicada");
  if (data?.id) await notifyAdminByEmail("question", data.id);
  await refreshVisibleQuestions({ new: { product_id: product.id } });
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
  await refreshVisibleQuestions({ new: { product_id: product.id } });
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
  const route = hash.split("?")[0];
  if (!["cuenta", "panel-general"].includes(route)) stopChatRealtime();
  const recoveryRequested =
    new URLSearchParams(location.search).get("auth") === "recovery";
  const emailConfirmed =
    new URLSearchParams(location.search).get("auth") === "confirmed";
  if (recoveryRequested || state.recoveryMode || route === "cambiar-contrasena") {
    state.recoveryMode = true;
    showStandalonePage("#cambiar-contrasena");
    renderPasswordUpdate();
  } else if (route.startsWith("producto/"))
    showProductPage(route.slice("producto/".length));
  else if (route.startsWith("cliente/"))
    showClientPage(route.slice("cliente/".length));
  else if (route === "cuenta") {
    showStandalonePage("#cuenta");
    renderAccount();
  } else if (route === "panel-general") {
    if (!isAdmin()) {
      location.hash = "cuenta";
      return;
    }
    showStandalonePage("#panel-general");
    renderAdminPanel();
  } else if (route === "catalogo") {
    showStandalonePage("#catalogo");
    renderProducts();
    refreshRevealAnimations(document.querySelector("#catalogo"));
  } else if (route === "politicas") {
    showStandalonePage("#politicas");
  } else if (route === "arrepentimiento") {
    showStandalonePage("#arrepentimiento");
    renderWithdrawalPage();
  } else if (route === "sugerencias") {
    showStandalonePage("#sugerencias");
    renderFeedbackPage();
  } else if (emailConfirmed) {
    showStandalonePage("#cuenta");
    renderAccount();
    history.replaceState(null, "", "/#cuenta");
    toast("Email confirmado. Ya podés usar tu cuenta.", "success");
  } else {
    showMainSections();
    renderCheckoutStatus(hash);
    refreshRevealAnimations(document.querySelector("main"));
  }
}
async function renderCheckoutStatus(hash) {
  const route = hash.split("?")[0];
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const checkoutStatus = route.startsWith("checkout/")
    ? route.slice("checkout/".length)
    : route === "inicio"
      ? new URLSearchParams(query).get("checkout")
      : null;
  if (checkoutStatus && route === "inicio")
    history.replaceState(null, "", "/#inicio");
  if (checkoutStatus === "exito") {
    toast("Confirmando el pago y actualizando tu carrito…", "info");
    const cleared = await syncPaidCheckoutCart({ retry: true, notify: true });
    if (!cleared)
      toast(
        "El pago está siendo confirmado. El carrito se actualizará automáticamente al acreditarse.",
        "info",
      );
  } else if (checkoutStatus === "error") {
    localStorage.removeItem(pendingCheckoutKey);
    toast("El pago no pudo completarse. Tu carrito sigue guardado.", "error");
  } else if (checkoutStatus === "pendiente") {
    toast(
      "El pago quedó pendiente. El carrito se limpiará cuando Mercado Pago lo acredite.",
      "info",
    );
    syncPaidCheckoutCart({ notify: true });
  }
}

function renderWithdrawalPage() {
  const content = document.querySelector("#withdrawalContent");
  if (!content) return;
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  content.innerHTML = `<div class="withdrawal-intro"><p class="eyebrow orange">DERECHO DE ARREPENTIMIENTO</p><h1>Solicitá la revisión de tu compra</h1><p>Podés iniciar la solicitud sin registrarte ni iniciar sesión. Ingresá el código visible en tu compra o en el correo de confirmación y el mismo email utilizado al pagar.</p></div><form id="withdrawalForm" class="withdrawal-form"><div class="field"><label>Código del pedido</label><input name="orderCode" minlength="8" maxlength="36" value="${escapeHtml(params.get("pedido") || "")}" placeholder="Ej.: A1B2C3D4" required><small>Podés escribir los primeros 8 caracteres.</small></div><div class="field"><label>Email de la compra</label><input name="email" type="email" value="${escapeHtml(state.user?.email || "")}" required></div><div class="field"><label>Teléfono de contacto</label><input name="phone" autocomplete="tel" value="${escapeHtml(state.profile?.phone || "")}"></div><div class="field full"><label>Contanos qué necesitás <span>(opcional)</span></label><textarea name="reason" maxlength="2000" rows="5" placeholder="Podés aclarar si recibiste el producto, el inconveniente o cualquier información útil."></textarea></div><div class="withdrawal-privacy field full"><b>¿Qué sucede después?</b><p>Registraremos la solicitud, te enviaremos un código de seguimiento y revisaremos si se trata de un producto estándar o fabricado según especificaciones particulares. Esta solicitud no limita garantías por defectos o diferencias respecto de lo acordado.</p></div><button class="btn cta field full" type="submit">Enviar solicitud</button></form>`;
  document.querySelector("#withdrawalForm").onsubmit = submitWithdrawalRequest;
}

async function submitWithdrawalRequest(event) {
  event.preventDefault();
  const button = event.submitter;
  const values = Object.fromEntries(new FormData(event.currentTarget));
  setBusy(button, true, "Registrando…");
  const { data, error } = await supabase.functions.invoke(
    "create-withdrawal-request",
    { body: values },
  );
  setBusy(button, false);
  if (error || !data?.requestCode) {
    let message = data?.error;
    if (!message && error?.context?.json) {
      try {
        message = (await error.context.json())?.error;
      } catch {
        // La respuesta general cubre errores sin JSON.
      }
    }
    return toast(
      readableFunctionError(
        message || error?.message,
        "No pudimos registrar la solicitud. Verificá los datos o intentá nuevamente.",
      ),
      "error",
    );
  }
  document.querySelector("#withdrawalContent").innerHTML = `<div class="withdrawal-success"><span>✓</span><p class="eyebrow orange">SOLICITUD RECIBIDA</p><h1>${escapeHtml(data.requestCode)}</h1><p>Guardá este código. Te enviamos la confirmación al email de la compra y administración ya recibió el aviso.</p><a class="btn cta" href="#inicio">Volver a la tienda</a></div>`;
  window.scrollTo(0, 0);
}

function renderFeedbackPage() {
  const content = document.querySelector("#feedbackContent");
  if (!content) return;
  content.innerHTML = `<div class="feedback-intro"><p class="eyebrow orange">TU EXPERIENCIA NOS AYUDA</p><h1>¿Qué podemos mejorar?</h1><p>Leemos cada sugerencia para mejorar nuestros productos, la atención y la experiencia de compra. Pedimos que el mensaje sea claro, respetuoso y constructivo.</p></div><form id="feedbackForm" class="feedback-form"><div class="field"><label>Nombre</label><input name="name" maxlength="100" value="${escapeHtml(state.profile?.full_name || "")}" required></div><div class="field"><label>Email</label><input name="email" type="email" maxlength="180" value="${escapeHtml(state.user?.email || "")}" required></div><div class="field"><label>Tema</label><select name="category"><option value="producto">Producto</option><option value="atencion">Atención</option><option value="entrega">Entrega o retiro</option><option value="sitio">Página web</option><option value="general" selected>Sugerencia general</option></select></div><div class="field"><label>Código de pedido <span>(opcional)</span></label><input name="orderCode" maxlength="60" placeholder="Si está relacionado con una compra"></div><div class="field full feedback-honeypot" aria-hidden="true"><label>Sitio web<input name="website" tabindex="-1" autocomplete="off"></label></div><div class="field full"><label>Tu sugerencia</label><textarea name="message" minlength="20" maxlength="1800" rows="7" placeholder="Contanos qué ocurrió y qué cambio te resultaría útil." required></textarea><small>No se aceptan insultos, amenazas ni lenguaje discriminatorio.</small></div><button class="btn cta field full" type="submit">Enviar sugerencia</button></form>`;
  document.querySelector("#feedbackForm").onsubmit = submitFeedback;
}

async function submitFeedback(event) {
  event.preventDefault();
  const button = event.submitter;
  const values = Object.fromEntries(new FormData(event.currentTarget));
  setBusy(button, true, "Enviando…");
  const { data, error } = await supabase.functions.invoke("send-feedback", {
    body: values,
  });
  setBusy(button, false);
  if (error || !data?.received) {
    let message = data?.error;
    if (!message && error?.context?.json) {
      try {
        message = (await error.context.json())?.error;
      } catch {
        // Se muestra el mensaje general si la respuesta no contiene JSON.
      }
    }
    return toast(
      readableFunctionError(
        message || error?.message,
        "No pudimos enviar la sugerencia. Intentá nuevamente en unos minutos.",
      ),
      "error",
    );
  }
  document.querySelector("#feedbackContent").innerHTML = `<div class="feedback-success"><span>✓</span><p class="eyebrow orange">MENSAJE RECIBIDO</p><h1>Gracias por ayudarnos a mejorar.</h1><p>${data.emailSent ? "La sugerencia fue guardada y enviada al equipo de Aceros Oeste." : "La sugerencia quedó guardada para revisión. El aviso por correo está temporalmente pendiente."}</p><a class="btn cta" href="#inicio">Volver a la tienda</a></div>`;
  if (!data.emailSent)
    toast("Sugerencia guardada. El correo de gestión está pendiente.", "info");
  window.scrollTo(0, 0);
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
    percentage = Number(state.settings.deposit_percentage || 50),
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
    } else if (wasGuest) {
      state.cart = safeRead(cartStorageKey(), []);
      renderCartCount();
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
    `<button class="modal-close" data-close>×</button><p class="eyebrow orange">PAGO SEGURO</p><h2>Datos para tu pedido</h2><form id="checkoutForm" class="form-grid"><div class="field full"><label>Nombre completo</label><input name="name" value="${escapeHtml(state.profile?.full_name || "")}" required></div><div class="field"><label>Email de la cuenta</label><input name="email" type="email" value="${escapeHtml(state.user?.email || "")}" readonly required></div><div class="field"><label>Teléfono</label><input name="phone" value="${escapeHtml(state.profile?.phone || "")}" required></div><label class="field full checkout-invoice-toggle"><input id="needsFiscalInvoice" name="needsFiscalInvoice" type="checkbox" value="yes"><span><b>Quiero que el comprobante salga con CUIT o razón social</b><small>Todas las compras reciben comprobante. Marcá esta opción sólo para utilizar datos fiscales especiales; no modifica el total.</small></span></label><div id="checkoutFiscalFields" class="form-grid field full hidden"><div class="field"><label>Condición fiscal</label><select name="billingCondition"><option value="monotributista">Monotributista</option><option value="responsable_inscripto">Responsable inscripto</option><option value="exento">Exento</option></select></div><div class="field"><label>Razón social</label><input name="billingName" value="${escapeHtml(state.profile?.full_name || "")}"></div><div class="field"><label>Tipo de documento</label><select name="billingDocumentType"><option value="CUIT">CUIT</option><option value="CUIL">CUIL</option><option value="DNI">DNI</option></select></div><div class="field"><label>Número</label><input name="billingDocumentNumber" inputmode="numeric" maxlength="14" placeholder="Sin puntos ni guiones"></div><div class="field full"><label>Domicilio fiscal</label><input name="billingAddress" autocomplete="street-address" placeholder="Calle, número, localidad y provincia"></div></div><label class="field full checkout-terms-toggle"><input id="acceptTerms" name="acceptTerms" type="checkbox" value="yes" required><span><b>Leí y acepto los términos y condiciones de compra</b><small>Incluyen precio final, seña, materiales, mano de obra, modificaciones, entrega y arrepentimiento. <a href="#politicas" target="_blank" rel="noopener">Leer los términos completos</a>.</small></span></label><input name="termsVersion" type="hidden" value="${TERMS_VERSION}"><input name="paymentType" type="hidden" value="${paymentType}"><button class="btn cta field full" type="submit">Aceptar y continuar a Mercado Pago</button></form>`,
  );
  const invoiceToggle = document.querySelector("#needsFiscalInvoice");
  const fiscalFields = document.querySelector("#checkoutFiscalFields");
  invoiceToggle.onchange = () => {
    fiscalFields.classList.toggle("hidden", !invoiceToggle.checked);
    fiscalFields.querySelectorAll("input").forEach((input) => {
      input.required = invoiceToggle.checked && input.name !== "billingAddress";
    });
  };
  document.querySelector("#checkoutForm").onsubmit = startPayment;
}
async function startPayment(event) {
  event.preventDefault();
  const button = event.submitter,
    form = Object.fromEntries(new FormData(event.target));
  const needsFiscalInvoice = form.needsFiscalInvoice === "yes";
  if (form.acceptTerms !== "yes" || form.termsVersion !== TERMS_VERSION)
    return toast(
      "Leé y aceptá los términos y condiciones para continuar.",
      "error",
    );
  if (
    needsFiscalInvoice &&
    (!String(form.billingName || "").trim() ||
      !String(form.billingDocumentNumber || "").replace(/\D/g, ""))
  )
    return toast("Completá la razón social y el CUIT para facturar.", "error");
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
        terms: {
          accepted: true,
          version: TERMS_VERSION,
        },
        customer: {
          name: form.name,
          phone: form.phone,
          billing: {
            condition: needsFiscalInvoice
              ? form.billingCondition
              : "consumer_final",
            name: needsFiscalInvoice ? form.billingName : form.name,
            documentType: needsFiscalInvoice
              ? form.billingDocumentType
              : null,
            documentNumber: needsFiscalInvoice
              ? form.billingDocumentNumber
              : null,
            address: needsFiscalInvoice ? form.billingAddress : null,
          },
        },
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
      readableFunctionError(
        backendMessage || error?.message,
        "No pudimos iniciar el pago. Revisá la configuración de Mercado Pago.",
      ),
      "error",
    );
  }
  rememberPendingCheckout(data.orderId, checkoutLines);
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
      `https://wa.me/${state.settings.freight_whatsapp || PRIMARY_WHATSAPP}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener",
    );
    closeModal();
  };
}

function renderAccount() {
  const el = document.querySelector("#accountContent"),
    title = document.querySelector("#accountTitle"),
    section = document.querySelector("#cuenta");
  if (!state.user) {
    section?.classList.remove("signed-in");
    title.textContent = "Ingresá a tu cuenta";
    el.innerHTML = `<div class="account-switch"><button class="chip active" type="button">Iniciar sesión</button><button class="chip" id="showRegister" type="button">Crear cuenta</button></div><form id="loginForm" class="auth-form"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" placeholder="nombre@email.com" required></div><div class="field"><label>Contraseña</label><input name="password" type="password" autocomplete="current-password" minlength="6" placeholder="Tu contraseña" required></div><button class="btn cta full">Ingresar</button><button class="text-button" id="forgotPassword" type="button">¿Olvidaste tu contraseña?</button></form><p class="auth-help">Si acabás de registrarte, confirmá primero el email que te envió Acerosoeste.</p>`;
    document.querySelector("#loginForm").onsubmit = login;
    document.querySelector("#showRegister").onclick = renderRegister;
    document.querySelector("#forgotPassword").onclick = renderRecovery;
    return;
  }
  section?.classList.add("signed-in");
  title.textContent = "Mi cuenta";
  state.accountView = isAdmin() ? "profile" : "orders";
  el.innerHTML = customerDashboard();
  document.querySelector("#logout")?.addEventListener("click", logout);
  document.querySelector("#editAvatar")?.addEventListener("click", openAvatarPicker);
  document.querySelector("#customerProfileBtn")?.addEventListener("click", openCustomerProfile);
  document.querySelector("#accountBackStore")?.addEventListener("click", () => {
    location.hash = "inicio";
  });
  if (isAdmin()) {
    openCustomerProfile();
  } else {
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
function openAvatarPicker() {
  if (!state.user) return;
  const currentPreset = state.profile?.avatar_preset || "blue";
  openModal(
    `<button class="modal-close" data-close>×</button><p class="eyebrow orange">TU PERFIL</p><h2>Elegí tu icono</h2><p class="avatar-picker-copy">Elegí un color para tu inicial o subí una foto desde tu dispositivo.</p><form id="avatarForm"><div class="avatar-preset-grid">${avatarPresets.map((preset) => `<label class="avatar-preset-option"><input type="radio" name="avatar_preset" value="${escapeHtml(preset.id)}" ${currentPreset === preset.id && !state.profile?.avatar_url ? "checked" : ""}><span class="user-avatar avatar-${escapeHtml(preset.id)}"><b>${escapeHtml(String(state.profile?.full_name || "U").slice(0, 1).toUpperCase())}</b></span><small>${escapeHtml(preset.label)}</small></label>`).join("")}</div><label class="avatar-upload"><span>Subir una foto propia</span><small>JPG, PNG o WebP · máximo 5 MB</small><input id="avatarPhoto" type="file" accept="image/png,image/jpeg,image/webp"></label><div id="avatarPhotoPreview" class="avatar-photo-preview">${state.profile?.avatar_url ? `<img src="${escapeHtml(state.profile.avatar_url)}" alt="Foto actual"><span>Foto actual</span>` : ""}</div><div class="avatar-form-actions"><button class="btn outline" type="button" data-close>Cancelar</button><button class="btn cta" type="submit">Guardar icono</button></div></form>`,
  );
  const input = document.querySelector("#avatarPhoto");
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      input.value = "";
      return toast("La imagen supera los 5 MB.", "error");
    }
    document.querySelector("#avatarPhotoPreview").innerHTML =
      `<img src="${URL.createObjectURL(file)}" alt="Vista previa"><span>${escapeHtml(file.name)}</span>`;
  };
  document.querySelector("#avatarForm").onsubmit = saveAvatar;
}
async function saveAvatar(event) {
  event.preventDefault();
  const button = event.submitter;
  const file = document.querySelector("#avatarPhoto")?.files?.[0];
  const preset =
    new FormData(event.currentTarget).get("avatar_preset") ||
    state.profile?.avatar_preset ||
    "blue";
  setBusy(button, true, "Guardando…");
  try {
    let avatarUrl = null;
    if (file) {
      const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${state.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      avatarUrl = supabase.storage.from("profile-avatars").getPublicUrl(path)
        .data.publicUrl;
    } else if (!event.currentTarget.querySelector('[name="avatar_preset"]:checked')) {
      avatarUrl = state.profile?.avatar_url || null;
    }
    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl, avatar_preset: String(preset) })
      .eq("id", state.user.id)
      .select()
      .single();
    if (error) throw error;
    state.profile = { ...state.profile, ...data };
    closeModal();
    updateSessionNavigation();
    renderAccount();
    toast("Icono actualizado", "success");
  } catch (error) {
    toast(error.message || "No se pudo actualizar el icono", "error");
  } finally {
    setBusy(button, false);
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
  stopAppRealtime();
  await supabase.auth.signOut();
  location.hash = "cuenta";
  toast("Sesión cerrada");
}
function customerDashboard() {
  const admin = isAdmin();
  const name =
    state.profile?.full_name ||
    (admin ? "Aceros Oeste" : state.user.email);
  const email = accountDisplayEmail();
  const navigation = admin
    ? `<button class="customer-side-link active" id="customerProfileBtn" type="button"><i>●</i><span>Mis datos</span></button><a class="customer-side-link" href="#panel-general"><i>▦</i><span>Panel general</span></a>`
    : `<button class="customer-side-link" id="customerProfileBtn" type="button"><i>●</i><span>Mis datos</span></button><button class="customer-side-link active" id="accountOrdersTab" type="button"><i>▤</i><span>Mis compras</span></button><button class="customer-side-link" id="accountChatTab" type="button"><i>▣</i><span>Chat general</span></button>`;
  return `<div class="customer-shell"><aside class="customer-sidebar"><div class="customer-sidebar-user">${avatarMarkup(state.profile, "user-avatar customer-sidebar-avatar")}<div><b>${escapeHtml(name)}</b><small>${admin ? "Administración" : "Mi cuenta"}</small></div></div><nav aria-label="Panel de ${admin ? "administrador" : "cliente"}">${navigation}</nav><div class="customer-sidebar-bottom"><button class="customer-side-link" id="accountBackStore" type="button"><i>←</i><span>Volver a la tienda</span></button><button class="customer-side-link" id="logout" type="button"><i>↪</i><span>Cerrar sesión</span></button></div></aside><main class="customer-main"><header class="customer-topbar"><div><small>${escapeHtml(email)}</small><b>${escapeHtml(name)}</b></div>${avatarMarkup(state.profile, "user-avatar customer-top-avatar")}</header><div id="accountWorkspace" class="customer-workspace">${admin ? "" : '<div id="ordersList"><div class="empty">Cargando compras…</div></div>'}</div></main></div>`;
}
function setAccountTab(tab) {
  state.accountView = tab;
  if (!["chat", "order-chat"].includes(tab)) stopChatRealtime();
  document
    .querySelector("#customerProfileBtn")
    ?.classList.toggle("active", tab === "profile");
  document
    .querySelector("#accountOrdersTab")
    ?.classList.toggle("active", ["orders", "order-chat"].includes(tab));
  document
    .querySelector("#accountChatTab")
    ?.classList.toggle("active", tab === "chat");
}
function openCustomerProfile() {
  setAccountTab("profile");
  state.activeOrderId = null;
  const workspace = document.querySelector("#accountWorkspace");
  if (!workspace) return;
  const role = isAdmin() ? "Administrador" : "Cliente";
  const email = accountDisplayEmail();
  workspace.innerHTML = `<div class="customer-page-head"><div><p class="eyebrow orange">MI PERFIL</p><h1>Mis datos</h1><p>Actualizá el nombre y teléfono visibles en tu cuenta.</p></div></div><section class="customer-profile-panel"><div class="customer-profile-identity">${avatarMarkup(state.profile, "user-avatar account-avatar")}<div><h2>${escapeHtml(state.profile?.full_name || role)}</h2><span class="session-badge">${role}</span><small class="profile-email">${escapeHtml(email)}</small></div><button class="btn outline" id="editAvatar" type="button">Cambiar icono</button></div><form id="profileForm" class="profile-edit-form"><div class="field"><label>Nombre</label><input name="full_name" maxlength="100" autocomplete="name" value="${escapeHtml(state.profile?.full_name || "")}" required></div><div class="field"><label>Email de contacto</label><input value="${escapeHtml(email)}" readonly aria-readonly="true"></div><div class="field"><label>Teléfono</label><input name="phone" maxlength="40" autocomplete="tel" value="${escapeHtml(state.profile?.phone || "")}"></div><button class="btn cta" type="submit">Guardar cambios</button></form></section>`;
  document.querySelector("#editAvatar")?.addEventListener("click", openAvatarPicker);
  document.querySelector("#profileForm")?.addEventListener("submit", saveProfile);
}
async function saveProfile(event) {
  event.preventDefault();
  const button = event.submitter;
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const changes = {
    full_name: String(values.full_name || "").trim(),
    phone: String(values.phone || "").trim() || null,
  };
  if (!changes.full_name) return toast("Ingresá un nombre.", "error");
  setBusy(button, true, "Guardando…");
  const { data, error } = await supabase
    .from("profiles")
    .update(changes)
    .eq("id", state.user.id)
    .select()
    .single();
  if (!error && supabase.auth.updateUser) {
    await supabase.auth.updateUser({ data: changes }).catch(() => {});
  }
  setBusy(button, false);
  if (error) return toast(error.message || "No se pudo actualizar el perfil.", "error");
  state.profile = { ...state.profile, ...changes, ...(data || {}) };
  updateSessionNavigation();
  renderAccount();
  toast("Perfil actualizado", "success");
}
function orderItemImage(item) {
  if (item?.product_image_url) return item.product_image_url;
  const product = state.products.find(
    (candidate) => String(candidate.id) === String(item?.product_id),
  );
  const media = product?.images?.find((url) => !isVideoUrl(url));
  return media || "";
}
function orderProductsLabel(order) {
  return (order.order_items || [])
    .map((item) => `${Math.max(1, Number(item.quantity) || 1)}× ${item.product_name || "Producto"}`)
    .join(" · ");
}
function orderProgressMarkup(status) {
  const step =
    { deposit_paid: 1, paid: 1, in_transit: 2, fulfilled: 3 }[status] || 0;
  const cancelled = status === "cancelled";
  return `<div class="order-progress ${cancelled ? "cancelled" : ""}"><span class="${step >= 1 && !cancelled ? "done" : ""}"><i>✓</i><b>${cancelled ? "Compra cancelada" : "Pago acreditado"}</b></span><span class="${step >= 2 ? "done" : ""}"><i>2</i><b>En camino</b></span><span class="${step >= 3 ? "done" : ""}"><i>3</i><b>Entregado</b></span></div>`;
}
function orderPaymentSummary(order) {
  const paid = Number(order.amount_to_pay) || Number(order.subtotal) || 0;
  const balance = Math.max(0, Number(order.subtotal || 0) - paid);
  return `<div class="order-payment-summary"><span><small>Total</small><b>${money(order.subtotal)}</b></span><span><small>${order.payment_type === "deposit" ? "Seña acreditada" : "Pago acreditado"}</small><b>${money(paid)}</b></span>${balance ? `<span class="pending"><small>Saldo pendiente</small><b>${money(balance)}</b></span>` : ""}</div>`;
}
function customerOrderMarkup(order) {
  const items = order.order_items || [];
  const invoices = (order.invoices || []).filter(
    (invoice) => invoice.pdf_path && ["authorized", "sent"].includes(invoice.status),
  );
  const invoiceBlock = invoices.length
    ? `<div class="purchase-documents"><b>Comprobantes</b>${invoices.map((invoice) => { const number = invoice.invoice_number ? `${String(invoice.point_of_sale || 0).padStart(5, "0")}-${String(invoice.invoice_number).padStart(8, "0")}` : "Comprobante disponible"; return `<button class="invoice-download" type="button" data-invoice-path="${escapeHtml(invoice.pdf_path)}" aria-label="Descargar ${escapeHtml(invoice.invoice_type)} ${escapeHtml(number)}"><span class="invoice-download-icon" aria-hidden="true">PDF</span><span class="invoice-download-details"><strong>${escapeHtml(invoice.invoice_type)}</strong><small>${escapeHtml(number)} · ${money(invoice.gross_amount)}</small></span><span class="invoice-download-action">Descargar</span></button>`; }).join("")}</div>`
    : "";
  const withdrawal = (order.withdrawal_requests || []).find(
    (request) => !["rejected", "closed"].includes(request.status),
  ) || (order.withdrawal_requests || [])[0];
  const withdrawalBlock = withdrawal
    ? `<div class="purchase-withdrawal-status"><span><b>${escapeHtml(withdrawal.request_code)}</b><small>Solicitud de arrepentimiento</small></span><strong>${escapeHtml(withdrawalStatusLabel(withdrawal.status))}</strong></div>`
    : "";
  return `<article class="purchase-card" data-customer-order="${order.id}"><header><div><small>${new Date(order.created_at).toLocaleDateString("es-AR")}</small><h2>${escapeHtml(orderProductsLabel(order) || "Compra en Aceros Oeste")}</h2></div><span class="order-status status-${escapeHtml(order.status)}">${statusLabel(order.status)}</span></header><div class="purchase-products">${items.map((item) => { const image = orderItemImage(item); return `<div class="purchase-product"><div class="purchase-product-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.product_name || "Producto")}">` : `<span>${escapeHtml(String(item.product_name || "P").slice(0, 1))}</span>`}</div><div><b>${escapeHtml(item.product_name || "Producto")}</b><small>${Math.max(1, Number(item.quantity) || 1)} unidad${Number(item.quantity) === 1 ? "" : "es"} · ${money(item.unit_price || item.subtotal)}</small></div></div>`; }).join("")}</div>${orderProgressMarkup(order.status)}${orderPaymentSummary(order)}${invoiceBlock}${withdrawalBlock}<div class="purchase-actions">${withdrawal ? "" : `<a class="btn outline" href="#arrepentimiento?pedido=${encodeURIComponent(String(order.id).slice(0, 8))}">Solicitar arrepentimiento</a>`}${!["cancelled", "fulfilled"].includes(order.status) ? `<button class="btn cta" data-customer-order-chat="${order.id}" type="button">Hablar sobre esta compra</button>` : ""}${["cancelled", "fulfilled"].includes(order.status) ? `<button class="btn outline" data-hide-order="${order.id}" type="button">Quitar de mi cuenta</button>` : ""}</div></article>`;
}
async function loadOrders() {
  if (!state.user || isAdmin()) return;
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), invoices(*), withdrawal_requests(*)")
    .in("status", ["deposit_paid", "paid", "in_transit", "fulfilled", "cancelled"])
    .order("created_at", { ascending: false });
  const el = document.querySelector("#ordersList");
  if (!el) return;
  if (error) {
    el.innerHTML = '<div class="notice">No pudimos cargar tus pedidos.</div>';
    return;
  }
  const visibleOrders = (data || []).filter(
    (order) =>
      !order.hidden_by_customer &&
      ["deposit_paid", "paid", "in_transit", "fulfilled", "cancelled"].includes(
        order.status,
      ),
  );
  el.innerHTML = `<div class="customer-page-head"><div><p class="eyebrow orange">HISTORIAL</p><h1>Mis compras</h1><p>Seguimiento, pagos y comunicación de cada pedido.</p></div><span class="session-badge">${visibleOrders.length} compra${visibleOrders.length === 1 ? "" : "s"}</span></div>${visibleOrders.length ? `<div class="purchase-list">${visibleOrders.map(customerOrderMarkup).join("")}</div>` : '<div class="notice">Todavía no tenés compras con pago acreditado.</div>'}`;
  document.querySelectorAll("[data-hide-order]").forEach((button) => {
    button.onclick = () => hideCustomerOrder(button.dataset.hideOrder, button);
  });
  document.querySelectorAll("[data-customer-order-chat]").forEach((button) => {
    button.onclick = () =>
      openCustomerOrderChat(
        button.dataset.customerOrderChat,
        visibleOrders.find(
          (order) => String(order.id) === String(button.dataset.customerOrderChat),
        ),
      );
  });
  document.querySelectorAll("[data-invoice-path]").forEach((button) => {
    button.onclick = () => downloadInvoice(button.dataset.invoicePath, button);
  });
  await clearOrderNotifications(visibleOrders.map((order) => order.id));
}

async function downloadInvoice(path, button) {
  setBusy(button, true, "Preparando…");
  const { data, error } = await supabase.storage
    .from("invoice-documents")
    .createSignedUrl(path, 60 * 10);
  setBusy(button, false);
  if (error || !data?.signedUrl)
    return toast("No pudimos preparar la factura.", "error");
  window.open(data.signedUrl, "_blank", "noopener");
}
async function hideCustomerOrder(orderId, button) {
  if (
    !(await confirmAction({
      title: "Quitar compra del historial",
      message:
        "La compra dejará de mostrarse en tu cuenta, pero se conservará el registro administrativo.",
      confirmLabel: "Quitar compra",
    }))
  )
    return;
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
    .is("order_id", null)
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
async function getOrderConversation(orderId) {
  const { data, error } = await supabase.rpc(
    "get_or_create_order_conversation",
    { p_order_id: orderId },
  );
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
function chatMessagesMarkup(messages) {
  if (!messages.length)
    return '<div class="empty">Todavía no hay mensajes. Escribinos tu consulta y te responderemos desde administración.</div>';
  return messages
    .map((message) => {
      const mine = message.sender_id === state.user.id;
      const canDelete = mine || isAdmin();
      return `<div class="chat-message ${mine ? "mine" : "theirs"}" data-chat-message="${message.id}"><p>${escapeHtml(message.body)}</p><div class="chat-message-meta"><small>${new Date(message.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</small>${canDelete ? `<button class="chat-delete-message" data-delete-chat-message="${message.id}" type="button">Eliminar</button>` : ""}</div></div>`;
    })
    .join("");
}
async function loadConversationMessages(conversationId, target) {
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!target || !document.body.contains(target)) return;
  target.innerHTML = chatMessagesMarkup(data || []);
  target.querySelectorAll("[data-delete-chat-message]").forEach((button) => {
    button.onclick = () =>
      deleteChatMessage(button.dataset.deleteChatMessage, conversationId, () =>
        loadConversationMessages(conversationId, target),
      );
  });
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
        event: "*",
        schema: "public",
        table: "support_messages",
      },
      (payload) => {
        const changedConversationId =
          payload?.new?.conversation_id || payload?.old?.conversation_id;
        if (
          !changedConversationId ||
          String(changedConversationId) === String(conversationId)
        ) {
          scheduleRealtimeRefresh(`chat-${conversationId}`, refresh, 70);
        }
      },
    )
    .subscribe();
}
async function deleteChatMessage(messageId, conversationId, refresh) {
  if (
    !(await confirmAction({
      title: "Eliminar mensaje",
      message:
        "El mensaje se borrará para ambas partes y no podrá recuperarse.",
      confirmLabel: "Eliminar mensaje",
    }))
  )
    return;
  const { error } = await supabase.rpc("delete_support_message", {
    p_message_id: messageId,
  });
  if (error) return toast(error.message || "No se pudo eliminar el mensaje.", "error");
  toast("Mensaje eliminado", "success");
  await refresh();
}
async function deleteSupportConversation(conversationId, owner = "customer") {
  if (
    !(await confirmAction({
      title: "Eliminar conversación",
      message:
        "Se borrarán todos sus mensajes para ambas partes. Después podrás iniciar un chat nuevo.",
      confirmLabel: "Eliminar conversación",
    }))
  )
    return;
  const previousId = state.activeConversationId;
  state.activeConversationId = null;
  const { error } = await supabase.rpc("delete_support_conversation", {
    p_conversation_id: conversationId,
  });
  if (error) {
    state.activeConversationId = previousId;
    return toast(error.message || "No se pudo eliminar la conversación.", "error");
  }
  stopChatRealtime();
  toast("Conversación eliminada. Podés iniciar una nueva.", "success");
  if (owner === "admin-order") await openAdminOrders();
  else if (owner === "customer-order") await loadOrders();
  else if (owner === "admin") await openAdminChats();
  else await openCustomerChat();
}
async function sendChatMessage(event, conversationId, refresh) {
  event.preventDefault();
  const button = event.submitter;
  const form = event.currentTarget;
  const body = String(new FormData(form).get("message") || "").trim();
  if (!body) return;
  setBusy(button, true, "Enviando…");
  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: state.user.id,
      body,
    })
    .select("id")
    .single();
  setBusy(button, false);
  if (error) return toast(error.message, "error");
  form.reset();
  if (!isAdmin() && data?.id) await notifyAdminByEmail("message", data.id);
  await refresh();
}
async function notifyAdminByEmail(eventType, recordId) {
  if (!supabase || !state.user || isAdmin()) return;
  const { error } = await supabase.functions.invoke("send-admin-notification", {
    body: { eventType, recordId },
  });
  if (error)
    console.error("La consulta se guardó, pero falló el aviso por email", error);
}
async function openCustomerChat() {
  state.accountView = "chat";
  const workspace = document.querySelector("#accountWorkspace");
  if (!workspace) return;
  workspace.innerHTML = '<div class="empty">Abriendo chat privado…</div>';
  try {
    const conversation = await getCustomerConversation();
    state.activeConversationId = conversation.id;
    state.activeConversationName = state.profile?.full_name || "Cliente";
    await clearConversationNotifications(conversation.id);
    workspace.innerHTML = `<div class="chat-head"><div><h3>Chat con Aceros Oeste</h3><p>Este chat es privado y se actualiza automáticamente.</p></div><div class="chat-head-actions"><span class="live-indicator"><i></i> En vivo</span><button class="btn danger" id="deleteCustomerConversation" type="button">Eliminar chat</button></div></div><div id="customerChatMessages" class="chat-messages"></div><form id="customerChatForm" class="chat-form"><textarea name="message" maxlength="2000" rows="3" placeholder="Escribí tu consulta…" required></textarea><button class="btn cta" type="submit">Enviar</button></form>`;
    const refresh = () =>
      loadConversationMessages(
        conversation.id,
        document.querySelector("#customerChatMessages"),
      );
    document.querySelector("#deleteCustomerConversation").onclick = () =>
      deleteSupportConversation(conversation.id, "customer");
    document.querySelector("#customerChatForm").onsubmit = (event) =>
      sendChatMessage(event, conversation.id, refresh);
    await refresh();
    startChatRealtime(conversation.id, refresh);
  } catch (error) {
    console.error(error);
    workspace.innerHTML = '<div class="notice">No pudimos abrir el chat. Aplicá la última migración de Supabase y volvé a intentar.</div>';
  }
}
async function openCustomerOrderChat(orderId, order = null) {
  setAccountTab("order-chat");
  state.activeOrderId = orderId;
  const workspace = document.querySelector("#accountWorkspace");
  if (!workspace) return;
  workspace.innerHTML = '<div class="empty">Abriendo conversación del pedido…</div>';
  try {
    const conversation = await getOrderConversation(orderId);
    if (!conversation?.id) throw new Error("No se pudo crear la conversación");
    state.activeConversationId = conversation.id;
    await clearConversationNotifications(conversation.id);
    const label = orderProductsLabel(order || {}) || "Tu compra";
    workspace.innerHTML = `<div class="order-chat-context"><button class="text-button" id="backToCustomerOrders" type="button">← Volver a mis compras</button><span class="order-status ${order ? `status-${escapeHtml(order.status)}` : ""}">${order ? statusLabel(order.status) : "Pedido"}</span><h1>${escapeHtml(label)}</h1><p>Usá este espacio para consultar fechas de fabricación o entrega, retiro y formas de abonar el saldo.</p></div><div class="chat-head"><div><h3>Chat de la compra</h3><p>Conversación privada con administración · actualización en vivo.</p></div><div class="chat-head-actions"><span class="live-indicator"><i></i> En vivo</span><button class="btn danger" id="deleteCustomerOrderConversation" type="button">Eliminar chat</button></div></div><div id="customerOrderChatMessages" class="chat-messages"></div><form id="customerOrderChatForm" class="chat-form"><textarea name="message" maxlength="2000" rows="3" placeholder="Escribí una consulta sobre esta compra…" required></textarea><button class="btn cta" type="submit">Enviar</button></form>`;
    const refresh = () =>
      loadConversationMessages(
        conversation.id,
        document.querySelector("#customerOrderChatMessages"),
      );
    document.querySelector("#backToCustomerOrders").onclick = () => {
      setAccountTab("orders");
      workspace.innerHTML = '<div id="ordersList"><div class="empty">Cargando compras…</div></div>';
      loadOrders();
    };
    document.querySelector("#deleteCustomerOrderConversation").onclick = () =>
      deleteSupportConversation(conversation.id, "customer-order");
    document.querySelector("#customerOrderChatForm").onsubmit = (event) =>
      sendChatMessage(event, conversation.id, refresh);
    await refresh();
    startChatRealtime(conversation.id, refresh);
  } catch (error) {
    console.error(error);
    workspace.innerHTML = '<div class="notice">No pudimos abrir el chat de esta compra. Aplicá la migración 013 y volvé a intentar.</div>';
  }
}
function statusLabel(status) {
  return (
    {
      awaiting_payment: "Esperando pago",
      deposit_paid: "Seña pagada",
      paid: "Pagado",
      in_transit: "En camino",
      fulfilled: "Entregado",
      cancelled: "Cancelado",
    }[status] || status
  );
}

function renderAdminPanel({ openSection = true } = {}) {
  const container = document.querySelector("#adminPanelContent");
  if (!container) return;
  if (!isAdmin()) {
    container.innerHTML =
      '<div class="notice">Acceso exclusivo para administración.</div>';
    return;
  }
  state.activeConversationId = null;
  container.innerHTML = adminDashboard();
  bindAdminDashboard();
  if (openSection) openAdminSection(state.adminView || "products");
}
function adminDashboard() {
  return `<div class="admin-shell"><aside id="adminSidebar" class="admin-sidebar"><a class="admin-brand" href="#inicio"><img src="assets/logo-aceros-oeste.png" alt="Aceros Oeste"><span><b>ACEROS OESTE</b><small>Administración</small></span></a><nav class="admin-side-nav" aria-label="Panel de administración"><button class="admin-side-link primary" id="addProduct" data-admin-route="create-product" type="button"><i>＋</i><span>Crear producto</span></button><button class="admin-side-link" id="productsBtn" data-admin-route="products" type="button"><i>▤</i><span>Productos</span></button><button class="admin-side-link" id="usersBtn" data-admin-route="users" type="button"><i>●</i><span>Usuarios</span></button><button class="admin-side-link" id="categoriesBtn" data-admin-route="categories" type="button"><i>◇</i><span>Categorías</span></button><button class="admin-side-link" id="clientsBtn" data-admin-route="clients" type="button"><i>▧</i><span>Clientes y trabajos</span></button><button class="admin-side-link" id="chatsBtn" data-admin-route="chats" type="button"><i>▣</i><span>Chats</span></button><button class="admin-side-link" id="ordersBtn" data-admin-route="orders" type="button"><i>▱</i><span>Pedidos</span></button><button class="admin-side-link" id="invoicesBtn" data-admin-route="invoices" type="button"><i>F</i><span>Facturación</span></button><button class="admin-side-link" id="withdrawalsBtn" data-admin-route="withdrawals" type="button"><i>↩</i><span>Arrepentimientos</span></button><button class="admin-side-link" id="settingsBtn" data-admin-route="settings" type="button"><i>⚙</i><span>Configuración</span></button></nav><div class="admin-sidebar-bottom"><a class="admin-side-link" href="#inicio"><i>←</i><span>Volver a la tienda</span></a><button class="admin-side-link" id="logout" type="button"><i>↪</i><span>Cerrar sesión</span></button></div></aside><main class="admin-main"><header class="admin-topbar"><button id="adminSidebarToggle" class="admin-sidebar-toggle" type="button" aria-label="Abrir menú">☰</button><div><small>PANEL GENERAL</small><b>${escapeHtml(state.profile?.full_name || "Administrador")}</b></div>${avatarMarkup(state.profile, "user-avatar admin-top-avatar")}</header><div id="adminWorkspace" class="admin-workspace"></div></main></div>`;
}
function adminProductsMarkup() {
  return `<div class="admin-page-head"><div><p class="eyebrow orange">CATÁLOGO</p><h1>Productos</h1><p>Administrá precios, stock y publicaciones desde un solo lugar.</p></div><button class="btn cta" id="productsCreateButton" type="button">+ Crear producto</button></div><div class="admin-summary-strip"><span><b>${state.products.length}</b> publicaciones</span><span><b>${state.products.reduce((total, product) => total + Number(product.stock || 0), 0)}</b> unidades en stock</span></div><label class="admin-product-search"><span>⌕</span><input id="adminProductSearch" type="search" placeholder="Buscar por producto, SKU o categoría"></label>${state.products.length ? `<div class="admin-product-table"><div class="admin-product-table-head"><span>Publicación</span><span>Precio</span><span>Stock</span><span>Estado</span><span>Acciones</span></div><div id="adminProductList">${state.products.map((product) => adminProductRowMarkup(product)).join("")}</div></div>` : '<div class="notice">Todavía no hay productos publicados.</div>'}`;
}
function adminProductRowMarkup(product) {
  const media = product.images?.[0];
  const visual = media
    ? isVideoUrl(media)
      ? `<video src="${escapeHtml(media)}" muted playsinline></video>`
      : `<img src="${escapeHtml(media)}" alt="${escapeHtml(product.name)}">`
    : `<span>${escapeHtml(product.name.slice(0, 1).toUpperCase())}</span>`;
  const search = escapeHtml(
    `${product.name} ${product.sku} ${product.category}`.toLowerCase(),
  );
  return `<article class="admin-product-row" data-admin-product="${search}"><div class="admin-product-identity"><div class="admin-product-thumb">${visual}</div><div><b>${escapeHtml(product.name)}</b><small>SKU ${escapeHtml(product.sku || "Sin SKU")} · ${escapeHtml(product.category)}</small></div></div><strong>${money(product.price)}</strong><span class="admin-stock ${product.stock < 3 ? "low" : ""}">${Number(product.stock) || 0} u.</span><span class="admin-published"><i></i>${product.active === false ? "Pausado" : "Publicado"}</span><details class="admin-product-menu"><summary aria-label="Acciones de ${escapeHtml(product.name)}">⋮</summary><div><a href="#producto/${encodeURIComponent(product.slug)}">Ver producto</a><button type="button" data-edit="${product.id}">Modificar</button><button type="button" data-similar="${product.id}">Publicar similar</button></div></details></article>`;
}
function bindAdminProductRows() {
  document
    .querySelectorAll("#adminWorkspace [data-edit]")
    .forEach((node) => (node.onclick = () => openEditProduct(node.dataset.edit)));
  document
    .querySelectorAll("#adminWorkspace [data-similar]")
    .forEach(
      (node) =>
        (node.onclick = () => openEditProduct(null, node.dataset.similar)),
    );
  document.querySelector("#productsCreateButton")?.addEventListener("click", () =>
    openEditProduct(),
  );
  document.querySelector("#adminProductSearch")?.addEventListener("input", (event) => {
    const term = String(event.target.value || "").trim().toLowerCase();
    document.querySelectorAll("[data-admin-product]").forEach((row) =>
      row.classList.toggle(
        "hidden",
        Boolean(term) && !row.dataset.adminProduct.includes(term),
      ),
    );
  });
}
function openAdminProducts() {
  stopChatRealtime();
  state.adminView = "products";
  state.productEditorId = null;
  state.activeConversationId = null;
  setAdminActive("products");
  document.querySelector("#adminWorkspace").innerHTML = adminProductsMarkup();
  bindAdminProductRows();
}
function setAdminActive(view) {
  const activeView = view === "product-editor" ? "products" : view;
  document.querySelectorAll("[data-admin-route]").forEach((item) =>
    item.classList.toggle("active", item.dataset.adminRoute === activeView),
  );
  document.querySelector("#adminSidebar")?.classList.remove("open");
}
function openAdminSection(view) {
  if (view === "create-product") return openEditProduct();
  if (view === "product-editor")
    return openEditProduct(state.productEditorId);
  if (view === "users") return openAdminUsers();
  if (view === "categories") return openCategories();
  if (view === "clients") return openClientManager();
  if (view === "chats" || view === "conversation") return openAdminChats();
  if (view === "settings") return openSettings();
  if (view === "orders") return openAdminOrders();
  if (view === "invoices") return openAdminInvoices();
  if (view === "withdrawals") return openAdminWithdrawals();
  return openAdminProducts();
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
  document
    .querySelector("#invoicesBtn")
    ?.addEventListener("click", openAdminInvoices);
  document
    .querySelector("#withdrawalsBtn")
    ?.addEventListener("click", openAdminWithdrawals);
  document.querySelector("#chatsBtn")?.addEventListener("click", openAdminChats);
  document.querySelector("#logout")?.addEventListener("click", logout);
  document.querySelector("#adminSidebarToggle")?.addEventListener("click", () =>
    document.querySelector("#adminSidebar")?.classList.toggle("open"),
  );
}
async function openAdminUsers() {
  stopChatRealtime();
  state.adminView = "users";
  setAdminActive("users");
  state.activeConversationId = null;
  const workspace = document.querySelector("#adminWorkspace");
  workspace.innerHTML = '<div class="empty">Cargando usuarios…</div>';
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,phone,role,avatar_url,avatar_preset,created_at")
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
  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.onclick = () =>
      deleteAdminUser(
        button.dataset.deleteUser,
        button.dataset.userName || "este usuario",
        button,
      );
  });
}
function adminUserMarkup(profile) {
  const name = profile.full_name?.trim() || "Sin nombre";
  const email =
    profile.role === "admin"
      ? normalizedContactEmail(profile.email)
      : profile.email?.trim() || "Sin email";
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
  const canDelete =
    profile.role !== "admin" && String(profile.id) !== String(state.user?.id);
  return `<article class="admin-user-card" data-admin-user="${search}"><div class="admin-user-primary">${avatarMarkup(profile, "user-avatar admin-list-avatar")}<div><b>${escapeHtml(name)}</b><small>${profile.role === "admin" ? "Administrador" : "Cliente"} · Alta ${escapeHtml(createdAt)}</small></div></div><div class="admin-user-details"><span><small>Email</small>${email !== "Sin email" ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : `<b>${email}</b>`}</span><span><small>Teléfono</small><b>${escapeHtml(phone)}</b></span></div><div class="admin-user-actions">${email !== "Sin email" ? `<a class="btn outline" href="mailto:${escapeHtml(email)}">Enviar email</a>` : ""}${whatsapp ? `<a class="btn secondary" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : ""}${canDelete ? `<button class="btn danger" type="button" data-delete-user="${escapeHtml(profile.id)}" data-user-name="${escapeHtml(name)}">Eliminar cuenta</button>` : ""}</div></article>`;
}
async function deleteAdminUser(userId, userName, button) {
  if (
    !(await confirmAction({
      title: `Eliminar cuenta de ${userName}`,
      message:
        "Sus chats se borrarán, pero los pedidos pagados se conservarán como registro. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar cuenta",
    }))
  )
    return;
  setBusy(button, true, "Eliminando…");
  const { data, error } = await supabase.functions.invoke("admin-delete-user", {
    body: { userId },
  });
  setBusy(button, false);
  if (error || !data?.deleted) {
    let message = data?.error;
    if (error?.context?.json) {
      try {
        message = (await error.context.json())?.error || message;
      } catch {
        // Se muestra el mensaje general si la respuesta no contiene JSON.
      }
    }
    return toast(
      message || error?.message || "No se pudo eliminar la cuenta.",
      "error",
    );
  }
  toast("Cuenta eliminada", "success");
  await openAdminUsers();
}
function openCategories() {
  stopChatRealtime();
  state.adminView = "categories";
  setAdminActive("categories");
  state.activeConversationId = null;
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
      if (
        !(await confirmAction({
          title: "Eliminar categoría",
          message:
            "Los productos asociados quedarán sin categoría hasta que los vuelvas a editar.",
          confirmLabel: "Eliminar categoría",
        }))
      )
        return;
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
  state.adminView = "clients";
  setAdminActive("clients");
  state.activeConversationId = null;
  const ws = document.querySelector("#adminWorkspace");
  ws.innerHTML = `<div class="admin-section-title"><div><h3>Clientes y trabajos</h3><p>Publicá marcas y fotos de los trabajos realizados.</p></div><button class="btn cta" id="addClient">+ Agregar cliente</button></div><div class="client-admin-list">${state.clients.map((client) => `<div class="admin-row"><b>${escapeHtml(client.name)}</b><span>${escapeHtml(client.category || "Cliente")}</span><span>${client.images?.length || 0} fotos</span><div><button class="remove" data-edit-client="${client.id}">Editar</button> <button class="remove" data-delete-client="${client.id}">Eliminar</button></div></div>`).join("") || '<div class="notice">Todavía no agregaste clientes.</div>'}</div>`;
  document.querySelector("#addClient").onclick = () => openClientEditor();
  document.querySelectorAll("[data-edit-client]").forEach((button) => button.onclick = () => openClientEditor(button.dataset.editClient));
  document.querySelectorAll("[data-delete-client]").forEach((button) => {
    button.onclick = async () => {
      if (
        !(await confirmAction({
          title: "Eliminar cliente",
          message:
            "Se eliminará la publicación del cliente y dejará de verse en la tienda.",
          confirmLabel: "Eliminar cliente",
        }))
      )
        return;
      const { error } = await supabase.from("client_projects").delete().eq("id", button.dataset.deleteClient);
      if (error) return toast(error.message, "error");
      await loadStoreData(); renderAdminPanel(); openClientManager(); toast("Cliente eliminado", "success");
    };
  });
}
function openClientEditor(id) {
  const client = state.clients.find((item) => item.id === id) || { name: "", category: "Gastronomía", description: "", logo_url: "", images: [], sort_order: 0 };
  openModal(`<button class="modal-close" data-close>×</button><p class="eyebrow orange">${id ? "EDITAR" : "NUEVO"} CLIENTE</p><h2>${id ? "Actualizar publicación" : "Agregar cliente"}</h2><form id="clientForm" class="form-grid"><div class="field"><label>Nombre</label><input name="name" value="${escapeHtml(client.name)}" required></div><div class="field"><label>Rubro</label><input name="category" value="${escapeHtml(client.category)}"></div><div class="field full"><label>Descripción del trabajo</label><textarea name="description" rows="8" placeholder="Trabajos realizados, materiales, medidas y detalles del proyecto.">${escapeHtml(client.description)}</textarea></div><div class="field full"><label class="image-upload-label">Logo del cliente<input id="clientLogo" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>${client.logo_url ? `<img class="preview-admin-img" src="${escapeHtml(client.logo_url)}" alt="Logo actual">` : ""}</div><div class="field full"><label class="image-upload-label">Fotos de trabajos<input id="clientPhotos" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label><small>Podés agregar varias ahora o volver más adelante. Se mostrarán una debajo de otra.</small><div class="media-admin-grid">${(client.images || []).map((url) => `<label class="media-admin-item"><img src="${escapeHtml(url)}" alt="Trabajo"><span><input type="checkbox" value="${escapeHtml(url)}" data-remove-client-photo> Quitar</span></label>`).join("")}</div></div><button class="btn cta field full">Guardar cliente</button></form>`);
  document.querySelector("#clientForm").onsubmit = (event) => saveClient(event, client);
}
async function saveClient(event, current) {
  event.preventDefault();
  const button = event.submitter;
  const values = Object.fromEntries(new FormData(event.target));
  values.sort_order = current.id
    ? Number(current.sort_order) || 0
    : Math.max(0, ...state.clients.map((item) => Number(item.sort_order) || 0)) + 10;
  values.is_active = true;
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
  state.adminView = "settings";
  setAdminActive("settings");
  state.activeConversationId = null;
  const ws = document.querySelector("#adminWorkspace");
  ws.innerHTML = `<div class="admin-page-head"><div><p class="eyebrow orange">AJUSTES</p><h1>Configuración de la tienda</h1><p>Valores comerciales y fiscales que usarán las publicaciones nuevas o editadas.</p></div></div><form id="settingsForm" class="settings-sections"><section><h3>Ventas y contacto</h3><div class="form-grid"><div class="field"><label>Porcentaje de seña</label><input name="deposit_percentage" type="number" min="1" max="100" value="${state.settings.deposit_percentage || 50}"></div><div class="field"><label>WhatsApp de ventas</label><input name="sales_whatsapp" value="${escapeHtml(state.settings.sales_whatsapp || "")}"></div><div class="field full"><label>Email de contacto</label><input name="contact_email" type="email" value="${escapeHtml(normalizedContactEmail(state.settings.contact_email))}"></div></div></section><section><h3>Calculadora de precios</h3><p>Definí valores iniciales para publicaciones nuevas. En cada producto ingresás un costo o valor neto de partida y la calculadora propone el precio final; las publicaciones existentes no cambian solas.</p><div class="form-grid"><div class="field"><label>IVA incluido en el precio final (%)</label><input name="vat_rate" type="number" min="0" max="100" step="0.01" value="${Number(state.settings.vat_rate ?? 21)}"><small>Usá la alícuota que confirme tu contador. El sistema la incorpora al precio publicado, no la suma después de la compra.</small></div><div class="field"><label>Costo de cobro estimado (%)</label><input name="payment_fee_rate" type="number" min="0" max="99" step="0.01" value="${Number(state.settings.payment_fee_rate ?? 7)}"><small>Es el porcentaje que Mercado Pago descuenta por procesar el cobro. Cargá la tasa real según tu plazo de acreditación; no IVA + comisión juntos.</small></div><div class="field"><label>Margen comercial adicional (%)</label><input name="commercial_margin_rate" type="number" min="0" max="500" step="0.01" value="${Number(state.settings.commercial_margin_rate ?? 0)}"><small>Es la ganancia o colchón que querés agregar sobre la base antes de impuestos y costo de cobro. En 0 no agrega margen.</small></div><div class="field"><label>Redondear hacia arriba cada</label><input name="pricing_rounding" type="number" min="0" step="0.01" value="${Number(state.settings.pricing_rounding ?? 100)}"><small>Ejemplo: con 100, un resultado de $130.108 se publica como $130.200.</small></div></div></section><section><h3>Facturación asistida</h3><p>Completá estos datos únicamente después de confirmarlos con tu contador.</p><div class="form-grid"><div class="field"><label>Modo</label><select name="invoice_mode"><option value="assisted" ${state.settings.invoice_mode === "assisted" ? "selected" : ""}>Asistido desde ARCA</option><option value="automated" ${state.settings.invoice_mode === "automated" ? "selected" : ""}>Automatizado (requiere integración)</option><option value="disabled" ${state.settings.invoice_mode === "disabled" ? "selected" : ""}>Desactivado</option></select></div><div class="field"><label>Condición de Aceros Oeste</label><select name="issuer_tax_status"><option value="pending_accountant" ${state.settings.issuer_tax_status === "pending_accountant" ? "selected" : ""}>Pendiente de contador</option><option value="responsable_inscripto" ${state.settings.issuer_tax_status === "responsable_inscripto" ? "selected" : ""}>Responsable inscripto</option><option value="monotributista" ${state.settings.issuer_tax_status === "monotributista" ? "selected" : ""}>Monotributista</option><option value="exento" ${state.settings.issuer_tax_status === "exento" ? "selected" : ""}>Exento</option></select></div><div class="field"><label>CUIT emisor</label><input name="issuer_cuit" inputmode="numeric" value="${escapeHtml(state.settings.issuer_cuit || "")}" placeholder="Confirmar con contador"></div><div class="field"><label>Punto de venta</label><input name="invoice_point_of_sale" type="number" min="1" value="${escapeHtml(state.settings.invoice_point_of_sale || "")}" placeholder="Confirmar con contador"></div><div class="field"><label>Comprobante predeterminado</label><select name="default_invoice_type"><option value="">Definir con contador</option><option value="Factura A" ${state.settings.default_invoice_type === "Factura A" ? "selected" : ""}>Factura A</option><option value="Factura B" ${state.settings.default_invoice_type === "Factura B" ? "selected" : ""}>Factura B</option><option value="Factura C" ${state.settings.default_invoice_type === "Factura C" ? "selected" : ""}>Factura C</option></select></div></div></section><button class="btn cta" type="submit">Guardar configuración</button></form>`;
  document.querySelector("#settingsForm").onsubmit = async (e) => {
    e.preventDefault();
    const button = e.submitter,
      values = Object.fromEntries(new FormData(e.target));
    values.deposit_percentage = Number(values.deposit_percentage);
    values.vat_rate = Number(values.vat_rate);
    values.payment_fee_rate = Number(values.payment_fee_rate);
    values.commercial_margin_rate = Number(values.commercial_margin_rate);
    values.pricing_rounding = Number(values.pricing_rounding);
    values.sales_whatsapp = normalizedWhatsapp(values.sales_whatsapp);
    values.freight_whatsapp = values.sales_whatsapp;
    values.invoice_point_of_sale = values.invoice_point_of_sale
      ? Number(values.invoice_point_of_sale)
      : null;
    values.issuer_cuit = String(values.issuer_cuit || "").replace(/\D/g, "") || null;
    values.default_invoice_type = values.default_invoice_type || null;
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
  state.adminView = "chats";
  setAdminActive("chats");
  state.activeConversationId = null;
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
      .select("id,full_name,avatar_url,avatar_preset")
      .in("id", userIds);
    profiles = Array.isArray(data) ? data : data ? [data] : [];
  }
  const profilesById = Object.fromEntries(
    profiles.map((profile) => [profile.id, profile]),
  );
  workspace.innerHTML = `<div class="admin-section-title"><div><h3>Chats privados</h3><p>Las conversaciones y los mensajes nuevos aparecen automáticamente.</p></div><span class="live-indicator"><i></i> En vivo</span></div><div class="admin-chat-list">${conversations?.length ? conversations.map((conversation) => {
    const profile = profilesById[conversation.user_id] || {};
    const name = profile.full_name || "Cliente";
    return `<button class="admin-chat-card" type="button" data-open-admin-chat="${conversation.id}" data-admin-chat-name="${escapeHtml(name)}" data-admin-chat-order="${escapeHtml(conversation.order_id || "")}">${avatarMarkup(profile, "user-avatar admin-chat-avatar")}<span><b>${escapeHtml(name)}</b><small>${conversation.order_id ? `Pedido ${escapeHtml(String(conversation.order_id).slice(0, 8).toUpperCase())}` : "Consulta general"} · ${conversation.status === "closed" ? "Cerrado" : "Abierto"}</small></span><time>${new Date(conversation.updated_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</time></button>`;
  }).join("") : '<div class="notice">Todavía no hay conversaciones.</div>'}</div>`;
  document.querySelectorAll("[data-open-admin-chat]").forEach((button) => {
    button.onclick = () =>
      openAdminConversation(
        button.dataset.openAdminChat,
        button.dataset.adminChatName,
        { orderId: button.dataset.adminChatOrder || null },
      );
  });
}
async function openAdminConversation(conversationId, customerName, context = {}) {
  state.adminView = context.backToOrders ? "order-conversation" : "conversation";
  setAdminActive(context.backToOrders ? "orders" : "chats");
  state.activeConversationId = conversationId;
  state.activeConversationName = customerName || "Cliente";
  state.activeOrderId = context.orderId || null;
  await clearConversationNotifications(conversationId);
  const workspace = document.querySelector("#adminWorkspace");
  const title = context.orderLabel || customerName || "Cliente";
  workspace.innerHTML = `<div class="chat-head"><div><button class="text-button" id="backToAdminChats" type="button">← Volver a ${context.backToOrders ? "pedidos" : "chats"}</button><h3>${escapeHtml(title)}</h3><p>${context.orderId ? `Chat del pedido con ${escapeHtml(customerName || "Cliente")}. Informá plazos, entrega y saldo pendiente.` : "Conversación privada que se actualiza automáticamente."}</p></div><div class="chat-head-actions"><span class="live-indicator"><i></i> En vivo</span><button class="btn danger" id="deleteAdminConversation" type="button">Eliminar chat</button></div></div><div id="adminChatMessages" class="chat-messages"></div><form id="adminChatForm" class="chat-form"><textarea name="message" maxlength="2000" rows="3" placeholder="${context.orderId ? "Informá fechas, retiro, entrega o cómo abonar el saldo…" : "Responder al cliente…"}" required></textarea><button class="btn cta" type="submit">Enviar respuesta</button></form>`;
  const refresh = () =>
    loadConversationMessages(
      conversationId,
      document.querySelector("#adminChatMessages"),
    );
  document.querySelector("#backToAdminChats").onclick = context.backToOrders
    ? openAdminOrders
    : openAdminChats;
  document.querySelector("#deleteAdminConversation").onclick = () =>
    deleteSupportConversation(
      conversationId,
      context.backToOrders ? "admin-order" : "admin",
    );
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
  state.adminView = "orders";
  setAdminActive("orders");
  state.activeConversationId = null;
  const ws = document.querySelector("#adminWorkspace");
  ws.innerHTML = '<div class="empty">Cargando pedidos…</div>';
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .in("status", ["deposit_paid", "paid", "in_transit", "fulfilled", "cancelled"])
    .is("admin_archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    ws.innerHTML = '<div class="notice">No pudimos cargar los pedidos.</div>';
    return;
  }
  const visibleOrders = (data || []).filter((order) =>
    ["deposit_paid", "paid", "in_transit", "fulfilled", "cancelled"].includes(
      order.status,
    ),
  );
  const userIds = [...new Set(visibleOrders.map((order) => order.user_id).filter(Boolean))];
  let profiles = [];
  if (userIds.length) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id,full_name,avatar_url,avatar_preset")
      .in("id", userIds);
    profiles = Array.isArray(profileData) ? profileData : profileData ? [profileData] : [];
  }
  const profilesById = Object.fromEntries(
    profiles.map((profile) => [profile.id, profile]),
  );
  ws.innerHTML = `<div class="admin-page-head"><div><p class="eyebrow orange">VENTAS</p><h1>Pedidos</h1><p>Compras con pago o seña acreditada. Los cambios se sincronizan en vivo.</p></div><span class="live-indicator"><i></i> En vivo</span></div>${visibleOrders.length ? `<div class="admin-orders-list">${visibleOrders.map((order) => adminOrderMarkup(order, profilesById[order.user_id])).join("")}</div>` : '<div class="notice">No hay pedidos con pago acreditado.</div>'}`;
  await clearOrderNotifications(visibleOrders.map((order) => order.id));
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
      if (
        !(await confirmAction({
          title: "Archivar pedido finalizado",
          message:
            "El pedido dejará de verse en Pedidos, pero conservará sus facturas, solicitudes y trazabilidad.",
          confirmLabel: "Archivar pedido",
        }))
      )
        return;
      const { error } = await supabase
        .from("orders")
        .update({ admin_archived_at: new Date().toISOString() })
        .eq("id", button.dataset.deleteOrder)
        .in("status", ["fulfilled", "cancelled"]);
      if (error) return toast(error.message, "error");
      button.closest("[data-order-card]")?.remove();
      toast("Pedido archivado", "success");
    };
  });
  document.querySelectorAll("[data-admin-order-chat]").forEach((button) => {
    button.onclick = async () => {
      const order = visibleOrders.find(
        (item) => String(item.id) === String(button.dataset.adminOrderChat),
      );
      setBusy(button, true, "Abriendo…");
      try {
        const conversation = await getOrderConversation(order.id);
        await openAdminConversation(
          conversation.id,
          order.customer_name || "Cliente",
          {
            orderId: order.id,
            orderLabel: orderProductsLabel(order),
            backToOrders: true,
          },
        );
      } catch (error) {
        toast(error.message || "No se pudo abrir el chat del pedido", "error");
      } finally {
        setBusy(button, false);
      }
    };
  });
}

function adminOrderMarkup(order, profile = {}) {
  const name = profile.full_name || order.customer_name || "Sin nombre";
  const balance = Math.max(
    0,
    Number(order.subtotal || 0) - Number(order.amount_to_pay || order.subtotal || 0),
  );
  const products = (order.order_items || []).map((item) => {
    const image = orderItemImage(item);
    return `<div class="admin-order-product"><div>${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.product_name || "Producto")}">` : `<span>${escapeHtml(String(item.product_name || "P").slice(0, 1))}</span>`}</div><p><b>${escapeHtml(item.product_name || "Producto")}</b><small>${Math.max(1, Number(item.quantity) || 1)} unidad${Number(item.quantity) === 1 ? "" : "es"}</small></p></div>`;
  }).join("");
  return `<article class="admin-order-card" data-order-card="${order.id}"><header><div class="admin-order-customer">${avatarMarkup(profile, "user-avatar admin-order-avatar")}<div><small>CLIENTE</small><b>${escapeHtml(name)}</b><span>${escapeHtml(order.customer_email || "Sin email")} · ${escapeHtml(order.customer_phone || "Sin teléfono")}</span></div></div><div><span class="order-status status-${escapeHtml(order.status)}">${statusLabel(order.status)}</span><small>Pedido ${escapeHtml(String(order.id).slice(0, 8).toUpperCase())}</small></div></header><div class="admin-order-products">${products || '<span class="notice">Sin detalle de productos</span>'}</div><div class="admin-order-finance"><span><small>Total</small><b>${money(order.subtotal)}</b></span><span><small>${order.payment_type === "deposit" ? "Seña" : "Acreditado"}</small><b>${money(order.amount_to_pay || order.subtotal)}</b></span>${balance ? `<span class="pending"><small>Saldo pendiente</small><b>${money(balance)}</b></span>` : ""}</div><div class="admin-order-actions"><label class="order-status-label">Estado<select data-order-status="${order.id}">${["deposit_paid", "paid", "in_transit", "fulfilled", "cancelled"].map((status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}</select></label><button class="btn cta" data-admin-order-chat="${order.id}" type="button">Abrir chat del pedido</button>${["fulfilled", "cancelled"].includes(order.status) ? `<button class="btn danger" data-delete-order="${order.id}" type="button">Archivar pedido</button>` : ""}</div></article>`;
}

function billingConditionLabel(value) {
  return (
    {
      consumer_final: "Consumidor final",
      monotributista: "Monotributista",
      responsable_inscripto: "Responsable inscripto",
      exento: "Exento",
    }[value] || "Sin informar"
  );
}

async function openAdminInvoices() {
  stopChatRealtime();
  state.adminView = "invoices";
  setAdminActive("invoices");
  const workspace = document.querySelector("#adminWorkspace");
  workspace.innerHTML = '<div class="empty">Cargando facturación…</div>';
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), invoices(*)")
    .in("status", ["deposit_paid", "paid", "in_transit", "fulfilled", "cancelled"])
    .is("billing_archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error(error);
    workspace.innerHTML = '<div class="notice">No pudimos cargar la facturación. Aplicá la migración 017.</div>';
    return;
  }
  const orders = data || [];
  const pending = orders.filter(
    (order) => !["invoiced", "not_applicable"].includes(order.billing_status),
  ).length;
  workspace.innerHTML = `<div class="admin-page-head"><div><p class="eyebrow orange">COMPROBANTES</p><h1>Facturación</h1></div><span class="session-badge">${pending} pendientes</span></div><div class="invoice-admin-list">${orders.length ? orders.map(adminInvoiceOrderMarkup).join("") : '<div class="notice">No hay ventas acreditadas para facturar.</div>'}</div>`;
  document.querySelectorAll("[data-create-invoice]").forEach((button) => {
    button.onclick = () =>
      openInvoiceEditor(
        orders.find((order) => String(order.id) === button.dataset.createInvoice),
      );
  });
  document.querySelectorAll("[data-admin-invoice-download]").forEach((button) => {
    button.onclick = () => downloadInvoice(button.dataset.adminInvoiceDownload, button);
  });
  document.querySelectorAll("[data-resend-invoice]").forEach((button) => {
    button.onclick = () => resendAdminInvoice(button.dataset.resendInvoice, button);
  });
  document.querySelectorAll("[data-delete-invoice]").forEach((button) => {
    button.onclick = () => {
      const order = orders.find((item) =>
        (item.invoices || []).some(
          (invoice) => String(invoice.id) === button.dataset.deleteInvoice,
        ),
      );
      const invoice = (order?.invoices || []).find(
        (item) => String(item.id) === button.dataset.deleteInvoice,
      );
      deleteInvoiceVoucher(invoice, order, button);
    };
  });
  document.querySelectorAll("[data-archive-billing]").forEach((button) => {
    button.onclick = () =>
      archiveBillingOrder(
        orders.find(
          (order) => String(order.id) === button.dataset.archiveBilling,
        ),
        button,
      );
  });
}

function adminInvoiceOrderMarkup(order) {
  const invoices = order.invoices || [];
  const invoiced = invoices
    .filter((invoice) => invoice.status !== "cancelled")
    .reduce((sum, invoice) => sum + Number(invoice.gross_amount || 0), 0);
  const billingLabel =
    order.billing_status === "invoiced"
      ? "Facturado"
      : order.billing_status === "partial"
        ? "Facturación parcial"
        : order.billing_status === "not_applicable"
          ? "Compra cancelada"
          : "Pendiente";
  return `<article class="invoice-order-card" data-invoice-order-card="${order.id}"><header><div><small>PEDIDO ${escapeHtml(String(order.id).slice(0, 8).toUpperCase())}</small><h3>${escapeHtml(orderProductsLabel(order) || "Compra")}</h3><p>${escapeHtml(order.customer_name || "Cliente")} · ${escapeHtml(order.customer_email || "Sin email")}</p></div><span class="billing-status billing-${escapeHtml(order.billing_status || "pending")}">${billingLabel}</span></header><div class="invoice-order-data"><span><small>Condición</small><b>${escapeHtml(billingConditionLabel(order.billing_condition))}</b></span><span><small>Razón social</small><b>${escapeHtml(order.billing_name || order.customer_name || "Sin informar")}</b></span><span><small>Documento</small><b>${escapeHtml([order.billing_document_type, order.billing_document_number].filter(Boolean).join(" ") || "Sin informar")}</b></span><span><small>Total del pedido</small><b>${money(order.subtotal)}</b></span><span><small>Ya registrado</small><b>${money(invoiced)}</b></span></div><div class="invoice-doc-list">${invoices.length ? invoices.map((invoice) => adminInvoiceDocumentMarkup(invoice, order)).join("") : '<small>Todavía no hay comprobantes registrados.</small>'}</div><footer><button class="btn outline" type="button" data-archive-billing="${order.id}">Quitar del panel</button><button class="btn cta" type="button" data-create-invoice="${order.id}">Registrar comprobante</button></footer></article>`;
}

function adminInvoiceDocumentMarkup(invoice, order) {
  const number = invoice.invoice_number
    ? `${String(invoice.point_of_sale || 0).padStart(5, "0")}-${String(invoice.invoice_number).padStart(8, "0")}`
    : "Sin numeración";
  return `<div><span><b>${escapeHtml(invoice.invoice_type)}</b><small>${number} · ${money(invoice.gross_amount)} · ${invoice.status === "sent" ? "Enviada" : "Registrada"}</small></span><div class="invoice-document-actions">${invoice.pdf_path ? `<button class="text-button" type="button" data-admin-invoice-download="${escapeHtml(invoice.pdf_path)}">Ver PDF</button>` : ""}${invoice.pdf_path ? `<button class="text-button" type="button" data-resend-invoice="${invoice.id}">${invoice.status === "sent" ? "Reenviar" : "Enviar"}</button>` : ""}${order.status === "cancelled" ? `<button class="text-button danger-text" type="button" data-delete-invoice="${invoice.id}">Eliminar comprobante</button>` : ""}</div></div>`;
}

async function deleteInvoiceVoucher(invoice, order, button) {
  if (!invoice || !order || order.status !== "cancelled")
    return toast(
      "Sólo se puede eliminar un comprobante cuando la compra está cancelada.",
      "error",
    );
  const number = invoice.invoice_number
    ? `${String(invoice.point_of_sale || 0).padStart(5, "0")}-${String(invoice.invoice_number).padStart(8, "0")}`
    : "sin numeración";
  if (
    !(await confirmAction({
      title: "Eliminar comprobante",
      message: `${invoice.invoice_type} ${number}: se borrarán el registro y el PDF de la web. Esto no anula un comprobante emitido en ARCA; si tiene CAE, primero corresponde emitir la nota de crédito.`,
      confirmLabel: "Eliminar comprobante",
    }))
  )
    return;
  setBusy(button, true, "Eliminando…");
  const { data, error } = await supabase.functions.invoke(
    "delete-invoice-voucher",
    { body: { invoiceId: invoice.id } },
  );
  setBusy(button, false);
  if (error || !data?.deleted) {
    let message = data?.error;
    if (!message && error?.context?.json) {
      try {
        message = (await error.context.json())?.error;
      } catch {
        // Se conserva el mensaje entendible de respaldo.
      }
    }
    return toast(
      readableFunctionError(
        message || error?.message,
        "No se pudo eliminar el comprobante.",
      ),
      "error",
    );
  }
  await openAdminInvoices();
  toast(
    data.warning || "Comprobante y PDF eliminados.",
    data.warning ? "error" : "success",
  );
}

async function resendAdminInvoice(invoiceId, button) {
  setBusy(button, true, "Enviando…");
  const { data, error } = await supabase.functions.invoke(
    "send-invoice-email",
    { body: { invoiceId } },
  );
  setBusy(button, false);
  if (error || !data?.sent) {
    let message = data?.error;
    if (!message && error?.context?.json) {
      try {
        message = (await error.context.json())?.error;
      } catch {
        // Se conserva un mensaje entendible si la respuesta no es JSON.
      }
    }
    return toast(
      readableFunctionError(
        message || error?.message,
        "La factura quedó guardada, pero el correo no se pudo enviar.",
      ),
      "error",
    );
  }
  await openAdminInvoices();
  toast("Factura enviada al cliente.", "success");
}

async function archiveBillingOrder(order, button) {
  if (!order) return toast("No pudimos encontrar este pedido.", "error");
  const pending = !["invoiced", "not_applicable"].includes(
    order.billing_status,
  );
  if (
    !(await confirmAction({
      title: "Quitar facturación del panel",
      message: pending
        ? "El registro dejará de verse en Facturación, pero seguirá pendiente y se conservarán el pedido y sus datos. Esta acción no genera una factura ni lo marca como facturado."
        : "El detalle dejará de verse en esta lista, pero la factura y el pedido se conservarán.",
      confirmLabel: "Quitar del panel",
    }))
  )
    return;
  setBusy(button, true, "Quitando…");
  const { error } = await supabase
    .from("orders")
    .update({ billing_archived_at: new Date().toISOString() })
    .eq("id", order.id);
  setBusy(button, false);
  if (error) return toast(error.message, "error");
  await openAdminInvoices();
  toast("Detalle quitado del panel de facturación.", "success");
}

function openInvoiceEditor(order) {
  if (!order) return;
  const defaultVat = Number(state.settings.vat_rate ?? 21);
  const defaultAmount =
    order.payment_type === "deposit"
      ? Number(order.amount_to_pay || 0)
      : Number(order.subtotal || 0);
  openModal(`<button class="modal-close" data-close>×</button><p class="eyebrow orange">FACTURACIÓN ASISTIDA</p><h2>Registrar comprobante</h2><p class="modal-copy">Pedido ${escapeHtml(String(order.id).slice(0, 8).toUpperCase())} · ${escapeHtml(orderProductsLabel(order))}</p><form id="invoiceForm" class="form-grid"><div class="field"><label>Tipo de comprobante</label><select name="invoice_type"><option value="Factura A" ${state.settings.default_invoice_type === "Factura A" ? "selected" : ""}>Factura A</option><option value="Factura B" ${!state.settings.default_invoice_type || state.settings.default_invoice_type === "Factura B" ? "selected" : ""}>Factura B</option><option value="Factura C" ${state.settings.default_invoice_type === "Factura C" ? "selected" : ""}>Factura C</option><option value="Nota de crédito A">Nota de crédito A</option><option value="Nota de crédito B">Nota de crédito B</option><option value="Nota de crédito C">Nota de crédito C</option></select></div><div class="field"><label>Concepto</label><select name="scope"><option value="${order.payment_type === "deposit" ? "deposit" : "full"}">${order.payment_type === "deposit" ? "Seña / anticipo" : "Pago completo"}</option><option value="balance">Saldo</option><option value="credit_note">Nota de crédito</option></select></div><div class="field"><label>Punto de venta</label><input name="point_of_sale" type="number" min="1" value="${escapeHtml(state.settings.invoice_point_of_sale || "")}" required></div><div class="field"><label>Número</label><input name="invoice_number" type="number" min="1" required></div><div class="field"><label>CAE</label><input name="cae" maxlength="30" required></div><div class="field"><label>Vencimiento CAE</label><input name="cae_expiration" type="date" required></div><div class="field"><label>Fecha de emisión</label><input name="issued_at" type="date" value="${new Date().toISOString().slice(0, 10)}" required></div><div class="field"><label>IVA de referencia</label><input name="vat_rate" id="invoiceVatRate" type="number" min="0" max="100" step="0.01" value="${defaultVat}" required></div><div class="field full"><label>Total del comprobante</label><input name="gross_amount" id="invoiceGrossAmount" type="number" min="0" step="0.01" value="${defaultAmount}" required><small>Debe coincidir con el comprobante emitido. El sistema calcula neto e IVA sin modificar el total cobrado.</small></div><div class="invoice-calculation field full" id="invoiceCalculation"></div><div class="field full"><label class="invoice-pdf-upload">Adjuntar factura PDF<input id="invoicePdf" type="file" accept="application/pdf" required></label><small>PDF emitido desde ARCA · máximo 10 MB.</small></div><button class="btn cta field full" type="submit">Guardar y enviar al cliente</button></form>`);
  const renderCalculation = () => {
    const gross = Number(document.querySelector("#invoiceGrossAmount").value || 0);
    const vat = Number(document.querySelector("#invoiceVatRate").value || 0);
    const net = vat ? gross / (1 + vat / 100) : gross;
    document.querySelector("#invoiceCalculation").innerHTML = `<span>Neto estimado <b>${money(net)}</b></span><span>IVA ${vat}% <b>${money(gross - net)}</b></span><span>Total <b>${money(gross)}</b></span>`;
  };
  document.querySelector("#invoiceGrossAmount").oninput = renderCalculation;
  document.querySelector("#invoiceVatRate").oninput = renderCalculation;
  renderCalculation();
  document.querySelector("#invoiceForm").onsubmit = (event) =>
    saveInvoice(event, order);
}

async function saveInvoice(event, order) {
  event.preventDefault();
  const button = event.submitter;
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const file = document.querySelector("#invoicePdf")?.files?.[0];
  if (!file || file.type !== "application/pdf")
    return toast("Adjuntá la factura en formato PDF.", "error");
  if (file.size > 10_000_000)
    return toast("El PDF supera los 10 MB.", "error");
  setBusy(button, true, "Guardando…");
  let pdfPath = "";
  try {
    pdfPath = `${order.id}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("invoice-documents")
      .upload(pdfPath, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;
    const gross = Number(values.gross_amount || 0);
    const vatRate = Number(values.vat_rate || 0);
    const net = vatRate ? gross / (1 + vatRate / 100) : gross;
    const payload = {
      order_id: order.id,
      user_id: order.user_id,
      invoice_type: values.invoice_type,
      scope: values.scope,
      point_of_sale: Number(values.point_of_sale),
      invoice_number: Number(values.invoice_number),
      cae: String(values.cae || "").trim(),
      cae_expiration: values.cae_expiration,
      issued_at: new Date(`${values.issued_at}T12:00:00`).toISOString(),
      net_amount: Math.round(net * 100) / 100,
      vat_rate: vatRate,
      vat_amount: Math.round((gross - net) * 100) / 100,
      gross_amount: gross,
      pdf_path: pdfPath,
      status: "authorized",
    };
    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    const previousAmount = (order.invoices || [])
      .filter((item) => item.status !== "cancelled")
      .reduce((sum, item) => sum + Number(item.gross_amount || 0), 0);
    const billingStatus =
      values.scope === "full" || previousAmount + gross >= Number(order.subtotal || 0)
        ? "invoiced"
        : "partial";
    await supabase
      .from("orders")
      .update({ billing_status: billingStatus })
      .eq("id", order.id);
    const { error: emailError } = await supabase.functions.invoke(
      "send-invoice-email",
      { body: { invoiceId: invoice.id } },
    );
    closeModal();
    await openAdminInvoices();
    toast(
      emailError
        ? "Factura guardada, pero el email no pudo enviarse."
        : "Factura guardada y enviada al cliente.",
      emailError ? "error" : "success",
    );
  } catch (error) {
    if (pdfPath)
      await supabase.storage.from("invoice-documents").remove([pdfPath]);
    toast(error.message || "No se pudo registrar la factura.", "error");
  } finally {
    setBusy(button, false);
  }
}

async function openAdminWithdrawals() {
  stopChatRealtime();
  state.adminView = "withdrawals";
  setAdminActive("withdrawals");
  const workspace = document.querySelector("#adminWorkspace");
  workspace.innerHTML = '<div class="empty">Cargando solicitudes…</div>';
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*, orders(customer_name,customer_email,subtotal,payment_type,status)")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error(error);
    workspace.innerHTML = '<div class="notice">No pudimos cargar las solicitudes. Aplicá la migración 017.</div>';
    return;
  }
  const requests = data || [];
  workspace.innerHTML = `<div class="admin-page-head"><div><p class="eyebrow orange">POSVENTA</p><h1>Arrepentimientos</h1><p>Revisá cada solicitud, documentá la resolución y mantené informado al cliente.</p></div><span class="session-badge">${requests.filter((item) => !["rejected", "closed"].includes(item.status)).length} abiertas</span></div><div class="withdrawal-admin-list">${requests.length ? requests.map(adminWithdrawalMarkup).join("") : '<div class="notice">Todavía no hay solicitudes.</div>'}</div>`;
  document.querySelectorAll("[data-review-withdrawal]").forEach((button) => {
    button.onclick = () =>
      openWithdrawalReview(
        requests.find((item) => String(item.id) === button.dataset.reviewWithdrawal),
      );
  });
  document.querySelectorAll("[data-archive-withdrawal]").forEach((button) => {
    button.onclick = () =>
      archiveWithdrawalRequest(button.dataset.archiveWithdrawal, button);
  });
}

function withdrawalStatusLabel(status) {
  return (
    {
      submitted: "Recibida",
      under_review: "En revisión",
      awaiting_return: "Esperando devolución",
      refund_pending: "Reintegro pendiente",
      refunded: "Reintegrada",
      rejected: "Rechazada",
      closed: "Cerrada",
    }[status] || status
  );
}

function adminWithdrawalMarkup(request) {
  const items = Array.isArray(request.items) ? request.items : [];
  return `<article class="withdrawal-admin-card" data-withdrawal-card="${request.id}"><header><div><small>${escapeHtml(request.request_code)}</small><h3>${escapeHtml(request.customer_name)}</h3><p>${escapeHtml(request.customer_email)} · ${escapeHtml(request.customer_phone || "Sin teléfono")}</p></div><span class="withdrawal-status">${escapeHtml(withdrawalStatusLabel(request.status))}</span></header><div class="withdrawal-products">${items.map((item) => `<span><b>${Math.max(1, Number(item.quantity) || 1)}× ${escapeHtml(item.product_name || "Producto")}</b><small>${escapeHtml(saleTypeLabel(item.sale_type))}</small></span>`).join("") || "Sin detalle"}</div>${request.reason ? `<blockquote>${escapeHtml(request.reason)}</blockquote>` : ""}${request.resolution_reason ? `<div class="withdrawal-resolution"><b>Resolución registrada</b><p>${escapeHtml(request.resolution_reason)}</p>${request.resolution_email_sent_at ? '<small class="delivery-ok">Email enviado al cliente</small>' : request.resolution_email_error ? '<small class="delivery-pending">Email pendiente</small>' : ""}</div>` : ""}<footer><small>${new Date(request.created_at).toLocaleString("es-AR")}</small><div>${request.resolution_reason ? `<button class="btn outline" type="button" data-archive-withdrawal="${request.id}">Archivar</button>` : ""}<button class="btn cta" type="button" data-review-withdrawal="${request.id}">Revisar solicitud</button></div></footer></article>`;
}

function openWithdrawalReview(request) {
  if (!request) return;
  openModal(`<button class="modal-close" data-close>×</button><p class="eyebrow orange">${escapeHtml(request.request_code)}</p><h2>Actualizar solicitud</h2><form id="withdrawalReviewForm" class="form-grid"><div class="field"><label>Estado</label><select name="status">${["under_review", "awaiting_return", "refund_pending", "refunded", "rejected", "closed"].map((status) => `<option value="${status}" ${request.status === status ? "selected" : ""}>${escapeHtml(withdrawalStatusLabel(status))}</option>`).join("")}</select></div><div class="field"><label>Importe de reintegro</label><input name="refundAmount" type="number" min="0" step="0.01" value="${escapeHtml(request.refund_amount || "")}"></div><div class="field full"><label>ID de reintegro de Mercado Pago</label><input name="mpRefundId" value="${escapeHtml(request.mp_refund_id || "")}" placeholder="Completalo si ya realizaste el reintegro"></div><div class="field full"><label>Respuesta y próximos pasos</label><textarea name="resolutionReason" maxlength="2000" rows="7" required>${escapeHtml(request.resolution_reason || "")}</textarea><small>Este texto se enviará por email al cliente.</small></div><label class="field full archive-after-reply"><input name="archiveAfterReply" type="checkbox" value="true" checked><span><b>Quitar del panel después de responder</b><small>Se conservará en Supabase y en la cuenta del cliente.</small></span></label><div class="fiscal-warning field full"><b>Control manual</b><p>Registrar “Reintegrada” no mueve dinero automáticamente. Primero realizá y verificá el reintegro en Mercado Pago; después guardá aquí su identificador.</p></div><button class="btn cta field full" type="submit">Guardar y notificar</button></form>`);
  document.querySelector("#withdrawalReviewForm").onsubmit = (event) =>
    updateWithdrawalRequest(event, request.id);
}

async function updateWithdrawalRequest(event, requestId) {
  event.preventDefault();
  const button = event.submitter;
  const values = Object.fromEntries(new FormData(event.currentTarget));
  if (values.status === "refunded" && !String(values.mpRefundId || "").trim())
    return toast("Ingresá el ID del reintegro antes de marcarla como reintegrada.", "error");
  setBusy(button, true, "Guardando…");
  const { data, error } = await supabase.functions.invoke(
    "update-withdrawal-request",
    {
      body: {
        requestId,
        ...values,
        archiveAfterReply: values.archiveAfterReply === "true",
      },
    },
  );
  setBusy(button, false);
  if (error || !data?.updated)
    return toast(
      readableFunctionError(
        data?.error || error?.message,
        "No se pudo actualizar la solicitud.",
      ),
      "error",
    );
  closeModal();
  await openAdminWithdrawals();
  toast(
    data.emailSent
      ? data.archived
        ? "Respuesta enviada y solicitud archivada."
        : "Solicitud actualizada y cliente notificado."
      : "Respuesta guardada, pero el correo al cliente quedó pendiente.",
    data.emailSent ? "success" : "error",
  );
}

async function archiveWithdrawalRequest(requestId, button) {
  if (
    !(await confirmAction({
      title: "Archivar solicitud",
      message:
        "La solicitud dejará de verse en el panel, pero conservará toda su información.",
      confirmLabel: "Archivar",
    }))
  )
    return;
  setBusy(button, true, "Archivando…");
  const { error } = await supabase
    .from("withdrawal_requests")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", requestId);
  setBusy(button, false);
  if (error) return toast(error.message, "error");
  document.querySelector(`[data-withdrawal-card="${CSS.escape(requestId)}"]`)?.remove();
  toast("Solicitud archivada.", "success");
}

async function openEditProduct(id = null, similarId = null) {
  if (!isAdmin()) return;
  const editing = state.products.find((p) => String(p.id) === String(id));
  const source = state.products.find(
    (p) => String(p.id) === String(similarId),
  );
  const product = editing
    ? { ...editing }
    : source
      ? {
          ...source,
          id: null,
          slug: null,
          isSimilar: true,
          name: `${source.name} - Similar`,
          sku: `${source.sku || "AO"}-SIM-${String(Date.now()).slice(-4)}`,
        }
      : {
          id: null,
          name: "",
          categoryId: state.categories[0]?.id,
          price: "",
          stock: "",
          sku: "",
          images: [],
          desc: "",
          details: "",
          saleType: "standard",
        };
  const pricingSourceId = editing?.id || source?.id || null;
  let pricing = {
    base_net_price: 0,
    vat_rate: Number(state.settings.vat_rate ?? 21),
    payment_fee_rate: Number(state.settings.payment_fee_rate ?? 7),
    commercial_margin_rate: Number(state.settings.commercial_margin_rate ?? 0),
    rounding_unit: Number(state.settings.pricing_rounding ?? 100),
  };
  if (pricingSourceId) {
    const { data: savedPricing } = await supabase
      .from("product_pricing")
      .select("*")
      .eq("product_id", pricingSourceId)
      .maybeSingle();
    if (savedPricing) pricing = { ...pricing, ...savedPricing };
  }
  if (!Number(pricing.base_net_price) && Number(product.price)) {
    const vat = 1 + Number(pricing.vat_rate || 0) / 100;
    const fee = 1 - Number(pricing.payment_fee_rate || 0) / 100;
    const margin = 1 + Number(pricing.commercial_margin_rate || 0) / 100;
    pricing.base_net_price = Math.round((Number(product.price) * fee * 100) / (vat * margin)) / 100;
  }
  state.productEditorId = editing?.id || null;
  state.adminView = editing ? "product-editor" : "create-product";
  if (location.hash.split("?")[0] !== "#panel-general") {
    location.hash = "panel-general";
    setTimeout(() => openEditProduct(id, similarId), 0);
    return;
  }
  stopChatRealtime();
  setAdminActive(editing ? "products" : "create-product");
  const workspace = document.querySelector("#adminWorkspace");
  if (!workspace) return;
  workspace.innerHTML = `<div class="admin-page-head"><div><p class="eyebrow orange">${editing ? "MODIFICAR PUBLICACIÓN" : source ? "PUBLICAR SIMILAR" : "NUEVA PUBLICACIÓN"}</p><h1>${editing ? "Modificar producto" : "Crear producto"}</h1><p>${source ? `Partimos de ${escapeHtml(source.name)}. Editá lo que necesites antes de publicar.` : "Completá cada etapa y publicá cuando toda la información esté lista."}</p></div><button class="btn outline" id="cancelProductEditor" type="button">Cancelar</button></div><div class="product-wizard"><div class="product-wizard-progress"><span class="active" data-wizard-indicator="1"><b>1</b> Información</span><span data-wizard-indicator="2"><b>2</b> Precio y stock</span><span data-wizard-indicator="3"><b>3</b> Descripción</span><span data-wizard-indicator="4"><b>4</b> Fotos y publicación</span></div><form id="productForm" class="product-wizard-form"><section class="product-wizard-step" data-wizard-step="1"><small>PASO 1 DE 4</small><h2>¿Qué producto vas a publicar?</h2><p>Usá un título claro y definí si se vende estándar o siguiendo especificaciones particulares.</p><div class="form-grid"><div class="field full"><label>Nombre del producto</label><input name="name" value="${escapeHtml(product.name)}" placeholder="Ej.: Mesada con bacha 120 × 60" required></div><div class="field"><label>Categoría</label><select name="category_id" required>${state.categories.map((c) => `<option value="${c.id}" ${product.categoryId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select></div><div class="field"><label>SKU o código interno</label><input name="sku" value="${escapeHtml(product.sku)}" placeholder="Ej.: MB-12060" required></div><div class="field full"><label>Modalidad de venta</label><select name="sale_type" required><option value="standard" ${product.saleType === "standard" ? "selected" : ""}>Producto estándar</option><option value="customizable" ${product.saleType === "customizable" ? "selected" : ""}>Estándar personalizable</option><option value="made_to_order" ${product.saleType === "made_to_order" ? "selected" : ""}>Fabricado completamente a medida</option></select><small>La modalidad se guarda también dentro de cada pedido para documentar las condiciones aceptadas.</small></div></div></section><section class="product-wizard-step hidden" data-wizard-step="2"><small>PASO 2 DE 4</small><h2>Calculá el precio final</h2><p>El catálogo y Mercado Pago siempre usarán el precio final. IVA, costo de cobro y margen quedan como cálculo interno.</p><div class="pricing-calculator"><div class="form-grid"><div class="field"><label>Costo/base neta</label><input name="base_net_price" id="pricingBase" type="number" min="0" step="0.01" value="${pricing.base_net_price}" required></div><div class="field"><label>IVA</label><input name="vat_rate" id="pricingVat" type="number" min="0" max="100" step="0.01" value="${pricing.vat_rate}" required></div><div class="field"><label>Costo de cobro estimado</label><input name="payment_fee_rate" id="pricingFee" type="number" min="0" max="99" step="0.01" value="${pricing.payment_fee_rate}" required><small>Ingresá la tasa real acordada con Mercado Pago.</small></div><div class="field"><label>Margen comercial adicional</label><input name="commercial_margin_rate" id="pricingMargin" type="number" min="0" max="500" step="0.01" value="${pricing.commercial_margin_rate}" required></div><div class="field"><label>Redondear hacia arriba cada</label><input name="rounding_unit" id="pricingRounding" type="number" min="0" step="0.01" value="${pricing.rounding_unit}" required></div><div class="field"><label>Unidades disponibles</label><input name="stock_quantity" type="number" min="0" value="${product.stock}" required></div><div class="field full final-price-field"><label>Precio final publicado</label><input name="price" id="pricingFinal" type="number" min="0" step="0.01" value="${product.price}" required><small>Podés modificarlo manualmente. Este es el único precio que verá y pagará el cliente.</small></div></div><div id="pricingBreakdown" class="pricing-breakdown"></div></div></section><section class="product-wizard-step hidden" data-wizard-step="3"><small>PASO 3 DE 4</small><h2>Contá los detalles del producto</h2><p>Explicá materiales, medidas, usos y todo lo que ayude al cliente a decidir. Para trabajos a medida, detallá qué debe aprobarse antes de fabricar.</p><div class="form-grid"><div class="field full"><label>Descripción principal</label><textarea name="description" rows="5" required>${escapeHtml(product.desc)}</textarea></div><div class="field full"><label>Detalles adicionales</label><textarea name="details" rows="6">${escapeHtml(product.details)}</textarea></div></div></section><section class="product-wizard-step hidden" data-wizard-step="4"><small>PASO 4 DE 4</small><h2>Agregá fotos y videos</h2><p>La primera imagen será la portada. Podés seleccionar varios archivos a la vez.</p><div class="product-media-inputs"><label class="product-media-drop">＋<b>Seleccionar fotos</b><small>JPG, PNG o WebP · hasta 5 MB cada una</small><input id="productPhotos" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label><label class="product-media-drop">▶<b>Seleccionar videos</b><small>MP4 o WebM · hasta 50 MB cada uno</small><input id="productVideos" type="file" accept="video/mp4,video/webm" multiple hidden></label></div><div class="field full"><p class="field-caption">Galería de la publicación</p><div id="existingMedia" class="media-admin-grid">${(product.images || []).map((url, index) => `<label class="media-admin-item">${isVideoUrl(url) ? `<video src="${escapeHtml(url)}" muted></video>` : `<img src="${escapeHtml(url)}" alt="Medio ${index + 1}">`}<span><input type="checkbox" value="${escapeHtml(url)}" data-remove-media> Quitar</span></label>`).join("")}</div><div id="newMediaPreview" class="media-admin-grid"></div></div><div class="publish-review"><b>Todo listo para ${editing ? "guardar" : "publicar"}</b><span>Revisá los pasos anteriores. El precio publicado ya debe incluir IVA y costos comerciales.</span></div></section><div class="product-wizard-actions"><button class="btn outline hidden" id="wizardBack" type="button">← Anterior</button><span></span><button class="btn secondary" id="wizardNext" type="button">Continuar →</button><button class="btn cta hidden" id="wizardPublish" type="submit">${editing ? "Guardar cambios" : "Publicar"}</button></div></form></div>`;
  const photoInput = document.querySelector("#productPhotos");
  const videoInput = document.querySelector("#productVideos");
  const pricingInputs = {
    base: document.querySelector("#pricingBase"),
    vat: document.querySelector("#pricingVat"),
    fee: document.querySelector("#pricingFee"),
    margin: document.querySelector("#pricingMargin"),
    rounding: document.querySelector("#pricingRounding"),
    final: document.querySelector("#pricingFinal"),
  };
  const renderPricing = ({ updateFinal = false } = {}) => {
    const base = Number(pricingInputs.base.value || 0);
    const vatRate = Number(pricingInputs.vat.value || 0);
    const paymentFeeRate = Number(pricingInputs.fee.value || 0);
    const commercialMarginRate = Number(pricingInputs.margin.value || 0);
    const roundingUnit = Number(pricingInputs.rounding.value || 0);
    const suggested = suggestedFinalPrice({
      baseNetPrice: base,
      vatRate,
      paymentFeeRate,
      commercialMarginRate,
      roundingUnit,
    });
    if (updateFinal || !Number(pricingInputs.final.value))
      pricingInputs.final.value = String(suggested);
    const final = Number(pricingInputs.final.value || suggested);
    const baseWithMargin = base * (1 + commercialMarginRate / 100);
    const marginAmount = baseWithMargin - base;
    const netBeforeVat = vatRate ? final / (1 + vatRate / 100) : final;
    const vatAmount = final - netBeforeVat;
    const feeAmount = final * (paymentFeeRate / 100);
    document.querySelector("#pricingBreakdown").innerHTML = `<span><small>Precio sugerido</small><b>${money(suggested)}</b></span><span><small>Base + margen</small><b>${money(baseWithMargin)}</b></span><span><small>IVA incluido</small><b>${money(vatAmount)}</b></span><span><small>Costo de cobro estimado</small><b>${money(feeAmount)}</b></span><p>Margen agregado sobre la base: <b>${money(marginAmount)}</b>. Para compensar la comisión, la fórmula divide por el porcentaje que realmente recibís. La tasa real depende del medio y plazo de acreditación; confirmala en Mercado Pago y revisá el tratamiento fiscal con tu contador.</p>`;
  };
  [
    pricingInputs.base,
    pricingInputs.vat,
    pricingInputs.fee,
    pricingInputs.margin,
    pricingInputs.rounding,
  ].forEach((input) => {
    input.oninput = () => renderPricing({ updateFinal: true });
  });
  pricingInputs.final.oninput = () => renderPricing();
  renderPricing();
  const mediaInputs = document.querySelector(".product-media-inputs");
  mediaInputs?.insertAdjacentHTML(
    "afterend",
    '<div id="productMediaCount" class="product-media-count" aria-live="polite"></div>',
  );
  photoInput.closest("label").querySelector("small").textContent =
    "Hasta 10 fotos · podés elegir varias juntas o volver a abrir el selector";
  videoInput.closest("label").querySelector("small").textContent =
    "Varios MP4, WebM o MOV · hasta 50 MB cada uno";
  videoInput.accept = "video/mp4,video/webm,video/quicktime,.mov";
  let pendingPhotos = [];
  let pendingVideos = [];
  let previewObjectUrls = [];
  const fileIdentity = (file) =>
    `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
  const uniqueFiles = (files) => [
    ...new Map(files.map((file) => [fileIdentity(file), file])).values(),
  ];
  const activeExistingMedia = () => {
    const removed = new Set(
      [...document.querySelectorAll("[data-remove-media]:checked")].map(
        (input) => input.value,
      ),
    );
    return (product.images || []).filter((url) => !removed.has(url));
  };
  const selectedMedia = () => [...pendingPhotos, ...pendingVideos];
  const renderNewMediaPreview = () => {
    const files = selectedMedia();
    previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    previewObjectUrls = [];
    document.querySelector("#newMediaPreview").innerHTML = files
      .map((file, index) => {
        const url = URL.createObjectURL(file);
        previewObjectUrls.push(url);
        return `<div class="media-admin-item pending-media-item">${file.type.startsWith("video/") ? `<video src="${url}" muted controls preload="metadata"></video>` : `<img src="${url}" alt="${escapeHtml(file.name)}">`}<span><b>${escapeHtml(file.name)}</b><button type="button" data-remove-pending-media="${index}">Quitar</button></span></div>`;
      })
      .join("");
    const existing = activeExistingMedia();
    const photoCount =
      existing.filter((url) => !isVideoUrl(url)).length + pendingPhotos.length;
    const videoCount =
      existing.filter(isVideoUrl).length + pendingVideos.length;
    document.querySelector("#productMediaCount").innerHTML =
      `<b>${photoCount}/${MAX_PRODUCT_PHOTOS} fotos</b><span>${videoCount} video${videoCount === 1 ? "" : "s"}</span><small>La primera foto será la portada del producto.</small>`;
    document
      .querySelectorAll("[data-remove-pending-media]")
      .forEach((button) => {
        button.onclick = () => {
          const index = Number(button.dataset.removePendingMedia);
          if (index < pendingPhotos.length) pendingPhotos.splice(index, 1);
          else pendingVideos.splice(index - pendingPhotos.length, 1);
          renderNewMediaPreview();
        };
      });
  };
  const addSelectedFiles = (kind, input) => {
    const picked = [...input.files];
    input.value = "";
    const allowedTypes =
      kind === "photo"
        ? new Set(["image/jpeg", "image/png", "image/webp"])
        : new Set(["video/mp4", "video/webm", "video/quicktime"]);
    const maxSize = kind === "photo" ? 5_000_000 : 50_000_000;
    const valid = picked.filter((file) => {
      const extensionAllowed =
        kind === "photo"
          ? /\.(jpe?g|png|webp)$/i.test(file.name)
          : /\.(mp4|webm|mov)$/i.test(file.name);
      if (!allowedTypes.has(file.type) && !extensionAllowed) {
        toast(`${file.name} tiene un formato no permitido.`, "error");
        return false;
      }
      if (file.size > maxSize) {
        toast(`${file.name} supera el tamaño permitido.`, "error");
        return false;
      }
      return true;
    });
    if (kind === "photo") {
      const existingPhotos = activeExistingMedia().filter(
        (url) => !isVideoUrl(url),
      ).length;
      const available = Math.max(
        0,
        MAX_PRODUCT_PHOTOS - existingPhotos - pendingPhotos.length,
      );
      const accepted = valid.slice(0, available);
      pendingPhotos = uniqueFiles([...pendingPhotos, ...accepted]);
      if (valid.length > accepted.length)
        toast(`Podés publicar hasta ${MAX_PRODUCT_PHOTOS} fotos por producto.`, "error");
    } else {
      pendingVideos = uniqueFiles([...pendingVideos, ...valid]);
    }
    renderNewMediaPreview();
  };
  photoInput.onchange = () => addSelectedFiles("photo", photoInput);
  videoInput.onchange = () => addSelectedFiles("video", videoInput);
  document.querySelectorAll("[data-remove-media]").forEach((input) => {
    input.onchange = renderNewMediaPreview;
  });
  renderNewMediaPreview();
  let currentStep = 1;
  const showStep = (step) => {
    currentStep = Math.max(1, Math.min(4, step));
    document.querySelectorAll("[data-wizard-step]").forEach((section) =>
      section.classList.toggle(
        "hidden",
        Number(section.dataset.wizardStep) !== currentStep,
      ),
    );
    document.querySelectorAll("[data-wizard-indicator]").forEach((item) => {
      const number = Number(item.dataset.wizardIndicator);
      item.classList.toggle("active", number === currentStep);
      item.classList.toggle("complete", number < currentStep);
    });
    document.querySelector("#wizardBack").classList.toggle("hidden", currentStep === 1);
    document.querySelector("#wizardNext").classList.toggle("hidden", currentStep === 4);
    document.querySelector("#wizardPublish").classList.toggle("hidden", currentStep !== 4);
    workspace.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  const validateStep = () => {
    const section = document.querySelector(`[data-wizard-step="${currentStep}"]`);
    const invalid = [...section.querySelectorAll("input,select,textarea")].find(
      (field) => !field.checkValidity(),
    );
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    return true;
  };
  document.querySelector("#wizardNext").onclick = () => {
    if (validateStep()) showStep(currentStep + 1);
  };
  document.querySelector("#wizardBack").onclick = () => showStep(currentStep - 1);
  document.querySelector("#cancelProductEditor").onclick = openAdminProducts;
  document.querySelector("#productForm").onsubmit = (e) =>
    saveProduct(e, product, selectedMedia());
}
async function uploadProductMedia(files, onProgress = () => {}) {
  const urls = [];
  const uploadedPaths = [];
  try {
    for (const [index, file] of files.entries()) {
      onProgress(index + 1, files.length, file);
      const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      uploadedPaths.push(path);
      urls.push(
        supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl,
      );
    }
  } catch (error) {
    if (uploadedPaths.length)
      await supabase.storage.from("product-images").remove(uploadedPaths);
    throw error;
  }
  return urls;
}
async function saveProduct(event, current, files) {
  event.preventDefault();
  const button = event.submitter,
    values = Object.fromEntries(new FormData(event.target));
  const pricingValues = {
    base_net_price: Number(values.base_net_price),
    vat_rate: Number(values.vat_rate),
    payment_fee_rate: Number(values.payment_fee_rate),
    commercial_margin_rate: Number(values.commercial_margin_rate),
    rounding_unit: Number(values.rounding_unit),
  };
  [
    "base_net_price",
    "vat_rate",
    "payment_fee_rate",
    "commercial_margin_rate",
    "rounding_unit",
  ].forEach((key) => delete values[key]);
  values.price = Number(values.price);
  values.stock_quantity = Number(values.stock_quantity);
  values.slug = current.id
    ? current.slug
    : `${slugify(values.name)}${current.isSimilar ? `-${String(Date.now()).slice(-6)}` : ""}`;
  values.is_active = true;
  setBusy(button, true, "Guardando…");
  try {
    const removed = new Set(
      [...document.querySelectorAll("[data-remove-media]:checked")].map(
        (input) => input.value,
      ),
    );
    const kept = (current.images || []).filter((url) => !removed.has(url));
    const uploaded = await uploadProductMedia(files, (currentIndex, total) => {
      if (button && total)
        button.textContent = `Subiendo archivo ${currentIndex} de ${total}…`;
    });
    values.images = [...kept, ...uploaded];
    const query = current.id
      ? supabase.from("products").update(values).eq("id", current.id)
      : supabase.from("products").insert(values);
    const { data: savedProduct, error } = await query.select("id").single();
    if (error) throw error;
    const { error: pricingError } = await supabase
      .from("product_pricing")
      .upsert({ product_id: savedProduct.id, ...pricingValues });
    if (pricingError) throw pricingError;
    await loadStoreData({ route: false });
    state.adminView = "products";
    state.productEditorId = null;
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
  if (!isAdmin()) return;
  if (
    !(await confirmAction({
      title: "Eliminar producto",
      message:
        "La publicación dejará de verse en el catálogo. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar producto",
    }))
  )
    return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return toast(error.message, "error");
  state.cart = state.cart.filter((i) => String(i.id) !== String(id));
  saveCart();
  await loadStoreData();
  renderAccount();
  renderAdminPanel();
  if (location.hash.startsWith("#producto/")) location.hash = "catalogo";
  toast("Producto eliminado", "success");
}

let pendingModalConfirmation = null;
function confirmAction({ title, message, confirmLabel = "Eliminar" }) {
  return new Promise((resolve) => {
    pendingModalConfirmation = resolve;
    openModal(
      `<div class="confirm-dialog"><span class="confirm-icon" aria-hidden="true">!</span><p class="eyebrow orange">CONFIRMACIÓN</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><div class="confirm-actions"><button class="btn outline" type="button" data-close>Cancelar</button><button class="btn danger" id="confirmActionAccept" type="button">${escapeHtml(confirmLabel)}</button></div></div>`,
    );
    document.querySelector("#confirmActionAccept").onclick = () => {
      const finish = pendingModalConfirmation;
      pendingModalConfirmation = null;
      closeModal();
      finish?.(true);
    };
  });
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
  if (pendingModalConfirmation) {
    const finish = pendingModalConfirmation;
    pendingModalConfirmation = null;
    finish(false);
  }
  document.querySelector("#modal").classList.add("hidden");
  document.body.style.overflow = "";
}
function bindStaticEvents() {
  document.querySelectorAll("#searchInput, #catalogSearchInput").forEach((input) => {
    input.oninput = (event) => {
      state.search = event.target.value;
      state.visibleCount = CATALOG_PAGE_SIZE;
      renderProducts();
    };
  });
  document
    .querySelectorAll("[data-open-cart]")
    .forEach((n) => (n.onclick = openCart));
  document
    .querySelectorAll("[data-close-cart]")
    .forEach((n) => (n.onclick = closeCart));
  document.querySelector(".menu-btn").onclick = () =>
    document.querySelector(".nav-links").classList.toggle("open");
  document.querySelector("#notificationBell")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const dropdown = document.querySelector("#notificationDropdown");
    const opening = dropdown?.classList.contains("hidden");
    dropdown?.classList.toggle("hidden", !opening);
    event.currentTarget.setAttribute("aria-expanded", String(opening));
  });
  document.querySelector("#notificationDropdown")?.addEventListener(
    "click",
    (event) => event.stopPropagation(),
  );
  document.addEventListener("click", () => {
    document.querySelector("#notificationDropdown")?.classList.add("hidden");
    document.querySelector("#notificationBell")?.setAttribute("aria-expanded", "false");
  });
  document
    .querySelectorAll(".nav-links a")
    .forEach(
      (n) =>
        (n.onclick = () =>
          document.querySelector(".nav-links").classList.remove("open")),
    );
  document.querySelector("#backToProducts").onclick = () =>
    (location.hash = "catalogo");
  document.querySelectorAll("[data-back-home]").forEach(
    (button) => (button.onclick = () => (location.hash = "inicio")),
  );
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
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")
  )
    navigator.serviceWorker.register("/sw.js").catch(console.warn);
  if (restoreStoreCache()) {
    renderClients();
    renderCategories();
  }
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
