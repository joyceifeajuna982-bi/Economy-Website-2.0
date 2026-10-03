const CONFIG = {
    API_URL: "/api",
    STORAGE_KEYS: { TOKEN: "bizspark_token", USER: "bizspark_user", CART: "bizspark_cart" },
    DEFAULT_IMG: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800"
};

const AppState = {
    token: localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN) || null,
    user: (() => { try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER)); } catch { return null; } })(),
    cart: (() => { try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.CART)) || []; } catch { return []; } })(),
    products: [],
    searchQuery: "",
    saveUser(user) { this.user = user; user ? localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(user)) : localStorage.removeItem(CONFIG.STORAGE_KEYS.USER); },
    saveToken(token) { this.token = token; token ? localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token) : localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN); },
    saveCart(cart) { this.cart = cart; localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(cart)); }
};

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
    setupAuthListeners();
    setupCartListeners();
    setupNavigation();
    setupForms();
    setupSearch();
    setupCheckout();
    setupChat();

    if (AppState.token && AppState.user) { unlockSite(); } else { lockSite(); }
}

async function apiFetch(endpoint, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (AppState.token) headers.set("Authorization", `Bearer ${AppState.token}`);
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${CONFIG.API_URL}${endpoint}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error(data.details || data.error || `Server error (${response.status})`);
    return data;
}

function setupAuthListeners() {
    document.getElementById("authForm")?.addEventListener("submit", handleAuth);
    document.getElementById("authBtn")?.addEventListener("click", handleLogout);
}

function lockSite() {
    document.getElementById("appContent").style.display = "none";
    document.getElementById("authModal").style.display = "flex";
}

function unlockSite() {
    document.getElementById("authModal").style.display = "none";
    document.getElementById("appContent").style.display = "block";
    updateUIProfile();
    updateCartUI();
    fetchProducts();
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById("authEmail")?.value.trim();
    if (!email) return;
    const bizName = email.split("@")[0] + "'s Shop";
    AppState.saveToken("local_" + Date.now());
    AppState.saveUser({ email, businessName: bizName });
    unlockSite();
}

function handleLogout() {
    AppState.saveToken(null);
    AppState.saveUser(null);
    lockSite();
}

function setupNavigation() {
    document.querySelectorAll(".nav-item").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
            link.classList.add("active");
            switchSection(link.dataset.target);
        });
    });
}

function switchSection(id) {
    document.querySelectorAll(".page-section").forEach(s => s.style.display = "none");
    const target = document.getElementById(id);
    if (target) target.style.display = "block";
    if (id === "dashboardSection") fetchDashboardMetrics();
}

async function fetchProducts() {
    const loading = document.getElementById("marketLoading");
    try {
        if (loading) loading.style.display = "block";
        const products = await apiFetch("/products");
        AppState.products = Array.isArray(products) ? products : [];
        renderGrids();
    } catch (e) {
        console.error(e);
    } finally {
        if (loading) loading.style.display = "none";
    }
}

function renderGrids() {
    const marketGrid = document.getElementById("marketProductsGrid");
    if (!marketGrid) return;
    marketGrid.innerHTML = "";

    AppState.products.forEach(product => {
        const card = document.createElement("article");
        card.className = "product-card";
        card.innerHTML = `
            <div class="media-container"><img src="${product.mediaUrl || CONFIG.DEFAULT_IMG}" class="product-media"></div>
            <div class="product-details">
                <h3 class="product-title">${product.productName}</h3>
                <p>$${Number(product.price).toFixed(2)}</p>
            </div>
        `;
        marketGrid.appendChild(card);
    });
}

function setupForms() {
    document.getElementById("productForm")?.addEventListener("submit", publishProduct);
}

async function publishProduct(e) {
    e.preventDefault();
    const productName = document.getElementById("productName")?.value.trim();
    const price = document.getElementById("productPrice")?.value;
    if (!productName || !price) return;

    const formData = new FormData();
    formData.append("productName", productName);
    formData.append("price", price);
    formData.append("businessName", AppState.user?.businessName || "Merchant");

    try {
        await apiFetch("/products", { method: "POST", body: formData });
        e.target.reset();
        await fetchProducts();
    } catch (err) {
        alert(err.message);
    }
}

function setupCartListeners() {
    document.getElementById("cartToggleBtn")?.addEventListener("click", () => toggleCart(true));
    document.getElementById("closeCartBtn")?.addEventListener("click", () => toggleCart(false));
}

function toggleCart(open) {
    document.getElementById("cartDrawer")?.classList.toggle("open", open);
}

function updateCartUI() {}
function setupCheckout() {}
function setupChat() {}
function setupSearch() {}
function updateUIProfile() {}
function fetchDashboardMetrics() {}
function closeCheckoutModal() { document.getElementById("checkoutModal").style.display = "none"; }