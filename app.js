const money = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
const ADMIN_CONTACT_EMAIL = "gestionacerosoestee@gmail.com";
const LEGACY_ADMIN_EMAIL = "gestionacerosoeste@gmail.com";
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
    freight_whatsapp: "5491134322199",
    contact_email: ADMIN_CONTACT_EMAIL,
  },
  user: null,
  profile: null,
  filter: "Todos",
  search: "",
  visibleCount: 24,
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

function restoreStoreCache() {
  const cached = safeRead(storeCacheKey, null);
  if (!cached?.products || !Array.isArray(cached.products)) return false;
  state.products = cached.products;
  state.categories = Array.isArray(cached.categories) ? cached.categories : [];
  state.clients = Array.isArray(cached.clients) ? cached.clients : [];
  if (cached.settings) state.settings = cached.settings;
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
  if (notification?.type === "question" && notification.product_id) {
    const product = state.products.find(
      (item) => String(item.id) === String(notification.product_id),
    );
    if (product) return `/#producto/${encodeURIComponent(product.slug)}`;
  }
  return "/#panel-general";
}
async function showDeviceNotification(notification) {
  if (
    !isAdmin() ||
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
  center.classList.toggle("hidden", !isAdmin());
  if (!isAdmin()) return;
  const unread = state.notifications.filter((item) => !item.is_read).length;
  count.textContent = unread > 99 ? "99+" : String(unread);
  count.classList.toggle("hidden", unread === 0);
  dropdown.innerHTML = `<header><div><b>Notificaciones</b><small>${unread ? `${unread} sin leer` : "Todo al día"}</small></div>${unread ? '<button id="readAllNotifications" type="button">Marcar leídas</button>' : ""}</header>${"Notification" in window && Notification.permission !== "granted" ? '<button id="enableDeviceNotifications" class="notification-permission" type="button"><b>Activar avisos en este dispositivo</b><small>Recibilos mientras el panel esté abierto.</small></button>' : ""}<div class="notification-list">${state.notifications.length ? state.notifications.map((item) => `<button class="notification-item ${item.is_read ? "" : "unread"}" data-notification-id="${escapeHtml(item.id)}" type="button"><i>${item.type === "question" ? "?" : "…"}</i><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.body)}</small><time>${new Date(item.created_at).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></span></button>`).join("") : '<p class="notification-empty">No hay notificaciones nuevas.</p>'}</div>`;
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
      openAdminNotification(
        state.notifications.find(
          (item) => String(item.id) === button.dataset.notificationId,
        ),
      );
  });
}
async function loadAdminNotifications() {
  if (!supabase || !isAdmin()) {
    state.notifications = [];
    renderNotificationCenter();
    return;
  }
  const { data, error } = await supabase
    .from("admin_notifications")
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
  const { error } = await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  if (error) return toast("No pudimos actualizar las notificaciones.", "error");
  state.notifications = state.notifications.map((item) => ({
    ...item,
    is_read: true,
  }));
  renderNotificationCenter();
}
async function openAdminNotification(notification) {
  if (!notification) return;
  document.querySelector("#notificationDropdown")?.classList.add("hidden");
  document.querySelector("#notificationBell")?.setAttribute("aria-expanded", "false");
  if (!notification.is_read)
    await supabase
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("id", notification.id);
  notification.is_read = true;
  renderNotificationCenter();
  if (notification.type === "question" && notification.product_id) {
    const product = state.products.find(
      (item) => String(item.id) === String(notification.product_id),
    );
    if (product) {
      location.hash = `producto/${encodeURIComponent(product.slug)}`;
      return;
    }
  }
  location.hash = "panel-general";
  state.adminView = "chats";
  renderAdminPanel();
  await openAdminChats();
}
function handleAdminNotificationRealtime(payload) {
  if (!isAdmin()) return;
  scheduleRealtimeRefresh("admin-notifications", loadAdminNotifications, 80);
  if (payload?.eventType === "INSERT" && payload.new) {
    toast(payload.new.title || "Nueva consulta", "notification");
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
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "admin_notifications" },
      handleAdminNotificationRealtime,
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
  if (isAdmin()) await loadAdminNotifications();
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
  } else if (route === "politicas") {
    showStandalonePage("#politicas");
  } else if (emailConfirmed) {
    showStandalonePage("#cuenta");
    renderAccount();
    history.replaceState(null, "", "/#cuenta");
    toast("Email confirmado. Ya podés usar tu cuenta.", "success");
  } else {
    showMainSections();
    renderCheckoutStatus(route);
  }
}
async function renderCheckoutStatus(hash) {
  if (hash === "checkout/exito") {
    toast("Confirmando el pago y actualizando tu carrito…", "info");
    const cleared = await syncPaidCheckoutCart({ retry: true, notify: true });
    if (!cleared)
      toast(
        "El pago está siendo confirmado. El carrito se actualizará automáticamente al acreditarse.",
        "info",
      );
  } else if (hash === "checkout/error") {
    localStorage.removeItem(pendingCheckoutKey);
    toast("El pago no pudo completarse. Tu carrito sigue guardado.", "error");
  } else if (hash === "checkout/pendiente") {
    toast(
      "El pago quedó pendiente. El carrito se limpiará cuando Mercado Pago lo acredite.",
      "info",
    );
    syncPaidCheckoutCart({ notify: true });
  }
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
      `https://wa.me/${state.settings.freight_whatsapp || "5491134322199"}?text=${encodeURIComponent(message)}`,
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
  return `<article class="purchase-card" data-customer-order="${order.id}"><header><div><small>${new Date(order.created_at).toLocaleDateString("es-AR")}</small><h2>${escapeHtml(orderProductsLabel(order) || "Compra en Aceros Oeste")}</h2></div><span class="order-status status-${escapeHtml(order.status)}">${statusLabel(order.status)}</span></header><div class="purchase-products">${items.map((item) => { const image = orderItemImage(item); return `<div class="purchase-product"><div class="purchase-product-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.product_name || "Producto")}">` : `<span>${escapeHtml(String(item.product_name || "P").slice(0, 1))}</span>`}</div><div><b>${escapeHtml(item.product_name || "Producto")}</b><small>${Math.max(1, Number(item.quantity) || 1)} unidad${Number(item.quantity) === 1 ? "" : "es"} · ${money(item.unit_price || item.subtotal)}</small></div></div>`; }).join("")}</div>${orderProgressMarkup(order.status)}${orderPaymentSummary(order)}<div class="purchase-actions">${!["cancelled", "fulfilled"].includes(order.status) ? `<button class="btn cta" data-customer-order-chat="${order.id}" type="button">Hablar sobre esta compra</button>` : ""}${["cancelled", "fulfilled"].includes(order.status) ? `<button class="btn outline" data-hide-order="${order.id}" type="button">Quitar de mi cuenta</button>` : ""}</div></article>`;
}
async function loadOrders() {
  if (!state.user || isAdmin()) return;
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
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

function renderAdminPanel() {
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
  openAdminSection(state.adminView || "products");
}
function adminDashboard() {
  return `<div class="admin-shell"><aside id="adminSidebar" class="admin-sidebar"><a class="admin-brand" href="#inicio"><img src="assets/logo-aceros-oeste.png" alt="Aceros Oeste"><span><b>ACEROS OESTE</b><small>Administración</small></span></a><nav class="admin-side-nav" aria-label="Panel de administración"><button class="admin-side-link primary" id="addProduct" data-admin-route="create-product" type="button"><i>＋</i><span>Crear producto</span></button><button class="admin-side-link" id="productsBtn" data-admin-route="products" type="button"><i>▤</i><span>Productos</span></button><button class="admin-side-link" id="usersBtn" data-admin-route="users" type="button"><i>●</i><span>Usuarios</span></button><button class="admin-side-link" id="categoriesBtn" data-admin-route="categories" type="button"><i>◇</i><span>Categorías</span></button><button class="admin-side-link" id="clientsBtn" data-admin-route="clients" type="button"><i>▧</i><span>Clientes y trabajos</span></button><button class="admin-side-link" id="chatsBtn" data-admin-route="chats" type="button"><i>▣</i><span>Chats</span></button><button class="admin-side-link" id="settingsBtn" data-admin-route="settings" type="button"><i>⚙</i><span>Configuración</span></button><button class="admin-side-link" id="ordersBtn" data-admin-route="orders" type="button"><i>▱</i><span>Pedidos</span></button></nav><div class="admin-sidebar-bottom"><a class="admin-side-link" href="#inicio"><i>←</i><span>Volver a la tienda</span></a><button class="admin-side-link" id="logout" type="button"><i>↪</i><span>Cerrar sesión</span></button></div></aside><main class="admin-main"><header class="admin-topbar"><button id="adminSidebarToggle" class="admin-sidebar-toggle" type="button" aria-label="Abrir menú">☰</button><div><small>PANEL GENERAL</small><b>${escapeHtml(state.profile?.full_name || "Administrador")}</b></div>${avatarMarkup(state.profile, "user-avatar admin-top-avatar")}</header><div id="adminWorkspace" class="admin-workspace"></div></main></div>`;
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
  openModal(`<button class="modal-close" data-close>×</button><p class="eyebrow orange">${id ? "EDITAR" : "NUEVO"} CLIENTE</p><h2>${id ? "Actualizar publicación" : "Agregar cliente"}</h2><form id="clientForm" class="form-grid"><div class="field"><label>Nombre</label><input name="name" value="${escapeHtml(client.name)}" required></div><div class="field"><label>Rubro</label><input name="category" value="${escapeHtml(client.category)}"></div><div class="field full"><label>Texto que aparecerá en la página del cliente</label><textarea name="description" rows="8" placeholder="Escribí libremente qué trabajos realizaron, materiales, medidas y detalles del proyecto.">${escapeHtml(client.description)}</textarea><small>Este texto se mostrará exactamente como lo escribas, sin títulos automáticos.</small></div><div class="field"><label>Orden</label><input name="sort_order" type="number" value="${Number(client.sort_order) || 0}"></div><div class="field"><label><input name="is_active" type="checkbox" ${client.is_active === false ? "" : "checked"}> Visible</label></div><div class="field full"><label class="image-upload-label">Logo del cliente<input id="clientLogo" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>${client.logo_url ? `<img class="preview-admin-img" src="${escapeHtml(client.logo_url)}" alt="Logo actual">` : ""}</div><div class="field full"><label class="image-upload-label">Fotos de trabajos<input id="clientPhotos" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label><small>Podés agregar varias ahora o volver más adelante. Se mostrarán una debajo de otra.</small><div class="media-admin-grid">${(client.images || []).map((url) => `<label class="media-admin-item"><img src="${escapeHtml(url)}" alt="Trabajo"><span><input type="checkbox" value="${escapeHtml(url)}" data-remove-client-photo> Quitar</span></label>`).join("")}</div></div><button class="btn cta field full">Guardar cliente</button></form>`);
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
  state.adminView = "settings";
  setAdminActive("settings");
  state.activeConversationId = null;
  const ws = document.querySelector("#adminWorkspace");
  ws.innerHTML = `<h3>Configuración de la tienda</h3><form id="settingsForm" class="form-grid"><div class="field"><label>Porcentaje de seña</label><input name="deposit_percentage" type="number" min="1" max="100" value="${state.settings.deposit_percentage || 50}"></div><div class="field"><label>WhatsApp de ventas</label><input name="sales_whatsapp" value="${escapeHtml(state.settings.sales_whatsapp || "")}"></div><div class="field full"><label>Email de contacto</label><input name="contact_email" type="email" value="${escapeHtml(normalizedContactEmail(state.settings.contact_email))}"></div><button class="btn secondary">Guardar</button></form>`;
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
          title: "Eliminar pedido finalizado",
          message:
            "El pedido se borrará del registro del panel. Esta acción no se puede deshacer.",
          confirmLabel: "Eliminar pedido",
        }))
      )
        return;
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
  return `<article class="admin-order-card" data-order-card="${order.id}"><header><div class="admin-order-customer">${avatarMarkup(profile, "user-avatar admin-order-avatar")}<div><small>CLIENTE</small><b>${escapeHtml(name)}</b><span>${escapeHtml(order.customer_email || "Sin email")} · ${escapeHtml(order.customer_phone || "Sin teléfono")}</span></div></div><div><span class="order-status status-${escapeHtml(order.status)}">${statusLabel(order.status)}</span><small>Pedido ${escapeHtml(String(order.id).slice(0, 8).toUpperCase())}</small></div></header><div class="admin-order-products">${products || '<span class="notice">Sin detalle de productos</span>'}</div><div class="admin-order-finance"><span><small>Total</small><b>${money(order.subtotal)}</b></span><span><small>${order.payment_type === "deposit" ? "Seña" : "Acreditado"}</small><b>${money(order.amount_to_pay || order.subtotal)}</b></span>${balance ? `<span class="pending"><small>Saldo pendiente</small><b>${money(balance)}</b></span>` : ""}</div><div class="admin-order-actions"><label class="order-status-label">Estado<select data-order-status="${order.id}">${["deposit_paid", "paid", "in_transit", "fulfilled", "cancelled"].map((status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}</select></label><button class="btn cta" data-admin-order-chat="${order.id}" type="button">Abrir chat del pedido</button>${["fulfilled", "cancelled"].includes(order.status) ? `<button class="btn danger" data-delete-order="${order.id}" type="button">Eliminar pedido</button>` : ""}</div></article>`;
}

function openEditProduct(id = null, similarId = null) {
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
        };
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
  workspace.innerHTML = `<div class="admin-page-head"><div><p class="eyebrow orange">${editing ? "MODIFICAR PUBLICACIÓN" : source ? "PUBLICAR SIMILAR" : "NUEVA PUBLICACIÓN"}</p><h1>${editing ? "Modificar producto" : "Crear producto"}</h1><p>${source ? `Partimos de ${escapeHtml(source.name)}. Editá lo que necesites antes de publicar.` : "Completá cada etapa y publicá cuando toda la información esté lista."}</p></div><button class="btn outline" id="cancelProductEditor" type="button">Cancelar</button></div><div class="product-wizard"><div class="product-wizard-progress"><span class="active" data-wizard-indicator="1"><b>1</b> Información</span><span data-wizard-indicator="2"><b>2</b> Precio y stock</span><span data-wizard-indicator="3"><b>3</b> Descripción</span><span data-wizard-indicator="4"><b>4</b> Fotos y publicación</span></div><form id="productForm" class="product-wizard-form"><section class="product-wizard-step" data-wizard-step="1"><small>PASO 1 DE 4</small><h2>¿Qué producto vas a publicar?</h2><p>Usá un título claro para que el cliente entienda rápidamente qué está viendo.</p><div class="form-grid"><div class="field full"><label>Nombre del producto</label><input name="name" value="${escapeHtml(product.name)}" placeholder="Ej.: Mesada con bacha 120 × 60" required></div><div class="field"><label>Categoría</label><select name="category_id" required>${state.categories.map((c) => `<option value="${c.id}" ${product.categoryId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select></div><div class="field"><label>SKU o código interno</label><input name="sku" value="${escapeHtml(product.sku)}" placeholder="Ej.: MB-12060" required></div></div></section><section class="product-wizard-step hidden" data-wizard-step="2"><small>PASO 2 DE 4</small><h2>Definí el precio y el stock</h2><p>Estos datos se actualizarán inmediatamente en el catálogo.</p><div class="form-grid"><div class="field"><label>Precio final</label><input name="price" type="number" min="0" step="0.01" value="${product.price}" required></div><div class="field"><label>Unidades disponibles</label><input name="stock_quantity" type="number" min="0" value="${product.stock}" required></div></div></section><section class="product-wizard-step hidden" data-wizard-step="3"><small>PASO 3 DE 4</small><h2>Contá los detalles del producto</h2><p>Explicá materiales, medidas, usos y todo lo que ayude al cliente a decidir.</p><div class="form-grid"><div class="field full"><label>Descripción principal</label><textarea name="description" rows="5" required>${escapeHtml(product.desc)}</textarea></div><div class="field full"><label>Detalles adicionales</label><textarea name="details" rows="6">${escapeHtml(product.details)}</textarea></div></div></section><section class="product-wizard-step hidden" data-wizard-step="4"><small>PASO 4 DE 4</small><h2>Agregá fotos y videos</h2><p>La primera imagen será la portada. Podés seleccionar varios archivos a la vez.</p><div class="product-media-inputs"><label class="product-media-drop">＋<b>Seleccionar fotos</b><small>JPG, PNG o WebP · hasta 5 MB cada una</small><input id="productPhotos" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label><label class="product-media-drop">▶<b>Seleccionar videos</b><small>MP4 o WebM · hasta 50 MB cada uno</small><input id="productVideos" type="file" accept="video/mp4,video/webm" multiple hidden></label></div><div class="field full"><p class="field-caption">Galería de la publicación</p><div id="existingMedia" class="media-admin-grid">${(product.images || []).map((url, index) => `<label class="media-admin-item">${isVideoUrl(url) ? `<video src="${escapeHtml(url)}" muted></video>` : `<img src="${escapeHtml(url)}" alt="Medio ${index + 1}">`}<span><input type="checkbox" value="${escapeHtml(url)}" data-remove-media> Quitar</span></label>`).join("")}</div><div id="newMediaPreview" class="media-admin-grid"></div></div><div class="publish-review"><b>Todo listo para ${editing ? "guardar" : "publicar"}</b><span>Revisá los pasos anteriores. Podrás modificar la publicación cuando quieras.</span></div></section><div class="product-wizard-actions"><button class="btn outline hidden" id="wizardBack" type="button">← Anterior</button><span></span><button class="btn secondary" id="wizardNext" type="button">Continuar →</button><button class="btn cta hidden" id="wizardPublish" type="submit">${editing ? "Guardar cambios" : "Publicar"}</button></div></form></div>`;
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
    const uploaded = await uploadProductMedia(files);
    values.images = [...kept, ...uploaded];
    const query = current.id
      ? supabase.from("products").update(values).eq("id", current.id)
      : supabase.from("products").insert(values);
    const { error } = await query;
    if (error) throw error;
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
  if (location.hash.startsWith("#producto/")) location.hash = "productos";
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
