import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("app.js", root), "utf8");
const paymentFunction = readFileSync(
  new URL("supabase/functions/mp-create-preference/index.ts", root),
  "utf8",
);
const customerMigration = readFileSync(
  new URL("supabase/migrations/007_customer_orders_and_support_chat.sql", root),
  "utf8",
);
const adminUsersMigration = readFileSync(
  new URL("supabase/migrations/008_admin_users_and_profile_email.sql", root),
  "utf8",
);
const realtimeMigration = readFileSync(
  new URL("supabase/migrations/009_realtime_sync_and_chat_deletion.sql", root),
  "utf8",
);
const rows = {
  categories: [
    {
      id: "c1",
      name: "Mesas de Trabajo",
      slug: "mesas-de-trabajo",
      sort_order: 10,
    },
  ],
  products: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Mesa inox",
      slug: "mesa-inox",
      description: "Mesa profesional",
      details: "A medida",
      price: 100000,
      stock_quantity: 3,
      category_id: "c1",
      images: [
        "https://example.test/product.jpg",
        "https://example.test/product.mp4",
      ],
      sku: "M-1",
      is_active: true,
      created_at: "2026-01-01",
      categories: { name: "Mesas de Trabajo", slug: "mesas-de-trabajo" },
    },
  ],
  client_projects: [
    {
      id: "client-1",
      name: "Cliente ejemplo",
      category: "Gastronomía",
      description: "Trabajo a medida",
      logo_url: "https://example.test/logo.jpg",
      images: ["https://example.test/work-1.jpg"],
      sort_order: 10,
      is_active: true,
    },
  ],
  store_settings: {
    id: 1,
    deposit_percentage: 30,
    freight_whatsapp: "5491134322199",
    sales_whatsapp: "5491134322199",
  },
  profiles: {
    id: "admin-1",
    full_name: "Administrador",
    email: "gestionacerosoeste@gmail.com",
    phone: "11 3432 2199",
    role: "admin",
    created_at: "2026-08-01T10:00:00Z",
  },
  questions: [
    {
      id: "q1",
      product_id: "11111111-1111-4111-8111-111111111111",
      user_id: "customer-1",
      question: "¿Se fabrica a medida?",
      answer: null,
    },
  ],
  orders: [
    {
      id: "order-1",
      user_id: "customer-1",
      status: "pending",
      subtotal: 100000,
      hidden_by_customer: false,
      created_at: "2026-08-18T10:00:00Z",
      order_items: [{ quantity: 1, product_name: "Mesa inox" }],
    },
  ],
  support_conversations: [],
  support_messages: [],
};
function query(table) {
  let single = false;
  const api = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "then")
          return (resolve) =>
            resolve({
              data: single ? rows[table] || null : rows[table] || [],
              error: null,
            });
        if (key === "maybeSingle" || key === "single")
          return () => {
            single = true;
            return api;
          };
        return () => api;
      },
    },
  );
  return api;
}
let authListener;
let activeSession = null;
const realtimeSubscriptions = [];
function emitRealtime(table, payload) {
  realtimeSubscriptions
    .filter(
      (subscription) =>
        !subscription.channel.removed &&
        subscription.config.table === table &&
        (subscription.config.event === "*" ||
          subscription.config.event === payload.eventType),
    )
    .forEach((subscription) => subscription.callback(payload));
}
const client = {
  from: (table) => query(table),
  channel: (name) => {
    const channel = {
      name,
      removed: false,
      on(_type, config, callback) {
        realtimeSubscriptions.push({ channel, config, callback });
        return channel;
      },
      subscribe() {
        return channel;
      },
    };
    return channel;
  },
  removeChannel: (channel) => {
    channel.removed = true;
  },
  auth: {
    getSession: async () => ({ data: { session: activeSession } }),
    onAuthStateChange: (listener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signInWithPassword: async () => ({ data: { session: null }, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => ({ error: null }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({
        data: { publicUrl: "https://example.test/product.jpg" },
      }),
    }),
  },
  functions: {
    invoke: async () => ({
      data: { initPoint: "https://example.test/pay" },
      error: null,
    }),
  },
  rpc: async (name, values) => {
    if (name === "cancel_own_order") {
      const order = rows.orders.find((item) => item.id === values.p_order_id);
      if (order) order.status = "cancelled";
    }
    if (name === "hide_own_order") {
      const order = rows.orders.find((item) => item.id === values.p_order_id);
      if (order) order.hidden_by_customer = true;
    }
    if (name === "delete_support_message") {
      rows.support_messages = rows.support_messages.filter(
        (message) => message.id !== values.p_message_id,
      );
    }
    if (name === "delete_support_conversation") {
      const id = values.p_conversation_id;
      rows.support_conversations = Array.isArray(rows.support_conversations)
        ? rows.support_conversations.filter((item) => item.id !== id)
        : [];
      rows.support_messages = rows.support_messages.filter(
        (message) => message.conversation_id !== id,
      );
    }
    return { data: null, error: null };
  },
};
const executable = html
  .replace('<script src="assets/vendor/supabase.js?v=1"></script>', "")
  .replace('<script src="config.js"></script>', "")
  .replace(
    '<script src="app.js?v=16"></script>',
    `<script>${app.replaceAll("</script>", "<\\/script>")}</script>`,
  );
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => errors.push(String(e.cause || e)));
virtualConsole.on("error", (e) => errors.push(String(e)));
const dom = new JSDOM(executable, {
  url: "https://aceros-oeste.test/#inicio",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    window.ACEROS_CONFIG = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "public-key",
    };
    window.supabase = { createClient: () => client };
    window.scrollTo = () => {};
    window.open = () => null;
    window.confirm = () => true;
    window.localStorage.setItem(
      "ao_cart_guest",
      JSON.stringify([{ id: "producto-eliminado", qty: 1 }]),
    );
  },
});
await new Promise((resolve) => setTimeout(resolve, 150));
const d = dom.window.document,
  assert = (ok, message) => {
    if (!ok) errors.push(message);
  };
assert(
  d.querySelector(".cart-count")?.textContent === "0",
  "El contador conserva productos inexistentes después de recargar",
);
assert(
  d.querySelectorAll(".product-card").length === 1,
  "El catálogo remoto no se renderizó",
);
assert(
  d.querySelector(".product-image")?.getAttribute("href") ===
    "#producto/mesa-inox",
  "La foto del producto no abre su ficha",
);
assert(
  d.querySelector(".client-name-button")?.getAttribute("href") ===
    "#cliente/client-1",
  "El cliente no abre su ficha individual",
);
assert(
  d.querySelectorAll("#clientsGrid .client-work-grid").length === 0,
  "Las fotos de trabajos siguen visibles en la grilla de clientes",
);
assert(
  Boolean(d.querySelector("#loginForm")),
  "No aparece el formulario de login",
);
assert(
  Boolean(d.querySelector('.nav-links a[href="#politicas"]')),
  "Políticas no aparece en el navbar",
);
assert(
  d.querySelectorAll(".payment-brand svg").length === 7,
  "Faltan íconos de medios de pago en el pie de página",
);
assert(
  Boolean(d.querySelector('.whatsapp-float[href*="5491134322199"]')),
  "Falta el acceso flotante a WhatsApp",
);
assert(
  !d.querySelector("#cuenta")?.textContent.includes("siempre segura"),
  "Sigue visible el texto eliminado de Mi cuenta",
);
d.querySelector("#showRegister")?.click();
assert(
  Boolean(d.querySelector("#registerForm")),
  "No aparece el formulario de registro",
);
d.querySelector("[data-open-cart]")?.click();
assert(
  !d.querySelector("#cartDrawer")?.classList.contains("hidden"),
  "El carrito no abre",
);
d.querySelector("[data-close-cart]")?.click();
d.querySelector("[data-add]")?.click();
assert(
  d.querySelector(".cart-count")?.textContent === "1",
  "No se agregó al carrito",
);
await authListener?.("SIGNED_IN", {
  user: {
    id: "admin-1",
    email: "gestionacerosoeste@gmail.com",
    user_metadata: { full_name: "Administrador" },
  },
});
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  d.querySelector(".cart-count")?.textContent === "0",
  "El carrito no se aisló al cambiar de usuario",
);
assert(
  d.querySelector("#accountNavName")?.textContent === "Administrador",
  "El nombre del usuario no aparece en el navbar",
);
assert(
  !d.querySelector("#adminNavLink")?.classList.contains("hidden"),
  "El acceso al panel no aparece para el administrador",
);
dom.window.location.hash = "#panel-general";
await new Promise((resolve) => setTimeout(resolve, 20));
assert(
  Boolean(d.querySelector("#categoriesBtn")),
  "Falta administrar categorías",
);
assert(Boolean(d.querySelector("#productsBtn")), "Falta la pestaña Productos");
assert(Boolean(d.querySelector("#usersBtn")), "Falta la pestaña Usuarios");
assert(Boolean(d.querySelector("#chatsBtn")), "Falta la pestaña Chats");
d.querySelector("#usersBtn")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  d.querySelector("#adminUserList")?.textContent.includes("11 3432 2199") &&
    d.querySelector("#adminUserList")?.textContent.includes(
      "gestionacerosoeste@gmail.com",
    ),
  "El panel no muestra los datos de contacto de los usuarios",
);
d.querySelector("#productsBtn")?.click();
assert(
  Boolean(d.querySelector('#adminWorkspace a[href="#producto/mesa-inox"]')),
  "Productos no se pueden abrir directamente desde el panel",
);
dom.window.location.hash = "#producto/mesa-inox";
await new Promise((resolve) => setTimeout(resolve, 40));
assert(
  d.querySelectorAll(".gallery-thumb").length === 2,
  "La galería no muestra fotos y videos",
);
assert(
  Boolean(d.querySelector("[data-delete-question]")),
  "El administrador no puede eliminar preguntas",
);
rows.questions.push({
  id: "q-live",
  product_id: "11111111-1111-4111-8111-111111111111",
  user_id: "customer-1",
  question: "¿Esta pregunta aparece en vivo?",
  answer: null,
});
emitRealtime("questions", {
  eventType: "INSERT",
  new: {
    id: "q-live",
    product_id: "11111111-1111-4111-8111-111111111111",
  },
});
await new Promise((resolve) => setTimeout(resolve, 220));
assert(
  d.querySelector(".question-list")?.textContent.includes(
    "¿Esta pregunta aparece en vivo?",
  ),
  "Las preguntas nuevas no aparecen en tiempo real",
);
d.querySelector("[data-edit]")?.click();
assert(
  d.querySelector("#productPhotos")?.multiple &&
    d.querySelector("#productVideos")?.multiple,
  "El editor no permite seleccionar varias fotos y videos",
);
d.querySelector("[data-close]")?.click();
dom.window.location.hash = "#cliente/client-1";
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  d.querySelector("#clientDetailContent h1")?.textContent === "Cliente ejemplo",
  "La ficha individual del cliente no se renderizó",
);
assert(
  d.querySelectorAll("#clientDetailContent [data-client-detail-photo]").length === 1,
  "La ficha individual no muestra los trabajos",
);
assert(
  d.querySelectorAll("#footerCategories a").length === 1,
  "Las categorías no aparecen al final de la página",
);
dom.window.location.hash = "#panel-general";
await new Promise((resolve) => setTimeout(resolve, 30));
d.querySelector("#ordersBtn")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
rows.orders[0].status = "cancelled";
emitRealtime("orders", {
  eventType: "UPDATE",
  old: { id: "order-1", status: "pending" },
  new: { id: "order-1", status: "cancelled" },
});
await new Promise((resolve) => setTimeout(resolve, 220));
assert(
  d.querySelector('[data-order-status="order-1"]')?.value === "cancelled",
  "La cancelación no se sincroniza en el panel del administrador",
);
rows.orders[0].status = "pending";
await authListener?.("SIGNED_OUT", null);
await new Promise((resolve) => setTimeout(resolve, 30));
rows.profiles = {
  id: "customer-1",
  full_name: "Cliente",
  role: "customer",
};
await authListener?.("SIGNED_IN", {
  user: {
    id: "customer-1",
    email: "cliente@example.test",
    user_metadata: { full_name: "Cliente" },
  },
});
await new Promise((resolve) => setTimeout(resolve, 40));
dom.window.location.hash = "#cuenta";
await new Promise((resolve) => setTimeout(resolve, 30));
assert(Boolean(d.querySelector("#accountChatTab")), "Falta el chat del cliente");
assert(
  Boolean(d.querySelector("[data-cancel-order]")),
  "El cliente no puede cancelar un pedido pendiente",
);
rows.orders[0].status = "paid";
d.querySelector("#accountOrdersTab")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
const consultationLink = d.querySelector(
  '.customer-order-actions a[href*="wa.me"]',
);
const consultationText = consultationLink
  ? new URL(consultationLink.href).searchParams.get("text") || ""
  : "";
assert(
  consultationText.includes("1× Mesa inox") &&
    !consultationText.toUpperCase().includes("ORDER-1"),
  "La consulta del cliente no usa el nombre y la cantidad del producto",
);
rows.support_conversations = {
  id: "conversation-1",
  user_id: "customer-1",
  status: "open",
};
rows.support_messages = [
  {
    id: "message-own",
    conversation_id: "conversation-1",
    sender_id: "customer-1",
    body: "Mensaje del cliente",
    created_at: "2026-08-20T10:00:00Z",
  },
];
d.querySelector("#accountChatTab")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  Boolean(d.querySelector("#customerChatForm")),
  "El chat privado del cliente no se abre",
);
assert(
  Boolean(d.querySelector('[data-delete-chat-message="message-own"]')) &&
    Boolean(d.querySelector("#deleteCustomerConversation")),
  "El cliente no puede eliminar sus mensajes o su chat",
);
d.querySelector('[data-delete-chat-message="message-own"]')?.click();
await new Promise((resolve) => setTimeout(resolve, 40));
assert(
  !d.querySelector("#customerChatMessages")?.textContent.includes(
    "Mensaje del cliente",
  ),
  "El borrado de un mensaje propio no actualiza el chat",
);
rows.support_messages.push({
  id: "message-admin",
  conversation_id: "conversation-1",
  sender_id: "admin-1",
  body: "Respuesta en tiempo real",
  created_at: "2026-08-20T10:01:00Z",
});
emitRealtime("support_messages", {
  eventType: "INSERT",
  new: {
    id: "message-admin",
    conversation_id: "conversation-1",
  },
});
await new Promise((resolve) => setTimeout(resolve, 160));
assert(
  d.querySelector("#customerChatMessages")?.textContent.includes(
    "Respuesta en tiempo real",
  ) &&
    !d.querySelector('[data-delete-chat-message="message-admin"]'),
  "Los mensajes nuevos no aparecen en tiempo real",
);
assert(
  paymentFunction.includes('MP_ENVIRONMENT') &&
    paymentFunction.includes('user_id: user.id') &&
    !paymentFunction.includes('sandbox_init_point'),
  "El pago no quedó protegido para producción y usuarios autenticados",
);
assert(
  customerMigration.includes("cancel_own_order") &&
    customerMigration.includes("support_messages") &&
    customerMigration.includes("hidden_by_customer") &&
    customerMigration.includes("supabase_realtime"),
  "La migración de pedidos y chat está incompleta",
);
assert(
  adminUsersMigration.includes("add column if not exists email") &&
    adminUsersMigration.includes("from auth.users") &&
    adminUsersMigration.includes("sync_profile_email"),
  "La migración de usuarios no completa o sincroniza los emails",
);
assert(
  realtimeMigration.includes("delete_support_message") &&
    realtimeMigration.includes("delete_support_conversation") &&
    realtimeMigration.includes("supabase_realtime") &&
    realtimeMigration.includes("replica identity full"),
  "La migración de tiempo real y borrado seguro está incompleta",
);
await authListener?.("SIGNED_OUT", null);
await new Promise((resolve) => setTimeout(resolve, 30));
activeSession = {
  user: {
    id: "customer-1",
    email: "cliente@example.test",
    user_metadata: { full_name: "Cliente" },
  },
};
dom.window.location.hash = "#productos";
await new Promise((resolve) => setTimeout(resolve, 20));
d.querySelector("[data-open-cart]")?.click();
d.querySelector("#mpBtn")?.click();
await new Promise((resolve) => setTimeout(resolve, 40));
assert(
  Boolean(d.querySelector("#checkoutForm")),
  "El checkout no recupera una sesión persistida en incógnito",
);
d.querySelector("#modal [data-close]")?.click();
await authListener?.("PASSWORD_RECOVERY", {
  user: { id: "customer-1", email: "cliente@example.test", user_metadata: {} },
});
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  Boolean(d.querySelector("#passwordUpdateForm")) &&
    !d.querySelector("#cambiar-contrasena")?.classList.contains("hidden"),
  "La recuperación no bloquea la vista en el formulario de contraseña",
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  "QA OK: catálogo, carrito, pagos, usuarios y sincronización en vivo de pedidos, preguntas y chat",
);
