const CONFIG = {
    API_URL: window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
        ? "http://127.0.0.1:5000/api"
        : "/api", 
    STORAGE_KEYS: {
        TOKEN: "bizspark_token",
        USER: "bizspark_user",
        CART: "bizspark_cart"
    },
    DEFAULT_IMG: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"
};

const AppState = {
    token: localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN) || null,
    user: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER)) || null,
    cart: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.CART)) || [],
    products: [],
    orders: [],
    searchQuery: "",

    saveUser(user) {
        this.user = user;
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
    },
    saveToken(token) {
        this.token = token;
        localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    },
    saveCart(cart) {
        this.cart = cart;
        localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(cart));
    }
};

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
    const oldCart = localStorage.getItem('bizspark_cart');
    if (oldCart && oldCart.length > 100000) {
        localStorage.removeItem('bizspark_cart');
        AppState.cart = [];
    }

    setupAuthListeners();
    setupCartListeners();
    setupNavigation();
    setupForms();
    setupSearch();

    if (AppState.token && AppState.user) {
        unlockSite();
    } else {
        lockSite();
    }
}

// --- AUTHENTICATION HELPERS & EVENT LISTENERS ---
function setupAuthListeners() {
    const authForm = document.getElementById("authForm") || document.getElementById("loginForm");
    if (authForm) {
        authForm.addEventListener("submit", handleAuth);
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }
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
    fetchProducts();
    updateCartUI();
}

async function handleAuth(e) {
    e.preventDefault();
    const emailInput = document.getElementById("authEmail") || document.getElementById("email");
    const email = emailInput ? emailInput.value.trim() : "";
    
    if (!email) return showToast("Enter email", "error");

    const bizName = email.split("@")[0] + "'s Shop";
    AppState.saveToken("token_" + Date.now());
    AppState.saveUser({ email, businessName: bizName });
    showToast(`Welcome, ${bizName}!`, "success");
    unlockSite();
}

function handleLogout() {
    AppState.saveToken(null);
    AppState.saveUser(null);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
    showToast("Signed out", "info");
    lockSite();
}

// --- NAVIGATION & TABS ---
function setupNavigation() {
    document.querySelectorAll('.nav-item, .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item, .nav-link').forEach(i => i.classList.remove('active'));
            link.classList.add('active');
            const target = link.dataset.target || link.getAttribute('data-tab') || link.getAttribute('href')?.replace('#', '');
            if (target) switchSection(target);
        });
    });
}

function switchSection(id) {
    document.querySelectorAll('.page-section, .tab-content').forEach(s => s.style.display = 'none');
    const target = document.getElementById(id);
    if (target) target.style.display = 'block';
    if (id === 'dashboardSection' || id === 'dashboard') fetchDashboardMetrics();
}

// --- PRODUCT DATA FETCHING & CARDS ---
async function fetchProducts() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/products`);
        AppState.products = await res.json();
        renderGrids();
    } catch (err) {
        console.error("Failed to load products:", err);
        showToast("Failed to load products", "error");
    }
}

function renderGrids() {
    const marketGrid = document.getElementById('marketProductsGrid') || document.getElementById('uploadedItems');
    const ownerGrid = document.getElementById('ownerProductsGrid');
    const shopGrid = document.getElementById('myShopProductsGrid');
    const emptyMarket = document.getElementById('emptyMarketText');
    const emptyOwner = document.getElementById('emptyOwnerText');

    if (marketGrid) marketGrid.innerHTML = '';
    if (ownerGrid) ownerGrid.innerHTML = '';
    if (shopGrid) shopGrid.innerHTML = '';

    const filtered = AppState.products.filter(p =>
        (p.productName || '').toLowerCase().includes(AppState.searchQuery) ||
        (p.businessName || '').toLowerCase().includes(AppState.searchQuery) ||
        (p.category || '').toLowerCase().includes(AppState.searchQuery)
    );

    if (emptyMarket) emptyMarket.style.display = filtered.length ? 'none' : 'block';
    filtered.forEach(p => {
        if (marketGrid) marketGrid.appendChild(createProductCard(p, false));
    });

    const myBiz = AppState.user?.businessName?.toLowerCase();
    const myProducts = AppState.products.filter(p => p.businessName?.toLowerCase() === myBiz);

    if (emptyOwner) emptyOwner.style.display = myProducts.length ? 'none' : 'block';
    myProducts.forEach(p => {
        if (ownerGrid) ownerGrid.appendChild(createProductCard(p, true));
        if (shopGrid) shopGrid.appendChild(createProductCard(p, true));
    });
}

function createProductCard(product, isOwner) {
    const card = document.createElement('div');
    card.className = 'product-card';
    const productId = product.id;

    card.innerHTML = `
        <div class="card-top-content">
            <div class="media-container">
                <img src="${product.mediaUrl || CONFIG.DEFAULT_IMG}" class="product-media" alt="Product" style="width:100%; height:180px; object-fit:cover; border-radius:6px;">
                <span class="category-tag">${escapeHtml(product.category || 'General')}</span>
            </div>
            <div class="product-details">
                <h3 class="product-title">${escapeHtml(product.productName)}</h3>
                <p class="product-desc">${escapeHtml(product.description || '')}</p>
                <div class="vendor-row">
                    <span class="vendor-name"><i class="fa-solid fa-store"></i> ${escapeHtml(product.businessName)}</span>
                </div>
            </div>
        </div>
        <div class="card-bottom-row" style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
            <div class="product-price" style="font-weight:bold; font-size:1.1rem; color:#6366f1;">$${parseFloat(product.price || 0).toFixed(2)}</div>
            ${isOwner ?
                `<button class="cart-add-btn" style="color: #ef4444; background:none; border:none; cursor:pointer;" onclick="deleteProduct('${productId}')" title="Delete"><i class="fa-solid fa-trash"></i></button>` :
                `<button class="cart-add-btn" style="background:#6366f1; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;" onclick="addToCart('${productId}')" title="Add to Cart"><i class="fa-solid fa-cart-shopping"></i> Add to Cart</button>`
            }
        </div>
    `;
    return card;
}

// --- PRODUCT FORMS & ACTIONS ---
function setupForms() {
    const productForm = document.getElementById('productForm');
    if (!productForm) return;

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();
        const bizName = document.getElementById('formBusinessName')?.value || AppState.user?.businessName || 'Vendor';
        const productName = document.getElementById('productName')?.value || '';
        const price = document.getElementById('productPrice')?.value || '0';
        const category = document.getElementById('productCategory')?.value || 'General';
        const description = document.getElementById('productDescription')?.value || '';

        formData.append('businessName', bizName);
        formData.append('productName', productName);
        formData.append('price', price);
        formData.append('category', category);
        formData.append('description', description);
        
        const fileInput = document.getElementById('productImage');
        if (fileInput && fileInput.files[0]) {
            formData.append('productImage', fileInput.files[0]);
        }

        try {
            const res = await fetch(`${CONFIG.API_URL}/products`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                productForm.reset();
                fetchProducts();
                showToast("Product published!", "success");
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(errData.error || "Failed to publish product", "error");
            }
        } catch (err) {
            console.error("Submission error:", err);
            showToast("Server error connecting to backend", "error");
        }
    });
}

async function deleteProduct(id) {
    if (!confirm("Delete this product?")) return;
    await fetch(`${CONFIG.API_URL}/products/${id}`, { method: 'DELETE' });
    fetchProducts();
    showToast("Product deleted", "info");
}

// --- CART MANAGEMENT ---
function setupCartListeners() {
    const cartToggleBtn = document.getElementById("cartToggleBtn") || document.getElementById("cartBtn");
    const closeCartBtn = document.getElementById("closeCartBtn") || document.querySelector(".close-cart");

    if (cartToggleBtn) {
        cartToggleBtn.addEventListener("click", () => toggleCartDrawer());
    }
    if (closeCartBtn) {
        closeCartBtn.addEventListener("click", () => toggleCartDrawer(false));
    }
}

function addToCart(id) {
    const product = AppState.products.find(p => p.id === id);
    if (!product) return;
    const existing = AppState.cart.find(i => i.id === id);

    if (existing) existing.qty += 1;
    else {
        AppState.cart.push({
            id: product.id,
            productName: product.productName,
            price: product.price,
            qty: 1
        });
    }
    AppState.saveCart(AppState.cart);
    updateCartUI();
    toggleCartDrawer(true);
    showToast(`Added ${product.productName} to cart`, "success");
}

function removeFromCart(id) {
    AppState.cart = AppState.cart.filter(item => item.id !== id);
    AppState.saveCart(AppState.cart);
    updateCartUI();
    showToast("Item removed", "info");
}

function updateCartUI() {
    const badge = document.getElementById("cartCountBadge") || document.getElementById("cartCount");
    const subtotalEl = document.getElementById("cartSubtotal");
    const listEl = document.getElementById("cartItemsList") || document.getElementById("cartItems");

    const totalItems = AppState.cart.reduce((s, i) => s + i.qty, 0);
    const subtotal = AppState.cart.reduce((s, i) => s + (i.price * i.qty), 0);

    if (badge) badge.textContent = totalItems;
    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;

    if (listEl) {
        if (AppState.cart.length === 0) {
            listEl.innerHTML = '<p class="empty-cart-msg" style="color: #9ca3af; padding: 12px 0;">Your cart is empty.</p>';
        } else {
            listEl.innerHTML = AppState.cart.map(item => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #232733;">
                    <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${escapeHtml(item.productName)}</div>
                        <div style="font-size: 0.8rem; color: #9ca3af;">$${parseFloat(item.price).toFixed(2)} x ${item.qty}</div>
                    </div>
                    <button onclick="removeFromCart('${item.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer;"><i class="fa-solid fa-xmark"></i> ✕</button>
                </div>
            `).join('');
        }
    }
}

function toggleCartDrawer(force) {
    const drawer = document.getElementById("cartDrawer") || document.getElementById("cartModal");
    if (!drawer) return;

    if (force === true) {
        drawer.style.display = "block";
        drawer.classList.add("open");
    } else if (force === false) {
        drawer.style.display = "none";
        drawer.classList.remove("open");
    } else {
        const isHidden = drawer.style.display === "none" || !drawer.classList.contains("open");
        drawer.style.display = isHidden ? "block" : "none";
        drawer.classList.toggle("open");
    }
}

// --- DASHBOARD & UTILS ---
async function fetchDashboardMetrics() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/dashboard`);
        const data = await res.json();
        const total = (data.transactions || []).reduce((s, o) => s + o.amount, 0);
        
        const revEl = document.getElementById('totalRevenue');
        const orderEl = document.getElementById('orderNum');
        if (revEl) revEl.textContent = `$${total.toFixed(2)}`;
        if (orderEl) orderEl.textContent = (data.transactions || []).length;

        const tbody = document.getElementById('transactionsTableBody');
        if (tbody) {
            tbody.innerHTML = (data.transactions || []).length === 0 ?
            `<tr><td colspan="4" style="text-align:center; padding:16px">No transactions yet</td></tr>` :
            data.transactions.map(t => `
                <tr style="border-bottom: 1px solid #232733; font-size: 0.88rem;">
                    <td style="padding: 10px;">${escapeHtml(t.customerName)}</td>
                    <td style="padding: 10px; color: #9ca3af;">${escapeHtml(t.email)}</td>
                    <td style="padding: 10px; color: #9ca3af;">${new Date(t.date).toLocaleDateString()}</td>
                    <td style="padding: 10px; color: #10b981;">${escapeHtml(t.status)}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error("Failed to fetch dashboard metrics:", err);
    }
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            AppState.searchQuery = e.target.value.toLowerCase();
            renderGrids();
        });
    }
}

function updateUIProfile() {
    if (AppState.user) {
        const nameEl = document.getElementById("displayBusinessName") || document.getElementById("userDisplay");
        const formBizEl = document.getElementById("formBusinessName");
        if (nameEl) nameEl.textContent = AppState.user.businessName || AppState.user.email;
        if (formBizEl) formBizEl.value = AppState.user.businessName || '';
    }
}

function editShopName() {
    const newName = prompt("Enter new shop name:", AppState.user?.businessName);
    if (newName) {
        AppState.user.businessName = newName;
        AppState.saveUser(AppState.user);
        updateUIProfile();
        renderGrids();
        showToast("Shop name updated", "success");
    }
}

function showToast(msg, type="info") {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = `position:fixed; bottom:80px; right:24px; background:${type==="error"?"#ef4444":type==="success"?"#22c55e":"#3b82f6"}; color:white; padding:12px 18px; border-radius:12px; z-index:9999`;
    document.body.appendChild(t); 
    setTimeout(() => t.remove(), 3000);
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}