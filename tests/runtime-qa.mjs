import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("app.js", root), "utf8");
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
    role: "admin",
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
const client = {
  from: (table) => query(table),
  auth: {
    getSession: async () => ({ data: { session: null } }),
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
};
const executable = html
  .replace('<script src="assets/vendor/supabase.js?v=1"></script>', "")
  .replace('<script src="config.js"></script>', "")
  .replace(
    '<script src="app.js?v=11"></script>',
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
  },
});
await new Promise((resolve) => setTimeout(resolve, 150));
const d = dom.window.document,
  assert = (ok, message) => {
    if (!ok) errors.push(message);
  };
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
  "QA OK: catálogo, galería, carrito por usuario, login, registro y navegación admin",
);
