import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("app.js", root), "utf8");
const styles = readFileSync(new URL("styles.css", root), "utf8");
const paymentFunction = readFileSync(
  new URL("supabase/functions/mp-create-preference/index.ts", root),
  "utf8",
);
const adminDeleteFunction = readFileSync(
  new URL("supabase/functions/admin-delete-user/index.ts", root),
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
const paidOrdersMigration = readFileSync(
  new URL("supabase/migrations/010_hide_unpaid_orders.sql", root),
  "utf8",
);
const finalOrderStatesMigration = readFileSync(
  new URL("supabase/migrations/011_remove_pending_orders.sql", root),
  "utf8",
);
const avatarMigration = readFileSync(
  new URL("supabase/migrations/012_profile_avatars.sql", root),
  "utf8",
);
const orderChatMigration = readFileSync(
  new URL(
    "supabase/migrations/013_order_chat_and_profile_permissions.sql",
    root,
  ),
  "utf8",
);
const notificationsMigration = readFileSync(
  new URL(
    "supabase/migrations/014_notifications_and_color_avatars.sql",
    root,
  ),
  "utf8",
);
const adminPublicEmailMigration = readFileSync(
  new URL("supabase/migrations/015_admin_public_email.sql", root),
  "utf8",
);
const customerNotificationsMigration = readFileSync(
  new URL("supabase/migrations/016_customer_order_notifications.sql", root),
  "utf8",
);
const billingMigration = readFileSync(
  new URL(
    "supabase/migrations/017_withdrawals_and_assisted_billing.sql",
    root,
  ),
  "utf8",
);
const feedbackMigration = readFileSync(
  new URL(
    "supabase/migrations/018_feedback_and_order_archiving.sql",
    root,
  ),
  "utf8",
);
const emailArchiveMigration = readFileSync(
  new URL(
    "supabase/migrations/019_email_delivery_and_admin_archives.sql",
    root,
  ),
  "utf8",
);
const withdrawalFunction = readFileSync(
  new URL("supabase/functions/create-withdrawal-request/index.ts", root),
  "utf8",
);
const invoiceEmailFunction = readFileSync(
  new URL("supabase/functions/send-invoice-email/index.ts", root),
  "utf8",
);
const deleteInvoiceFunction = readFileSync(
  new URL("supabase/functions/delete-invoice-voucher/index.ts", root),
  "utf8",
);
const feedbackFunction = readFileSync(
  new URL("supabase/functions/send-feedback/index.ts", root),
  "utf8",
);
const retryFeedbackFunction = readFileSync(
  new URL("supabase/functions/retry-feedback-email/index.ts", root),
  "utf8",
);
const updateWithdrawalFunction = readFileSync(
  new URL("supabase/functions/update-withdrawal-request/index.ts", root),
  "utf8",
);
const adminNotificationFunction = readFileSync(
  new URL("supabase/functions/send-admin-notification/index.ts", root),
  "utf8",
);
const sharedEmailFunction = readFileSync(
  new URL("supabase/functions/_shared/email.ts", root),
  "utf8",
);
const paymentWebhookFunction = readFileSync(
  new URL("supabase/functions/mp-webhook/index.ts", root),
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
      images: [
        "https://example.test/work-1.jpg",
        "https://example.test/work-2.jpg",
      ],
      sort_order: 10,
      is_active: true,
    },
  ],
  store_settings: {
    id: 1,
    deposit_percentage: 50,
    freight_whatsapp: "5491134322199",
    sales_whatsapp: "5491134322199",
    contact_email: "gestionacerosoeste@gmail.com",
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
      status: "paid",
      subtotal: 100000,
      hidden_by_customer: false,
      created_at: "2026-08-18T10:00:00Z",
      payment_type: "full",
      amount_to_pay: 100000,
      order_items: [
        {
          product_id: "11111111-1111-4111-8111-111111111111",
          quantity: 1,
          product_name: "Mesa inox",
          unit_price: 100000,
          subtotal: 100000,
          product_image_url: "https://example.test/product.jpg",
        },
      ],
      invoices: [
        {
          id: "invoice-1",
          invoice_type: "Factura A",
          point_of_sale: 1,
          invoice_number: 1166598695,
          gross_amount: 100000,
          pdf_path: "customer-1/order-1/factura.pdf",
          status: "sent",
        },
      ],
      withdrawal_requests: [],
    },
  ],
  support_conversations: [],
  support_messages: [],
  admin_notifications: [
    {
      id: "notification-1",
      type: "question",
      title: "Nueva pregunta en Mesa inox",
      body: "¿Se fabrica a medida?",
      actor_id: "customer-1",
      product_id: "11111111-1111-4111-8111-111111111111",
      conversation_id: null,
      is_read: false,
      created_at: "2026-08-20T11:00:00Z",
    },
  ],
  user_notifications: [
    {
      id: "user-notification-1",
      user_id: "customer-1",
      type: "message",
      title: "Nuevo mensaje de Aceros Oeste",
      body: "Tenemos una novedad sobre tu consulta.",
      order_id: null,
      conversation_id: "conversation-1",
      is_read: false,
      created_at: "2026-08-20T12:00:00Z",
    },
  ],
};
function query(table) {
  let single = false;
  const equals = [];
  const api = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "then")
          return (resolve) => {
            const source = rows[table];
            const matches = Array.isArray(source)
              ? source.filter((row) =>
                  equals.every(([column, value]) => row?.[column] === value),
                )
              : source &&
                  equals.every(([column, value]) => source?.[column] === value)
                ? [source]
                : [];
            resolve({
              data: single ? matches[0] || null : matches,
              error: null,
            });
          };
        if (key === "eq")
          return (column, value) => {
            equals.push([column, value]);
            return api;
          };
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
const invokedFunctions = [];
const openedUrls = [];
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
      createSignedUrl: async () => ({
        data: { signedUrl: "https://example.test/factura-firmada.pdf" },
        error: null,
      }),
    }),
  },
  functions: {
    invoke: async (name) => {
      invokedFunctions.push(name);
      return name === "admin-delete-user"
        ? { data: { deleted: true }, error: null }
        : { data: { initPoint: "https://example.test/pay" }, error: null };
    },
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
    if (name === "get_or_create_order_conversation") {
      let conversation = Array.isArray(rows.support_conversations)
        ? rows.support_conversations.find(
            (item) => item.order_id === values.p_order_id,
          )
        : rows.support_conversations?.order_id === values.p_order_id
          ? rows.support_conversations
          : null;
      if (!conversation) {
        conversation = {
          id: `order-chat-${values.p_order_id}`,
          user_id: "customer-1",
          order_id: values.p_order_id,
          status: "open",
        };
        rows.support_conversations = Array.isArray(rows.support_conversations)
          ? [...rows.support_conversations, conversation]
          : [conversation];
      }
      return { data: conversation, error: null };
    }
    return { data: null, error: null };
  },
};
const executable = html
  .replace('<script src="assets/vendor/supabase.js?v=1"></script>', "")
  .replace('<script src="config.js"></script>', "")
  .replace(
    '<script src="app.js?v=30"></script>',
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
    window.open = (url) => {
      openedUrls.push(url);
      return null;
    };
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
  !d.querySelector(".whatsapp-float span"),
  "El acceso flotante todavía muestra el texto WhatsApp",
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
assert(
  Boolean(d.querySelector("#cuenta .customer-shell .customer-sidebar")) &&
    Boolean(d.querySelector("#profileForm")),
  "El administrador no usa el mismo panel de perfil editable",
);
assert(
  !d.querySelector("#adminNotificationCenter")?.classList.contains("hidden") &&
    d.querySelector("#notificationCount")?.textContent === "1",
  "El administrador no ve el centro de notificaciones",
);
assert(
  d.querySelector("#accountContent")?.textContent.includes(
    "gestionacerosoestee@gmail.com",
  ) &&
    !d.querySelector("#accountContent")?.textContent.includes(
      "gestionacerosoeste@gmail.com",
    ),
  "La cuenta administrativa todavía muestra el correo anterior",
);
d.querySelector("#notificationBell")?.click();
d.querySelector("[data-notification-id]")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  d.querySelector("#notificationCount")?.classList.contains("hidden"),
  "La notificación administrativa no desaparece después de abrirla",
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
assert(
  Boolean(d.querySelector(".admin-shell .admin-sidebar")) &&
    d.querySelectorAll(".admin-side-nav [data-admin-route]").length === 10,
  "El panel no usa el menú lateral completo",
);
rows.profiles = [
  {
    id: "admin-1",
    full_name: "Administrador",
    email: "gestionacerosoestee@gmail.com",
    phone: "11 3432 2199",
    role: "admin",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "customer-1",
    full_name: "Cliente prueba",
    email: "cliente@example.test",
    phone: "11 2222 3333",
    role: "customer",
    created_at: "2026-08-02T10:00:00Z",
  },
];
d.querySelector("#usersBtn")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  d.querySelector("#adminUserList")?.textContent.includes("11 3432 2199") &&
    d.querySelector("#adminUserList")?.textContent.includes(
      "gestionacerosoestee@gmail.com",
    ),
  "El panel no muestra los datos de contacto de los usuarios",
);
assert(
  !d.querySelector('[data-delete-user="admin-1"]') &&
    Boolean(d.querySelector('[data-delete-user="customer-1"]')),
  "El panel no protege al admin o no permite eliminar clientes",
);
d.querySelector('[data-delete-user="customer-1"]')?.click();
d.querySelector("#confirmActionAccept")?.click();
await new Promise((resolve) => setTimeout(resolve, 40));
assert(
  invokedFunctions.includes("admin-delete-user"),
  "El botón de eliminar usuario no llama a la función protegida",
);
d.querySelector("#productsBtn")?.click();
assert(
  Boolean(d.querySelector('#adminWorkspace a[href="#producto/mesa-inox"]')),
  "Productos no se pueden abrir directamente desde el panel",
);
assert(
  d.querySelectorAll(".admin-product-menu a, .admin-product-menu button")
    .length === 3 &&
    Boolean(d.querySelector('[data-similar="11111111-1111-4111-8111-111111111111"]')),
  "El menú de cada producto no contiene sólo Ver, Modificar y Publicar similar",
);
d.querySelector("[data-similar]")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  d.querySelector('#productForm [name="name"]')?.value.includes("Similar") &&
    d.querySelectorAll("[data-wizard-step]").length === 4,
  "Publicar similar no abre una copia editable en el asistente",
);
d.querySelector("#cancelProductEditor")?.click();
d.querySelector("#clientsBtn")?.click();
await new Promise((resolve) => setTimeout(resolve, 20));
d.querySelector('[data-edit-client="client-1"]')?.click();
assert(
  Boolean(d.querySelector("#clientForm")) &&
    !d.querySelector('#clientForm [name="sort_order"]') &&
    !d.querySelector('#clientForm [name="is_active"]') &&
    !d.querySelector("#clientForm")?.textContent.includes("sin títulos automáticos") &&
    !d.querySelector("#clientForm")?.textContent.includes("Orden") &&
    !d.querySelector("#clientForm")?.textContent.includes("Visible"),
  "El editor de clientes todavía muestra controles o aclaraciones internas",
);
d.querySelector("#modal [data-close]")?.click();
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
await new Promise((resolve) => setTimeout(resolve, 40));
assert(
  d.querySelector("#productPhotos")?.multiple &&
    d.querySelector("#productVideos")?.multiple &&
    d.querySelectorAll("[data-wizard-step]").length === 4,
  "El editor no permite seleccionar varias fotos y videos",
);
d.querySelector("#cancelProductEditor")?.click();
dom.window.location.hash = "#cliente/client-1";
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  d.querySelector("#clientDetailContent h1")?.textContent === "Cliente ejemplo",
  "La ficha individual del cliente no se renderizó",
);
assert(
  d.querySelectorAll("#clientDetailContent [data-client-detail-photo]").length === 2,
  "La ficha individual no muestra los trabajos",
);
d.querySelector("#clientDetailContent [data-client-detail-photo]")?.click();
assert(
  Boolean(d.querySelector("#modal .client-photo-large")),
  "Las fotos reducidas del cliente no se abren en tamaño grande",
);
d.querySelector("#modal [data-close]")?.click();
assert(
  d.querySelector(".client-profile-card")?.textContent.includes(
    "Gastronomía",
  ) &&
    d.querySelector(".client-profile-card")?.textContent.includes(
      "Cliente ejemplo",
    ) &&
    !d.querySelector(".client-profile-card")?.textContent.includes(
      "Trabajo a medida",
    ) &&
    d.querySelector(".client-project-copy")?.textContent ===
      "Trabajo a medida" &&
    !d.querySelector("#clientDetailContent")?.textContent.includes(
      "TRABAJO REALIZADO",
    ) &&
    Boolean(d.querySelector(".client-photo-stack")),
  "La descripción sigue pegada al logo en vez de acompañar las fotos",
);
assert(
  d.querySelectorAll("#footerCategories a").length === 1,
  "Las categorías no aparecen al final de la página",
);
dom.window.location.hash = "#panel-general";
await new Promise((resolve) => setTimeout(resolve, 30));
d.querySelector("#ordersBtn")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  Boolean(d.querySelector('.admin-order-product img[src*="product.jpg"]')) &&
    Boolean(d.querySelector(".admin-order-avatar")) &&
    Boolean(d.querySelector('[data-admin-order-chat="order-1"]')),
  "Pedidos del administrador no muestra producto, cliente o chat",
);
d.querySelector('[data-admin-order-chat="order-1"]')?.click();
await new Promise((resolve) => setTimeout(resolve, 40));
assert(
  Boolean(d.querySelector("#adminChatForm")) &&
    d.querySelector("#adminWorkspace")?.textContent.includes("Mesa inox"),
  "El administrador no puede abrir el chat específico del pedido",
);
d.querySelector("#backToAdminChats")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
rows.orders[0].status = "cancelled";
emitRealtime("orders", {
  eventType: "UPDATE",
  old: { id: "order-1", status: "paid" },
  new: { id: "order-1", status: "cancelled" },
});
await new Promise((resolve) => setTimeout(resolve, 220));
assert(
  d.querySelector('[data-order-status="order-1"]')?.value === "cancelled",
  "La cancelación no se sincroniza en el panel del administrador",
);
rows.orders[0].status = "paid";
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
  Boolean(d.querySelector(".customer-shell .customer-sidebar")) &&
    Boolean(d.querySelector("#customerProfileBtn")) &&
    Boolean(d.querySelector("#accountBackStore")),
  "La cuenta no usa el panel completo de cliente",
);
assert(
  !d.querySelector("#adminNotificationCenter")?.classList.contains("hidden") &&
    d.querySelector("#notificationCount")?.textContent === "1",
  "El cliente no recibe sus notificaciones en la campana",
);
rows.user_notifications.push({
  id: "user-notification-live",
  user_id: "customer-1",
  type: "order",
  title: "Tu pedido está en camino",
  body: "1× Mesa inox",
  order_id: "order-1",
  conversation_id: null,
  is_read: false,
  created_at: "2026-08-20T12:05:00Z",
});
emitRealtime("user_notifications", {
  eventType: "INSERT",
  new: rows.user_notifications.at(-1),
});
await new Promise((resolve) => setTimeout(resolve, 160));
assert(
  d.querySelector("#notificationCount")?.textContent === "2",
  "Las novedades del cliente no aparecen en tiempo real",
);
d.querySelector("#customerProfileBtn")?.click();
assert(
  Boolean(d.querySelector("#editAvatar")) &&
    Boolean(d.querySelector(".account-avatar")),
  "La cuenta no muestra el avatar configurable",
);
d.querySelector("#editAvatar")?.click();
assert(
  d.querySelectorAll(".avatar-preset-option").length === 7 &&
    d.querySelector("#avatarPhoto")?.accept.includes("image/") &&
    !d.querySelector("#avatarForm")?.textContent.includes("Aceros Oeste") &&
    d.querySelector("#avatarForm")?.textContent.includes("Naranja") &&
    d.querySelector("#avatarForm")?.textContent.includes("Celeste"),
  "No se pueden elegir iconos predeterminados o una foto propia",
);
d.querySelector("#modal [data-close]")?.click();
assert(
  !d.querySelector("[data-cancel-order]") &&
    !d.querySelector("#ordersList")?.textContent.includes("Pendiente"),
  "La cuenta del cliente todavía muestra pedidos pendientes",
);
rows.orders[0].status = "paid";
d.querySelector("#accountOrdersTab")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
assert(
  Boolean(d.querySelector('.purchase-product img[src*="product.jpg"]')) &&
    d.querySelector("#ordersList")?.textContent.includes("1× Mesa inox") &&
    Boolean(d.querySelector(".order-progress")),
  "Mis compras no muestra fotos, productos y seguimiento",
);
const invoiceButton = d.querySelector('[data-invoice-path="customer-1/order-1/factura.pdf"]');
const invoiceMarkup = invoiceButton?.innerHTML;
invoiceButton?.click();
await new Promise((resolve) => setTimeout(resolve, 20));
assert(
  Boolean(invoiceButton?.querySelector(".invoice-download-icon")) &&
    Boolean(invoiceButton?.querySelector(".invoice-download-details")) &&
    Boolean(invoiceButton?.querySelector(".invoice-download-action")) &&
    invoiceButton?.innerHTML === invoiceMarkup &&
    openedUrls.includes("https://example.test/factura-firmada.pdf"),
  "El botón de la factura pierde su diseño después de abrir el PDF",
);
const orderChatButton = d.querySelector('[data-customer-order-chat="order-1"]');
orderChatButton?.click();
await new Promise((resolve) => setTimeout(resolve, 40));
assert(
  Boolean(d.querySelector("#customerOrderChatForm")) &&
    d.querySelector(".order-chat-context")?.textContent.includes("Mesa inox"),
  "El cliente no puede abrir el chat específico de su compra",
);
d.querySelector("#backToCustomerOrders")?.click();
await new Promise((resolve) => setTimeout(resolve, 30));
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
assert(
  Boolean(d.querySelector(".confirm-dialog #confirmActionAccept")),
  "El borrado no usa una confirmación visual profesional",
);
d.querySelector("#confirmActionAccept")?.click();
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
    paymentFunction.includes('status: "awaiting_payment"') &&
    paymentFunction.includes("product_image_url") &&
    !paymentFunction.includes('sandbox_init_point'),
  "El pago no quedó protegido para producción y usuarios autenticados",
);
assert(
  orderChatMigration.includes(
    "grant update (full_name, phone, avatar_url, avatar_preset)",
  ) &&
    orderChatMigration.includes("get_or_create_order_conversation") &&
    orderChatMigration.includes("product_image_url"),
  "La migración no corrige permisos de avatar, fotos y chat por pedido",
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
assert(
  paidOrdersMigration.includes("status = 'awaiting_payment'") &&
    paidOrdersMigration.includes("status <> 'awaiting_payment'") &&
    paidOrdersMigration.includes("deposit_percentage = 50") &&
    app.match(/\.in\("status", \["deposit_paid"/g)?.length >= 2 &&
    !app.includes('data-cancel-order'),
  "Los intentos sin pago todavía pueden aparecer como pedidos",
);
assert(
  finalOrderStatesMigration.includes("where status = 'pending'") &&
    finalOrderStatesMigration.includes("alter column status set default 'awaiting_payment'") &&
    !finalOrderStatesMigration
      .split("add constraint orders_status_check")[1]
      ?.includes("'pending'"),
  "La base de datos todavía acepta Pendiente como estado comercial",
);
assert(
  app.includes('supabase.functions.invoke("admin-delete-user"') &&
    adminDeleteFunction.includes("auth.admin.deleteUser") &&
    adminDeleteFunction.includes('requester?.role !== "admin"') &&
    adminDeleteFunction.includes("No podés eliminar tu propia cuenta"),
  "La eliminación de usuarios no quedó protegida para administradores",
);
assert(
  avatarMigration.includes("add column if not exists avatar_url") &&
    avatarMigration.includes("profile-avatars") &&
    avatarMigration.includes("auth.uid()::text") &&
    app.includes("rememberPendingCheckout(data.orderId, checkoutLines)") &&
    app.includes('hash.split("?")[0]'),
  "Los avatares o la limpieza segura del carrito no están completos",
);
assert(
  notificationsMigration.includes("create table if not exists public.admin_notifications") &&
    notificationsMigration.includes("questions_notify_admin") &&
    notificationsMigration.includes("support_messages_notify_admin") &&
    notificationsMigration.includes("set full_name = 'Aceros Oeste'") &&
    notificationsMigration.includes("'orange'") &&
    notificationsMigration.includes("'sky'"),
  "La migración de notificaciones, nombre administrativo o colores está incompleta",
);
assert(
  adminPublicEmailMigration.includes("gestionacerosoestee@gmail.com") &&
    adminPublicEmailMigration.includes("gestionacerosoeste@gmail.com") &&
    adminPublicEmailMigration.includes("public.store_settings") &&
    adminPublicEmailMigration.includes("public.profiles"),
  "La migración del correo público administrativo está incompleta",
);
assert(
  customerNotificationsMigration.includes(
    "create table if not exists public.user_notifications",
  ) &&
    customerNotificationsMigration.includes("orders_notify_status_change") &&
    customerNotificationsMigration.includes(
      "support_messages_notify_customer",
    ) &&
    customerNotificationsMigration.includes("on delete cascade") &&
    customerNotificationsMigration.includes("Nueva venta pagada") &&
    app.includes('isAdmin() ? "admin_notifications" : "user_notifications"') &&
    app.includes("clearConversationNotifications") &&
    app.includes("clearOrderNotifications"),
  "Las notificaciones comerciales de clientes y administración están incompletas",
);
assert(
  sharedEmailFunction.includes("¿Cómo seguimos?") &&
    sharedEmailFunction.includes("Saldo pendiente") &&
    sharedEmailFunction.includes("9:00 a 17:00 hs") &&
    sharedEmailFunction.includes("order_items") &&
    paymentWebhookFunction.includes("orderSummaryText(order)"),
  "El correo de confirmación no detalla productos, saldo y próximos pasos",
);
const checkoutCustomerStart = app.indexOf("customer: {");
const checkoutCustomerEnd = app.indexOf("billing: {", checkoutCustomerStart);
const checkoutCustomerPayload = app.slice(
  checkoutCustomerStart,
  checkoutCustomerEnd,
);
assert(
  checkoutCustomerStart >= 0 &&
    checkoutCustomerEnd > checkoutCustomerStart &&
    !checkoutCustomerPayload.includes("email:") &&
    paymentFunction.includes('const accountEmail = String(user.email || "")') &&
    paymentFunction.includes("customer_email: accountEmail") &&
    paymentFunction.includes("payer: { name: customer.name, email: accountEmail }") &&
    !paymentFunction.includes("customer_email: customer.email") &&
    paymentWebhookFunction.includes("supabase.auth.admin.getUserById") &&
    paymentWebhookFunction.includes("to: recipientEmail") &&
    sharedEmailFunction.includes("to: [recipient]") &&
    !sharedEmailFunction.includes("bcc:") &&
    !sharedEmailFunction.includes("bccAdmin"),
  "La confirmación de compra no está aislada al email autenticado del comprador",
);
assert(
  styles.includes(
    "#cuenta.signed-in .account-page-container{width:min(1480px,100%);max-width:none;margin:0 auto}",
  ),
  "El panel de cuenta no quedó centrado",
);
assert(
  adminNotificationFunction.includes("ADMIN_EMAIL") &&
    adminNotificationFunction.includes("sendTransactionalEmail") &&
    adminNotificationFunction.includes('eventType === "question"') &&
    adminNotificationFunction.includes("support_messages") &&
    app.includes('notifyAdminByEmail("question"') &&
    app.includes('notifyAdminByEmail("message"'),
  "Los avisos por email de preguntas y mensajes no están completos",
);
assert(
  app.includes("restoreStoreCache") &&
    app.includes("persistStoreCache") &&
    app.includes("Conservamos el catálogo completo") &&
    !app.includes("Mostramos productos de referencia"),
  "El catálogo todavía puede reemplazarse por cuatro productos de muestra",
);
assert(
  html.includes("consumer-rights-bar") &&
    html.includes('href="#arrepentimiento">BOTÓN DE ARREPENTIMIENTO') &&
    html.includes('id="arrepentimiento"') &&
    app.includes('"create-withdrawal-request"') &&
    withdrawalFunction.includes('status: "submitted"') &&
    withdrawalFunction.includes("requestCode"),
  "El botón o el circuito público de arrepentimiento está incompleto",
);
assert(
  billingMigration.includes("create table if not exists public.withdrawal_requests") &&
    billingMigration.includes("create table if not exists public.invoices") &&
    billingMigration.includes("create table if not exists public.product_pricing") &&
    billingMigration.includes("invoice-documents") &&
    billingMigration.includes("withdrawal_notify_admin") &&
    billingMigration.includes("invoice_notify_customer"),
  "La migración fiscal y de arrepentimiento está incompleta",
);
assert(
  paymentFunction.includes("billing_condition") &&
    paymentFunction.includes("billing_document_number") &&
    paymentFunction.includes("unit_net_price") &&
    paymentFunction.includes("vat_rate") &&
    paymentFunction.includes('select("id,name,price,stock_quantity,images,sale_type")'),
  "El checkout no conserva datos fiscales y snapshots del producto",
);
assert(
  app.includes("suggestedFinalPrice") &&
    app.includes("Costo de cobro estimado") &&
    app.includes("openAdminInvoices") &&
    app.includes("openAdminWithdrawals") &&
    app.includes("invoice-documents") &&
    invoiceEmailFunction.includes("createSignedUrl") &&
    invoiceEmailFunction.includes("Tu factura está disponible"),
  "La calculadora o la facturación asistida no está completa",
);
assert(
  html.includes('id="sugerencias"') &&
    html.includes('href="#sugerencias"') &&
    app.includes('supabase.functions.invoke("send-feedback"') &&
    feedbackMigration.includes("create table if not exists public.feedback_submissions") &&
    feedbackMigration.includes("admin_archived_at") &&
    feedbackFunction.includes("inappropriatePatterns") &&
    feedbackFunction.includes("ADMIN_EMAIL") &&
    app.includes("admin_archived_at: new Date().toISOString()") &&
    !app.includes('.from("orders")\n        .delete()\n        .eq("id", button.dataset.deleteOrder)'),
  "Las sugerencias moderadas o el archivado seguro de pedidos están incompletos",
);
assert(
  emailArchiveMigration.includes("add column if not exists email_error") &&
    emailArchiveMigration.includes("add column if not exists archived_at") &&
    emailArchiveMigration.includes("add column if not exists billing_archived_at") &&
    emailArchiveMigration.includes("add column if not exists feedback_id") &&
    emailArchiveMigration.includes("new.id"),
  "La migración no conserva el estado real de correos o el archivo administrativo",
);
assert(
  feedbackFunction.includes("emailSent: false") &&
    feedbackFunction.includes("email_error") &&
    feedbackFunction.includes("feedbackId: feedback.id") &&
    retryFeedbackFunction.includes('profile?.role !== "admin"') &&
    retryFeedbackFunction.includes("sendTransactionalEmail") &&
    app.includes("openFeedbackNotification") &&
    app.includes('"retry-feedback-email"') &&
    app.includes("El aviso por correo está temporalmente pendiente") &&
    sharedEmailFunction.includes("La API key de Resend es inválida o fue revocada") &&
    !sharedEmailFunction.includes('throw new Error(`Email rechazado:'),
  "El seguimiento y reintento real de sugerencias por correo está incompleto",
);
assert(
  app.includes('.is("billing_archived_at", null)') &&
    app.includes("archiveBillingOrder") &&
    app.includes('data-archive-billing=') &&
    app.includes('.is("archived_at", null)') &&
    app.includes("archiveWithdrawalRequest") &&
    app.includes("archiveAfterReply") &&
    updateWithdrawalFunction.includes("resolution_email_sent_at") &&
    updateWithdrawalFunction.includes("resolution_email_error") &&
    updateWithdrawalFunction.includes("emailSent && archiveAfterReply"),
  "El archivo seguro de facturación o arrepentimientos está incompleto",
);
assert(
  app.includes('data-delete-invoice=') &&
    app.includes('"delete-invoice-voucher"') &&
    app.includes("Sólo se puede eliminar un comprobante cuando la compra está cancelada") &&
    deleteInvoiceFunction.includes('requester?.role !== "admin"') &&
    deleteInvoiceFunction.includes('order.status !== "cancelled"') &&
    deleteInvoiceFunction.includes('.from("invoice-documents")') &&
    deleteInvoiceFunction.includes('.from("invoices")') &&
    deleteInvoiceFunction.includes('billing_status: billingStatus') &&
    deleteInvoiceFunction.includes('.eq("type", "invoice")'),
  "La eliminación segura de comprobantes cancelados está incompleta",
);
assert(
  app.includes('<button class="btn outline" type="button" data-archive-billing="${order.id}">Quitar del panel</button>') &&
    app.includes("Esta acción no genera una factura ni lo marca como facturado.") &&
    app.includes('.update({ billing_archived_at: new Date().toISOString() })') &&
    app.includes('.eq("id", order.id)') &&
    styles.includes("min-height:48px;padding:13px 18px") &&
    styles.includes(".feedback-float span{font-size:16px}") &&
    styles.includes(".invoice-download-details{min-width:0;display:grid;gap:5px}"),
  "El archivo libre de facturación o el botón grande de sugerencias están incompletos",
);
assert(
  !app.includes("El importe se vuelve a calcular de forma segura en el servidor") &&
    !app.includes("Modo asistido</b>") &&
    app.includes("Necesito el comprobante con CUIT o razón social"),
  "El checkout o el panel todavía muestran textos técnicos innecesarios",
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
d.querySelector("[data-open-cart]")?.click();
d.querySelectorAll("[data-remove]").forEach((button) => button.click());
d.querySelector("[data-close-cart]")?.click();
d.querySelector("[data-add]")?.click();
dom.window.localStorage.setItem(
  "ao_pending_checkout",
  JSON.stringify({
    orderId: "order-1",
    userId: "customer-1",
    items: [{ id: "11111111-1111-4111-8111-111111111111", qty: 1 }],
  }),
);
dom.window.location.hash = "#checkout/exito?collection_status=approved";
await new Promise((resolve) => setTimeout(resolve, 120));
assert(
  d.querySelector(".cart-count")?.textContent === "0" &&
    !dom.window.localStorage.getItem("ao_pending_checkout"),
  "El carrito no se limpia después de confirmar el pago con parámetros de Mercado Pago",
);
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
  "QA OK v30: tienda, pagos, correo exclusivo al comprador, facturación y administración",
);
