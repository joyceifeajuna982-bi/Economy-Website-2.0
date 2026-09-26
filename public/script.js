const CONFIG = {
    API_URL: "/api",

    STORAGE_KEYS: {
        TOKEN: "bizspark_token",
        USER: "bizspark_user",
        CART: "bizspark_cart"
    },

    DEFAULT_IMG: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800"
};

const AppState = {
    token: localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN) || null,

    user: (() => {
        try {
            return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER));
        } catch {
            return null;
        }
    })(),

    cart: (() => {
        try {
            const cart = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.CART));
            return Array.isArray(cart) ? cart : [];
        } catch {
            return [];
        }
    })(),

    products: [],
    searchQuery: "",

    saveUser(user) {
        this.user = user;
        if (user) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
        } else {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
        }
    },

    saveToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
        } else {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
        }
    },

    saveCart(cart) {
        this.cart = Array.isArray(cart) ? cart : [];
        localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(this.cart));
    }
};

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
    setupAuthListeners();
    setupCartListeners();
    setupNavigation();
    setupForms();
    setupSearch();
    setupFileInput();
    setupCheckout();
    setupChat();

    if (AppState.token && AppState.user) {
        unlockSite();
    } else {
        lockSite();
    }

    updateCartUI();
}

/* API FETCH HELPER */
async function apiFetch(endpoint, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");

    if (AppState.token) {
        headers.set("Authorization", `Bearer ${AppState.token}`);
    }

    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    let response;
    try {
        response = await fetch(`${CONFIG.API_URL}${endpoint}`, { ...options, headers });
    } catch (networkError) {
        throw new Error("Unable to connect to the BizSpark server.");
    }

    const contentType = response.headers.get("content-type") || "";
    let data = {};

    if (contentType.includes("application/json")) {
        data = await response.json().catch(() => ({}));
    } else {
        const text = await response.text().catch(() => "");
        data = { error: text || "Invalid response from server." };
    }

    if (!response.ok) {
        throw new Error(data.details || data.error || `Server error (${response.status})`);
    }

    return data;
}

/* AUTHENTICATION */
function setupAuthListeners() {
    const authForm = document.getElementById("authForm") || document.getElementById("loginForm");
    authForm?.addEventListener("submit", handleAuth);

    const logoutBtn = document.getElementById("authBtn") || document.getElementById("logoutBtn");
    logoutBtn?.addEventListener("click", handleLogout);
}

function lockSite() {
    const appContent = document.getElementById("appContent");
    const authModal = document.getElementById("authModal") || document.getElementById("loginModal");

    if (appContent) appContent.style.display = "none";
    if (authModal) authModal.style.display = "flex";
}

function unlockSite() {
    const appContent = document.getElementById("appContent");
    const authModal = document.getElementById("authModal") || document.getElementById("loginModal");

    if (authModal) authModal.style.display = "none";
    if (appContent) appContent.style.display = "block";

    updateUIProfile();
    updateCartUI();
    fetchProducts();
}

async function handleAuth(e) {
    e.preventDefault();
    const emailInput = document.getElementById("authEmail") || document.getElementById("email");
    const email = emailInput?.value.trim();

    if (!email) {
        showToast("Please enter your email address.", "error");
        return;
    }

    const bizName = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) + "'s Shop";

    AppState.saveToken("local_" + crypto.randomUUID());
    AppState.saveUser({ email, businessName: bizName });

    showToast(`Welcome, ${bizName}!`, "success");
    unlockSite();
}

function handleLogout() {
    AppState.saveToken(null);
    AppState.saveUser(null);
    showToast("Signed out successfully.", "info");
    lockSite();
}

/* NAVIGATION */
function setupNavigation() {
    document.querySelectorAll(".nav-item, .nav-link").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();

            document.querySelectorAll(".nav-item, .nav-link").forEach(item => {
                item.classList.remove("active");
            });

            link.classList.add("active");
            const target = link.dataset.target || link.dataset.tab || link.getAttribute("href")?.replace("#", "");

            if (target) switchSection(target);
        });
    });
}

function switchSection(id) {
    document.querySelectorAll(".page-section, .tab-content").forEach(section => {
        section.style.display = "none";
        section.classList.remove("active");
    });

    const target = document.getElementById(id);
    if (target) {
        target.style.display = "block";
        target.classList.add("active");
    }

    if (id === "dashboardSection" || id === "dashboard") {
        fetchDashboardMetrics();
    }
}

/* PRODUCTS */
async function fetchProducts() {
    const loading = document.getElementById("marketLoading");
    try {
        if (loading) loading.style.display = "block";
        const products = await apiFetch("/products");
        AppState.products = Array.isArray(products) ? products : [];
        renderGrids();
    } catch (error) {
        showToast(`Could not load products: ${error.message}`, "error");
    } finally {
        if (loading) loading.style.display = "none";
    }
}

function renderGrids() {
    const marketGrid = document.getElementById("marketProductsGrid");
    const ownerGrid = document.getElementById("ownerProductsGrid");
    const shopGrid = document.getElementById("myShopProductsGrid");
    const emptyMarket = document.getElementById("emptyMarketText");
    const emptyOwner = document.getElementById("emptyOwnerText");
    const emptyShop = document.getElementById("emptyShopText");

    if (marketGrid) marketGrid.innerHTML = "";
    if (ownerGrid) ownerGrid.innerHTML = "";
    if (shopGrid) shopGrid.innerHTML = "";

    const query = AppState.searchQuery.toLowerCase().trim();
    const filtered = AppState.products.filter(product => {
        return (
            (product.productName || "").toLowerCase().includes(query) ||
            (product.businessName || "").toLowerCase().includes(query) ||
            (product.category || "").toLowerCase().includes(query)
        );
    });

    if (emptyMarket) emptyMarket.style.display = filtered.length ? "none" : "block";

    filtered.forEach(product => {
        if (marketGrid) marketGrid.appendChild(createProductCard(product, false));
    });

    const myBusiness = (AppState.user?.businessName || "").toLowerCase().trim();
    const myProducts = AppState.products.filter(product => {
        return (product.businessName || "").toLowerCase().trim() === myBusiness;
    });

    if (emptyOwner) emptyOwner.style.display = myProducts.length ? "none" : "block";
    if (emptyShop) emptyShop.style.display = myProducts.length ? "none" : "block";

    myProducts.forEach(product => {
        if (ownerGrid) ownerGrid.appendChild(createProductCard(product, true));
        if (shopGrid) shopGrid.appendChild(createProductCard(product, true));
    });
}

function createProductCard(product, isOwner) {
    const card = document.createElement("article");
    card.className = "product-card";

    const productId = String(product.id);
    const price = Number.parseFloat(product.price || 0);
    const image = product.mediaUrl || CONFIG.DEFAULT_IMG;

    card.innerHTML = `
        <div class="card-top-content">
            <div class="media-container">
                <img src="${escapeAttribute(image)}" class="product-media" alt="${escapeAttribute(product.productName || "Product")}" loading="lazy" onerror="this.onerror=null;this.src='${CONFIG.DEFAULT_IMG}'">
                <span class="category-tag">${escapeHtml(product.category || "General")}</span>
            </div>
            <div class="product-details">
                <h3 class="product-title">${escapeHtml(product.productName || "Untitled Product")}</h3>
                <p class="product-desc">${escapeHtml(product.description || "")}</p>
                <div class="vendor-row">
                    <span class="vendor-name"><i class="fa-solid fa-store"></i> ${escapeHtml(product.businessName || "Merchant")}</span>
                </div>
            </div>
        </div>
        <div class="card-bottom-row">
            <div class="product-price">$${price.toFixed(2)}</div>
            ${isOwner ? `
                <button class="cart-add-btn danger-btn" type="button" data-action="delete" data-id="${escapeAttribute(productId)}" title="Delete product">
                    <i class="fa-solid fa-trash"></i>
                </button>
            ` : `
                <button class="cart-add-btn add-product-btn" type="button" data-action="cart" data-id="${escapeAttribute(productId)}">
                    <i class="fa-solid fa-cart-shopping"></i> <span>Add to Cart</span>
                </button>
            `}
        </div>
    `;

    card.querySelector("button[data-action]")?.addEventListener("click", () => {
        if (card.querySelector("button[data-action]").dataset.action === "delete") {
            deleteProduct(productId);
        } else {
            addToCart(productId);
        }
    });

    return card;
}

/* FILE SELECTION LISTENER */
function setupFileInput() {
    const fileInput = document.getElementById("productImage");
    const fileNameText = document.getElementById("fileNameText");

    if (!fileInput) return;

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file && fileNameText) {
            fileNameText.textContent = file.name;
        } else if (fileNameText) {
            fileNameText.textContent = "Choose Image File";
        }
    });
}

/* PRODUCT FORM PUBLISHING */
function setupForms() {
    document.getElementById("productForm")?.addEventListener("submit", publishProduct);
}

async function publishProduct(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const submitBtn = form.querySelector('button[type="submit"]');
    const fileInput = document.getElementById("productImage");

    const productName = document.getElementById("productName")?.value.trim();
    const priceValue = document.getElementById("productPrice")?.value;
    const category = document.getElementById("productCategory")?.value.trim();
    const description = document.getElementById("productDescription")?.value.trim();
    const businessName = AppState.user?.businessName || "Merchant";

    if (!productName || !priceValue) {
        showToast("Please enter a product name and price.", "error");
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Publishing...";
        }

        const formData = new FormData();
        formData.append("businessName", businessName);
        formData.append("productName", productName);
        formData.append("price", Number(priceValue).toFixed(2));
        formData.append("category", category || "General");
        formData.append("description", description || "");

        if (fileInput && fileInput.files.length > 0) {
            formData.append("productImage", fileInput.files[0]);
        }

        const result = await apiFetch("/products", {
            method: "POST",
            body: formData
        });

        form.reset();
        const fileNameText = document.getElementById("fileNameText");
        if (fileNameText) fileNameText.textContent = "Choose Image File";

        showToast("Product published successfully!", "success");
        await fetchProducts();

    } catch (error) {
        showToast(`Upload failed: ${error.message}`, "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Publish Product";
        }
    }
}

/* DELETE PRODUCT */
async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
        await apiFetch(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
        await fetchProducts();
        showToast("Product deleted successfully.", "success");
    } catch (error) {
        showToast(`Could not delete product: ${error.message}`, "error");
    }
}

/* SHOPPING CART */
function setupCartListeners() {
    document.getElementById("cartToggleBtn")?.addEventListener("click", () => toggleCartDrawer(true));
    document.getElementById("closeCartBtn")?.addEventListener("click", () => toggleCartDrawer(false));
    document.getElementById("cartOverlay")?.addEventListener("click", () => toggleCartDrawer(false));
}

function addToCart(id) {
    const product = AppState.products.find(item => String(item.id) === String(id));
    if (!product) return;

    const existing = AppState.cart.find(item => String(item.id) === String(id));
    if (existing) {
        existing.qty += 1;
    } else {
        AppState.cart.push({ id: product.id, productName: product.productName, price: Number(product.price || 0), qty: 1 });
    }

    AppState.saveCart(AppState.cart);
    updateCartUI();
    toggleCartDrawer(true);
    showToast(`${product.productName} added to cart.`, "success");
}

function removeFromCart(id) {
    AppState.saveCart(AppState.cart.filter(item => String(item.id) !== String(id)));
    updateCartUI();
}

function updateCartUI() {
    const badge = document.getElementById("cartCountBadge");
    const subtotalEl = document.getElementById("cartSubtotal");
    const listEl = document.getElementById("cartItemsList");

    const totalItems = AppState.cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const subtotal = AppState.cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);

    if (badge) badge.textContent = totalItems;
    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;

    if (!listEl) return;

    if (!AppState.cart.length) {
        listEl.innerHTML = `<div class="empty-cart-msg" style="padding: 20px; text-align: center; color: #64748b;">Your cart is empty.</div>`;
        return;
    }

    listEl.innerHTML = AppState.cart.map(item => `
        <div class="cart-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
            <div class="cart-item-info">
                <strong>${escapeHtml(item.productName)}</strong><br>
                <span style="font-size: 0.85rem; color: #64748b;">$${Number(item.price).toFixed(2)} x ${item.qty}</span>
            </div>
            <div class="cart-item-right" style="display: flex; align-items: center; gap: 12px;">
                <strong>$${(item.price * item.qty).toFixed(2)}</strong>
                <button type="button" class="remove-cart-btn" onclick="removeFromCart('${escapeAttribute(item.id)}')" style="background: transparent; color: #ef4444; padding: 4px; border: none; cursor: pointer;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join("");
}

function toggleCartDrawer(force) {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("cartOverlay");
    if (!drawer) return;

    const shouldOpen = typeof force === "boolean" ? force : !drawer.classList.contains("open");
    drawer.classList.toggle("open", shouldOpen);
    overlay?.classList.toggle("open", shouldOpen);
}

/* CHECKOUT */
function setupCheckout() {
    document.getElementById("checkoutBtn")?.addEventListener("click", openCheckoutModal);
    document.getElementById("checkoutForm")?.addEventListener("submit", submitCartOrder);
}

function openCheckoutModal() {
    if (!AppState.cart.length) {
        showToast("Your cart is empty.", "error");
        return;
    }
    const modal = document.getElementById("checkoutModal");
    if (modal) modal.style.display = "flex";
    toggleCartDrawer(false);
}

function closeCheckoutModal() {
    const modal = document.getElementById("checkoutModal");
    if (modal) modal.style.display = "none";
}

async function submitCartOrder(e) {
    e.preventDefault();
    const name = document.getElementById("custName")?.value.trim();
    const email = document.getElementById("custEmail")?.value.trim();

    if (!name || !email) {
        showToast("Please enter your details.", "error");
        return;
    }

    try {
        await apiFetch("/orders", {
            method: "POST",
            body: JSON.stringify({ customerName: name, email, items: AppState.cart })
        });

        AppState.saveCart([]);
        updateCartUI();
        closeCheckoutModal();
        showToast("Order placed successfully!", "success");
    } catch (error) {
        showToast(`Checkout failed: ${error.message}`, "error");
    }
}

/* DASHBOARD METRICS */
async function fetchDashboardMetrics() {
    try {
        const data = await apiFetch("/dashboard");
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];

        const total = transactions.reduce((sum, order) => sum + Number(order.amount || 0), 0);
        const totalRevEl = document.getElementById("totalRevenue");
        const orderNumEl = document.getElementById("orderNum");

        if (totalRevEl) totalRevEl.textContent = `$${total.toFixed(2)}`;
        if (orderNumEl) orderNumEl.textContent = transactions.length;

        const tbody = document.getElementById("transactionsTableBody");
        if (!tbody) return;

        if (!transactions.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="table-empty" style="text-align: center; padding: 20px; color: #64748b;">No transactions yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = transactions.map(t => `
            <tr>
                <td>${escapeHtml(t.customerName || "Customer")}</td>
                <td>${escapeHtml(t.email || "")}</td>
                <td>${t.date ? new Date(t.date).toLocaleDateString() : "-"}</td>
                <td class="status-cell">${escapeHtml(t.status || "Pending")}</td>
            </tr>
        `).join("");
    } catch (error) {
        showToast(`Dashboard error: ${error.message}`, "error");
    }
}

/* MESSAGES / CHAT */
function setupChat() {
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatMessages = document.getElementById("chatMessages");

    if (!chatForm) return;

    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        const msgEl = document.createElement("div");
        msgEl.className = "chat-bubble user-msg";
        msgEl.style.cssText = "background: #1e293b; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; color: #fff;";
        msgEl.innerHTML = `<strong>${escapeHtml(AppState.user?.businessName || "You")}:</strong> ${escapeHtml(text)}`;

        chatMessages.appendChild(msgEl);
        chatInput.value = "";
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

/* SEARCH & PROFILE */
function setupSearch() {
    document.getElementById("searchInput")?.addEventListener("input", e => {
        AppState.searchQuery = e.target.value;
        renderGrids();
    });
}

function updateUIProfile() {
    if (!AppState.user) return;
    const name = AppState.user.businessName || "Shop";
    const bizNameEl = document.getElementById("displayBusinessName");
    const bizEmailEl = document.getElementById("displayBusinessEmail");
    const formBizNameEl = document.getElementById("formBusinessName");
    const bizLogoEl = document.getElementById("businessLogo");

    if (bizNameEl) bizNameEl.textContent = name;
    if (bizEmailEl) bizEmailEl.textContent = AppState.user.email || "";
    if (formBizNameEl) formBizNameEl.value = name;
    if (bizLogoEl) bizLogoEl.textContent = name.charAt(0).toUpperCase();
}

function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

function escapeHtml(val) {
    return String(val ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttribute(val) {
    return escapeHtml(val);
}