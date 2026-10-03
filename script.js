"use strict";

/* =========================================================
   BIZSPARK CONFIG
========================================================= */

const CONFIG = {
    API_URL: "/api",

    STORAGE_KEYS: {
        TOKEN: "bizspark_token",
        USER: "bizspark_user",
        CART: "bizspark_cart"
    },

    DEFAULT_IMG:
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800"
};


/* =========================================================
   APP STATE
========================================================= */

const AppState = {

    token:
        localStorage.getItem(
            CONFIG.STORAGE_KEYS.TOKEN
        ) || null,

    user: getStoredUser(),

    cart: getStoredCart(),

    products: [],

    searchQuery: "",

    category: "all",

    authMode: "login",

    saveToken(token) {

        this.token = token;

        if (token) {

            localStorage.setItem(
                CONFIG.STORAGE_KEYS.TOKEN,
                token
            );

        } else {

            localStorage.removeItem(
                CONFIG.STORAGE_KEYS.TOKEN
            );
        }
    },

    saveUser(user) {

        this.user = user;

        if (user) {

            localStorage.setItem(
                CONFIG.STORAGE_KEYS.USER,
                JSON.stringify(user)
            );

        } else {

            localStorage.removeItem(
                CONFIG.STORAGE_KEYS.USER
            );
        }
    },

    saveCart(cart) {

        this.cart = cart;

        localStorage.setItem(
            CONFIG.STORAGE_KEYS.CART,
            JSON.stringify(cart)
        );
    }
};


/* =========================================================
   STORAGE HELPERS
========================================================= */

function getStoredUser() {

    try {

        const value =
            localStorage.getItem(
                CONFIG.STORAGE_KEYS.USER
            );

        return value ? JSON.parse(value) : null;

    } catch (error) {

        console.warn(
            "Could not read saved user.",
            error
        );

        return null;
    }
}


function getStoredCart() {

    try {

        const value =
            localStorage.getItem(
                CONFIG.STORAGE_KEYS.CART
            );

        return value ? JSON.parse(value) : [];

    } catch (error) {

        console.warn(
            "Could not read saved cart.",
            error
        );

        return [];
    }
}


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initApp
);


async function initApp() {

    setupAuth();

    setupNavigation();

    setupMobileMenu();

    setupMarketplace();

    setupProductForm();

    setupCart();

    setupCheckout();

    setupProfile();

    setupDashboard();

    setupProductImagePreview();

    updateCurrentYear();

    updateUI();

    if (AppState.token && AppState.user) {

        unlockSite();

    } else {

        lockSite();
    }
}


/* =========================================================
   API
========================================================= */

async function apiFetch(
    endpoint,
    options = {}
) {

    const headers =
        new Headers(
            options.headers || {}
        );

    headers.set(
        "Accept",
        "application/json"
    );

    if (AppState.token) {

        headers.set(
            "Authorization",
            `Bearer ${AppState.token}`
        );
    }

    /*
     * Do not manually set Content-Type for FormData.
     * The browser must set its own multipart boundary.
     */

    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
    ) {

        headers.set(
            "Content-Type",
            "application/json"
        );
    }

    let response;

    try {

        response = await fetch(
            `${CONFIG.API_URL}${endpoint}`,
            {
                ...options,
                headers
            }
        );

    } catch (error) {

        throw new Error(
            "Unable to connect to the BizSpark server."
        );
    }

    const data =
        await response
            .json()
            .catch(() => ({}));

    if (!response.ok) {

        throw new Error(
            data.details ||
            data.error ||
            `Server error (${response.status})`
        );
    }

    return data;
}


/* =========================================================
   AUTH
========================================================= */

function setupAuth() {

    const form =
        document.getElementById(
            "authForm"
        );

    const switchButton =
        document.getElementById(
            "authSwitchBtn"
        );

    const passwordToggle =
        document.getElementById(
            "togglePassword"
        );

    if (form) {

        form.addEventListener(
            "submit",
            handleAuthSubmit
        );
    }

    if (switchButton) {

        switchButton.addEventListener(
            "click",
            toggleAuthMode
        );
    }

    if (passwordToggle) {

        passwordToggle.addEventListener(
            "click",
            togglePassword
        );
    }
}


function toggleAuthMode() {

    AppState.authMode =
        AppState.authMode === "login"
            ? "register"
            : "login";

    const title =
        document.getElementById(
            "authTitle"
        );

    const subtitle =
        document.getElementById(
            "authSubtitle"
        );

    const switchText =
        document.getElementById(
            "authSwitchText"
        );

    const switchButton =
        document.getElementById(
            "authSwitchBtn"
        );

    const submitButton =
        document.getElementById(
            "authSubmit"
        );

    const businessGroup =
        document.getElementById(
            "businessNameGroup"
        );

    const password =
        document.getElementById(
            "authPassword"
        );

    if (
        AppState.authMode ===
        "register"
    ) {

        if (title) {
            title.textContent =
                "Create your business account";
        }

        if (subtitle) {
            subtitle.textContent =
                "Join BizSpark and start selling.";
        }

        if (switchText) {
            switchText.textContent =
                "Already have an account?";
        }

        if (switchButton) {
            switchButton.textContent =
                "Sign in";
        }

        if (submitButton) {
            submitButton.textContent =
                "Create account";
        }

        if (businessGroup) {
            businessGroup.classList.remove(
                "hidden"
            );
        }

        if (password) {
            password.autocomplete =
                "new-password";
        }

    } else {

        if (title) {
            title.textContent =
                "Welcome back";
        }

        if (subtitle) {
            subtitle.textContent =
                "Sign in to continue to BizSpark.";
        }

        if (switchText) {
            switchText.textContent =
                "Don't have a business account?";
        }

        if (switchButton) {
            switchButton.textContent =
                "Create one";
        }

        if (submitButton) {
            submitButton.textContent =
                "Sign in";
        }

        if (businessGroup) {
            businessGroup.classList.add(
                "hidden"
            );
        }

        if (password) {
            password.autocomplete =
                "current-password";
        }
    }
}


function togglePassword() {

    const password =
        document.getElementById(
            "authPassword"
        );

    const button =
        document.getElementById(
            "togglePassword"
        );

    if (!password) {
        return;
    }

    if (
        password.type ===
        "password"
    ) {

        password.type = "text";

        if (button) {
            button.textContent = "🙈";
            button.setAttribute(
                "aria-label",
                "Hide password"
            );
        }

    } else {

        password.type = "password";

        if (button) {
            button.textContent = "👁";
            button.setAttribute(
                "aria-label",
                "Show password"
            );
        }
    }
}


function handleAuthSubmit(event) {

    event.preventDefault();

    const emailInput =
        document.getElementById(
            "authEmail"
        );

    const passwordInput =
        document.getElementById(
            "authPassword"
        );

    const businessInput =
        document.getElementById(
            "businessName"
        );

    if (!emailInput || !passwordInput) {
        return;
    }

    const email =
        emailInput.value
            .trim()
            .toLowerCase();

    const password =
        passwordInput.value;

    const businessName =
        businessInput?.value.trim() ||
        `${email.split("@")[0]}'s Shop`;

    if (!email || !password) {

        showToast(
            "Please complete all required fields.",
            "error"
        );

        return;
    }

    if (password.length < 6) {

        showToast(
            "Password must be at least 6 characters.",
            "error"
        );

        return;
    }

    /*
     * Current backend does not provide a real
     * authentication endpoint, so this creates
     * a local account session.
     */

    AppState.saveToken(
        `local_${Date.now()}`
    );

    AppState.saveUser({
        email,
        businessName
    });

    unlockSite();

    showToast(
        AppState.authMode === "register"
            ? "Business account created."
            : "Welcome back!",
        "success"
    );
}


function lockSite() {

    const app =
        document.getElementById(
            "appContent"
        );

    const modal =
        document.getElementById(
            "authModal"
        );

    if (app) {
        app.classList.add("hidden");
    }

    if (modal) {
        modal.style.display = "flex";
        modal.setAttribute(
            "aria-hidden",
            "false"
        );
    }
}


function unlockSite() {

    const app =
        document.getElementById(
            "appContent"
        );

    const modal =
        document.getElementById(
            "authModal"
        );

    if (modal) {
        modal.style.display = "none";
        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    if (app) {
        app.classList.remove("hidden");
    }

    updateUIProfile();

    fetchProducts();

    fetchDashboardMetrics();
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );

    navItems.forEach(item => {

        item.addEventListener(
            "click",
            () => {

                const target =
                    item.dataset.target;

                if (!target) {
                    return;
                }

                switchSection(target);

                closeMobileMenu();
            }
        );
    });

    const brand =
        document.querySelector(
            ".brand"
        );

    if (brand) {

        brand.addEventListener(
            "click",
            event => {

                event.preventDefault();

                switchSection(
                    "marketplaceSection"
                );
            }
        );
    }

    const heroSell =
        document.getElementById(
            "heroSellBtn"
        );

    if (heroSell) {

        heroSell.addEventListener(
            "click",
            () => {
                switchSection(
                    "sellSection"
                );
            }
        );
    }

    const heroBrowse =
        document.getElementById(
            "heroBrowseBtn"
        );

    if (heroBrowse) {

        heroBrowse.addEventListener(
            "click",
            () => {
                switchSection(
                    "marketplaceSection"
                );
            }
        );
    }

    const dashboardSell =
        document.getElementById(
            "dashboardSellBtn"
        );

    if (dashboardSell) {

        dashboardSell.addEventListener(
            "click",
            () => {
                switchSection(
                    "sellSection"
                );
            }
        );
    }
}


function switchSection(sectionId) {

    const sections =
        document.querySelectorAll(
            ".page-section"
        );

    sections.forEach(section => {

        section.style.display =
            "none";

        section.classList.remove(
            "active-section"
        );
    });

    const target =
        document.getElementById(
            sectionId
        );

    if (!target) {
        return;
    }

    target.style.display =
        "block";

    target.classList.add(
        "active-section"
    );

    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );

    navItems.forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.target ===
            sectionId
        );
    });

    if (
        sectionId ===
        "dashboardSection"
    ) {

        fetchDashboardMetrics();
    }
}


/* =========================================================
   MOBILE MENU
========================================================= */

function setupMobileMenu() {

    const button =
        document.getElementById(
            "mobileMenuBtn"
        );

    const nav =
        document.getElementById(
            "mainNav"
        );

    if (!button || !nav) {
        return;
    }

    button.addEventListener(
        "click",
        () => {

            nav.classList.toggle(
                "mobile-open"
            );
        }
    );
}


function closeMobileMenu() {

    const nav =
        document.getElementById(
            "mainNav"
        );

    if (nav) {

        nav.classList.remove(
            "mobile-open"
        );
    }
}


/* =========================================================
   MARKETPLACE
========================================================= */

function setupMarketplace() {

    const search =
        document.getElementById(
            "productSearch"
        );

    const category =
        document.getElementById(
            "categoryFilter"
        );

    if (search) {

        search.addEventListener(
            "input",
            () => {

                AppState.searchQuery =
                    search.value;

                renderProducts();
            }
        );
    }

    if (category) {

        category.addEventListener(
            "change",
            () => {

                AppState.category =
                    category.value;

                renderProducts();
            }
        );
    }
}


async function fetchProducts() {

    const loading =
        document.getElementById(
            "marketLoading"
        );

    try {

        if (loading) {
            loading.style.display =
                "flex";
        }

        const products =
            await apiFetch(
                "/products"
            );

        AppState.products =
            Array.isArray(products)
                ? products
                : [];

        renderProducts();

        renderBusinessProducts();

        updateDashboardProductCount();

    } catch (error) {

        console.error(
            "Product loading error:",
            error
        );

        showToast(
            error.message ||
            "Could not load products.",
            "error"
        );

    } finally {

        if (loading) {
            loading.style.display =
                "none";
        }
    }
}


function renderProducts() {

    const grid =
        document.getElementById(
            "marketProductsGrid"
        );

    const empty =
        document.getElementById(
            "marketEmpty"
        );

    const resultCount =
        document.getElementById(
            "productResultCount"
        );

    if (!grid) {
        return;
    }

    const search =
        AppState.searchQuery
            .trim()
            .toLowerCase();

    const category =
        AppState.category;

    const filtered =
        AppState.products.filter(
            product => {

                const name =
                    String(
                        product.productName ||
                        ""
                    ).toLowerCase();

                const business =
                    String(
                        product.businessName ||
                        ""
                    ).toLowerCase();

                const description =
                    String(
                        product.description ||
                        ""
                    ).toLowerCase();

                const productCategory =
                    String(
                        product.category ||
                        "General"
                    );

                const matchesSearch =
                    !search ||
                    name.includes(search) ||
                    business.includes(search) ||
                    description.includes(search);

                const matchesCategory =
                    category === "all" ||
                    productCategory ===
                    category;

                return (
                    matchesSearch &&
                    matchesCategory
                );
            }
        );

    grid.innerHTML = "";

    if (resultCount) {

        resultCount.textContent =
            `${filtered.length} ${
                filtered.length === 1
                    ? "product"
                    : "products"
            }`;
    }

    if (!filtered.length) {

        if (empty) {
            empty.style.display =
                "block";
        }

        return;
    }

    if (empty) {
        empty.style.display =
            "none";
    }

    filtered.forEach(product => {

        const card =
            document.createElement(
                "article"
            );

        card.className =
            "product-card";

        const image =
            product.mediaUrl ||
            CONFIG.DEFAULT_IMG;

        const price =
            Number(product.price) || 0;

        card.innerHTML = `
            <div class="media-container">
                <img
                    class="product-media"
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.productName || "Product")}"
                    loading="lazy"
                >
            </div>

            <div class="product-details">

                <div class="product-category">
                    ${escapeHTML(
                        product.category ||
                        "General"
                    )}
                </div>

                <h3 class="product-title">
                    ${escapeHTML(
                        product.productName ||
                        "Unnamed product"
                    )}
                </h3>

                <p class="product-business">
                    ${escapeHTML(
                        product.businessName ||
                        "Business"
                    )}
                </p>

                <p class="product-description">
                    ${escapeHTML(
                        product.description ||
                        ""
                    )}
                </p>

                <div class="product-bottom">

                    <strong>
                        ₦${price.toLocaleString()}
                    </strong>

                    <button
                        type="button"
                        class="btn btn-small btn-primary add-to-cart"
                        data-product-id="${escapeHTML(
                            product.id
                        )}"
                    >
                        Add to cart
                    </button>

                </div>

            </div>
        `;

        grid.appendChild(card);
    });
}


/* =========================================================
   PRODUCT SELLING
========================================================= */

function setupProductForm() {

    const form =
        document.getElementById(
            "productForm"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        publishProduct
    );
}


async function publishProduct(event) {

    event.preventDefault();

    if (!AppState.user) {

        showToast(
            "Please sign in first.",
            "error"
        );

        return;
    }

    const nameInput =
        document.getElementById(
            "productName"
        );

    const priceInput =
        document.getElementById(
            "productPrice"
        );

    const categoryInput =
        document.getElementById(
            "productCategory"
        );

    const descriptionInput =
        document.getElementById(
            "productDescription"
        );

    const imageInput =
        document.getElementById(
            "productImage"
        );

    const button =
        document.getElementById(
            "publishProductBtn"
        );

    if (
        !nameInput ||
        !priceInput
    ) {
        return;
    }

    const productName =
        nameInput.value.trim();

    const price =
        Number(priceInput.value);

    const category =
        categoryInput?.value ||
        "General";

    const description =
        descriptionInput?.value.trim() ||
        "";

    if (!productName) {

        showToast(
            "Enter a product name.",
            "error"
        );

        return;
    }

    if (
        !Number.isFinite(price) ||
        price < 0
    ) {

        showToast(
            "Enter a valid price.",
            "error"
        );

        return;
    }

    if (
        imageInput &&
        imageInput.files.length
    ) {

        const file =
            imageInput.files[0];

        const maxSize =
            5 * 1024 * 1024;

        if (file.size > maxSize) {

            showToast(
                "Image must be smaller than 5MB.",
                "error"
            );

            return;
        }
    }

    const formData =
        new FormData();

    formData.append(
        "productName",
        productName
    );

    formData.append(
        "price",
        String(price)
    );

    formData.append(
        "category",
        category
    );

    formData.append(
        "description",
        description
    );

    formData.append(
        "businessName",
        AppState.user.businessName ||
        "Business"
    );

    /*
     * Append the selected image file to FormData so the
     * browser uploads it as part of the request payload.
     */
    if (
        imageInput &&
        imageInput.files.length > 0
    ) {

        formData.append(
            "productImage",
            imageInput.files[0]
        );
    }

    if (button) {

        button.disabled = true;

        button.dataset.originalText =
            button.textContent;

        button.textContent =
            "Publishing...";
    }

    try {

        await apiFetch(
            "/products",
            {
                method: "POST",
                body: formData
            }
        );

        event.target.reset();

        const preview =
            document.getElementById(
                "productPreview"
            );

        if (preview) {
            preview.style.display =
                "none";
        }

        showToast(
            "Product published successfully!",
            "success"
        );

        await fetchProducts();

        switchSection(
            "marketplaceSection"
        );

    } catch (error) {

        console.error(
            "Publish error:",
            error
        );

        showToast(
            error.message ||
            "Could not publish product.",
            "error"
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                button.dataset.originalText ||
                "🚀 Publish product";
        }
    }
}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function setupProductImagePreview() {

    const input =
        document.getElementById(
            "productImage"
        );

    const preview =
        document.getElementById(
            "productPreview"
        );

    const image =
        document.getElementById(
            "productPreviewImage"
        );

    if (
        !input ||
        !preview ||
        !image
    ) {
        return;
    }

    input.addEventListener(
        "change",
        () => {

            const file =
                input.files[0];

            if (!file) {

                preview.style.display =
                    "none";

                return;
            }

            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                showToast(
                    "Please select an image file.",
                    "error"
                );

                input.value = "";

                preview.style.display =
                    "none";

                return;
            }

            const reader =
                new FileReader();

            reader.onload =
                event => {

                    image.src =
                        event.target.result;

                    preview.style.display =
                        "block";
                };

            reader.readAsDataURL(
                file
            );
        }
    );
}


/* =========================================================
   CART
========================================================= */

function setupCart() {

    const cartButton =
        document.getElementById(
            "cartToggleBtn"
        );

    const closeButton =
        document.getElementById(
            "closeCartBtn"
        );

    const backdrop =
        document.getElementById(
            "cartBackdrop"
        );

    const checkoutButton =
        document.getElementById(
            "checkoutBtn"
        );

    if (cartButton) {

        cartButton.addEventListener(
            "click",
            () => toggleCart(true)
        );
    }

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => toggleCart(false)
        );
    }

    if (backdrop) {

        backdrop.addEventListener(
            "click",
            () => toggleCart(false)
        );
    }

    if (checkoutButton) {

        checkoutButton.addEventListener(
            "click",
            openCheckout
        );
    }

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".add-to-cart"
                );

            if (!button) {
                return;
            }

            addToCart(
                button.dataset.productId
            );
        }
    );
}


function toggleCart(open) {

    const drawer =
        document.getElementById(
            "cartDrawer"
        );

    const backdrop =
        document.getElementById(
            "cartBackdrop"
        );

    if (!drawer) {
        return;
    }

    drawer.classList.toggle(
        "open",
        open
    );

    if (backdrop) {

        backdrop.style.display =
            open
                ? "block"
                : "none";
    }
}


function addToCart(productId) {

    const product =
        AppState.products.find(
            item =>
                String(item.id) ===
                String(productId)
        );

    if (!product) {

        showToast(
            "Product could not be found.",
            "error"
        );

        return;
    }

    const existing =
        AppState.cart.find(
            item =>
                String(item.id) ===
                String(productId)
        );

    if (existing) {

        existing.qty += 1;

    } else {

        AppState.cart.push({
            id: product.id,
            productName:
                product.productName,
            price:
                Number(product.price) || 0,
            mediaUrl:
                product.mediaUrl ||
                CONFIG.DEFAULT_IMG,
            qty: 1
        });
    }

    AppState.saveCart(
        AppState.cart
    );

    updateCartUI();

    showToast(
        "Product added to cart.",
        "success"
    );
}


function updateCartUI() {

    const count =
        AppState.cart.reduce(
            (total, item) =>
                total +
                Number(item.qty || 0),
            0
        );

    const total =
        AppState.cart.reduce(
            (sum, item) =>
                sum +
                Number(item.price || 0) *
                Number(item.qty || 0),
            0
        );

    const countElement =
        document.getElementById(
            "cartCount"
        );

    if (countElement) {
        countElement.textContent =
            String(count);
    }

    const label =
        document.getElementById(
            "cartItemsLabel"
        );

    if (label) {

        label.textContent =
            `${count} ${
                count === 1
                    ? "item"
                    : "items"
            }`;
    }

    const totalElement =
        document.getElementById(
            "cartTotal"
        );

    if (totalElement) {

        totalElement.textContent =
            formatCurrency(total);
    }

    const checkoutButton =
        document.getElementById(
            "checkoutBtn"
        );

    if (checkoutButton) {

        checkoutButton.disabled =
            AppState.cart.length === 0;
    }

    const checkoutCount =
        document.getElementById(
            "checkoutItemCount"
        );

    if (checkoutCount) {
        checkoutCount.textContent =
            String(count);
    }

    const checkoutTotal =
        document.getElementById(
            "checkoutTotal"
        );

    if (checkoutTotal) {

        checkoutTotal.textContent =
            formatCurrency(total);
    }

    renderCart();
}


function renderCart() {

    const container =
        document.getElementById(
            "cartItems"
        );

    if (!container) {
        return;
    }

    if (!AppState.cart.length) {

        container.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-icon">🛒</div>
                <h3>Your cart is empty</h3>
                <p>
                    Add products from the marketplace.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        AppState.cart
            .map(item => {

                const price =
                    Number(item.price) || 0;

                return `
                    <div class="cart-item">

                        <img
                            src="${escapeHTML(
                                item.mediaUrl ||
                                CONFIG.DEFAULT_IMG
                            )}"
                            alt="${escapeHTML(
                                item.productName
                            )}"
                        >

                        <div class="cart-item-info">

                            <strong>
                                ${escapeHTML(
                                    item.productName
                                )}
                            </strong>

                            <span>
                                ${formatCurrency(price)}
                            </span>

                            <div class="cart-item-actions">

                                <button
                                    type="button"
                                    class="cart-qty-btn"
                                    data-cart-action="decrease"
                                    data-product-id="${escapeHTML(
                                        item.id
                                    )}"
                                >
                                    −
                                </button>

                                <span>
                                    ${item.qty}
                                </span>

                                <button
                                    type="button"
                                    class="cart-qty-btn"
                                    data-cart-action="increase"
                                    data-product-id="${escapeHTML(
                                        item.id
                                    )}"
                                >
                                    +
                                </button>

                                <button
                                    type="button"
                                    class="cart-remove-btn"
                                    data-cart-action="remove"
                                    data-product-id="${escapeHTML(
                                        item.id
                                    )}"
                                >
                                    Remove
                                </button>

                            </div>

                        </div>

                    </div>
                `;
            })
            .join("");

    container
        .querySelectorAll(
            "[data-cart-action]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    updateCartItem(
                        button.dataset.productId,
                        button.dataset.cartAction
                    );
                }
            );
        });
}


function updateCartItem(
    productId,
    action
) {

    const item =
        AppState.cart.find(
            cartItem =>
                String(cartItem.id) ===
                String(productId)
        );

    if (!item) {
        return;
    }

    if (action === "increase") {

        item.qty += 1;

    } else if (action === "decrease") {

        item.qty -= 1;

        if (item.qty <= 0) {

            AppState.cart =
                AppState.cart.filter(
                    cartItem =>
                        String(cartItem.id) !==
                        String(productId)
                );
        }

    } else if (action === "remove") {

        AppState.cart =
            AppState.cart.filter(
                cartItem =>
                    String(cartItem.id) !==
                    String(productId)
            );
    }

    AppState.saveCart(
        AppState.cart
    );

    updateCartUI();
}


/* =========================================================
   CHECKOUT
========================================================= */

function setupCheckout() {

    const closeButton =
        document.getElementById(
            "closeCheckoutBtn"
        );

    const form =
        document.getElementById(
            "checkoutForm"
        );

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeCheckout
        );
    }

    if (form) {

        form.addEventListener(
            "submit",
            submitCheckout
        );
    }
}


function openCheckout() {

    if (!AppState.cart.length) {

        showToast(
            "Your cart is empty.",
            "error"
        );

        return;
    }

    updateCartUI();

    const modal =
        document.getElementById(
            "checkoutModal"
        );

    if (modal) {

        modal.style.display =
            "flex";
    }

    toggleCart(false);
}


function closeCheckout() {

    const modal =
        document.getElementById(
            "checkoutModal"
        );

    if (modal) {

        modal.style.display =
            "none";
    }
}


async function submitCheckout(event) {

    event.preventDefault();

    if (!AppState.cart.length) {

        showToast(
            "Your cart is empty.",
            "error"
        );

        return;
    }

    const nameInput =
        document.getElementById(
            "customerName"
        );

    const emailInput =
        document.getElementById(
            "customerEmail"
        );

    const button =
        document.getElementById(
            "placeOrderBtn"
        );

    const customerName =
        nameInput?.value.trim();

    const email =
        emailInput?.value
            .trim()
            .toLowerCase();

    if (!customerName || !email) {

        showToast(
            "Please enter your name and email.",
            "error"
        );

        return;
    }

    const items =
        AppState.cart.map(item => ({
            id: item.id,
            price: Number(item.price) || 0,
            qty: Number(item.qty) || 1
        }));

    if (button) {

        button.disabled = true;

        button.textContent =
            "Processing...";
    }

    try {

        const result =
            await apiFetch(
                "/orders",
                {
                    method: "POST",
                    body: JSON.stringify({
                        customerName,
                        email,
                        items
                    })
                }
            );

        AppState.saveCart([]);

        updateCartUI();

        closeCheckout();

        event.target.reset();

        showToast(
            `Order ${result.orderId || ""} created successfully.`,
            "success"
        );

    } catch (error) {

        console.error(
            "Checkout error:",
            error
        );

        showToast(
            error.message ||
            "Could not create order.",
            "error"
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "Place order";
        }
    }
}


/* =========================================================
   PROFILE
========================================================= */

function setupProfile() {

    const profileButton =
        document.getElementById(
            "profileButton"
        );

    const editButton =
        document.getElementById(
            "editProfileBtn"
        );

    const logoutButton =
        document.getElementById(
            "logoutBtn"
        );

    const profileForm =
        document.getElementById(
            "profileForm"
        );

    const closeButton =
        document.getElementById(
            "closeProfileBtn"
        );

    if (profileButton) {

        profileButton.addEventListener(
            "click",
            toggleProfileDropdown
        );
    }

    if (editButton) {

        editButton.addEventListener(
            "click",
            openProfileModal
        );
    }

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            logout
        );
    }

    if (profileForm) {

        profileForm.addEventListener(
            "submit",
            saveProfile
        );
    }

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeProfileModal
        );
    }

    document.addEventListener(
        "click",
        event => {

            const menu =
                document.getElementById(
                    "profileMenu"
                );

            const dropdown =
                document.getElementById(
                    "profileDropdown"
                );

            if (
                menu &&
                dropdown &&
                !menu.contains(
                    event.target
                )
            ) {

                dropdown.classList.remove(
                    "open"
                );
            }
        }
    );
}


function toggleProfileDropdown() {

    const dropdown =
        document.getElementById(
            "profileDropdown"
        );

    if (dropdown) {

        dropdown.classList.toggle(
            "open"
        );
    }
}


function openProfileModal() {

    const modal =
        document.getElementById(
            "profileModal"
        );

    const business =
        document.getElementById(
            "profileBusinessName"
        );

    const email =
        document.getElementById(
            "profileEmail"
        );

    if (business) {

        business.value =
            AppState.user?.businessName ||
            "";
    }

    if (email) {

        email.value =
            AppState.user?.email ||
            "";
    }

    if (modal) {

        modal.style.display =
            "flex";
    }

    const dropdown =
        document.getElementById(
            "profileDropdown"
        );

    if (dropdown) {

        dropdown.classList.remove(
            "open"
        );
    }
}


function closeProfileModal() {

    const modal =
        document.getElementById(
            "profileModal"
        );

    if (modal) {

        modal.style.display =
            "none";
    }
}


function saveProfile(event) {

    event.preventDefault();

    if (!AppState.user) {
        return;
    }

    const business =
        document.getElementById(
            "profileBusinessName"
        );

    const businessName =
        business?.value.trim();

    if (!businessName) {

        showToast(
            "Business name is required.",
            "error"
        );

        return;
    }

    AppState.saveUser({
        ...AppState.user,
        businessName
    });

    updateUIProfile();

    closeProfileModal();

    showToast(
        "Business profile updated.",
        "success"
    );
}


function logout() {

    AppState.saveToken(null);

    AppState.saveUser(null);

    closeProfileModal();

    lockSite();

    showToast(
        "You have been signed out.",
        "success"
    );
}


function updateUIProfile() {

    const user =
        AppState.user;

    if (!user) {
        return;
    }

    const businessName =
        user.businessName ||
        "Your Business";

    const email =
        user.email ||
        "";

    const profileName =
        document.getElementById(
            "profileName"
        );

    const avatar =
        document.getElementById(
            "profileAvatar"
        );

    const dropdownBusiness =
        document.getElementById(
            "dropdownBusinessName"
        );

    const dropdownEmail =
        document.getElementById(
            "dropdownEmail"
        );

    if (profileName) {

        profileName.textContent =
            businessName;
    }

    if (avatar) {

        avatar.textContent =
            businessName
                .charAt(0)
                .toUpperCase();
    }

    if (dropdownBusiness) {

        dropdownBusiness.textContent =
            businessName;
    }

    if (dropdownEmail) {

        dropdownEmail.textContent =
            email;
    }
}


/* =========================================================
   DASHBOARD
========================================================= */

function setupDashboard() {

    /*
     * Dashboard navigation is already
     * handled by setupNavigation().
     */
}


async function fetchDashboardMetrics() {

    try {

        const data =
            await apiFetch(
                "/dashboard"
            );

        const orders =
            Array.isArray(
                data.transactions
            )
                ? data.transactions
                : [];

        updateDashboardStats(
            orders
        );

        renderOrders(
            orders
        );

        renderBusinessProducts();

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );
    }
}


function updateDashboardStats(
    orders
) {

    const revenue =
        orders.reduce(
            (sum, order) =>
                sum +
                Number(order.amount || 0),
            0
        );

    const customers =
        new Set(
            orders
                .map(order =>
                    String(
                        order.email ||
                        ""
                    ).toLowerCase()
                )
                .filter(Boolean)
        ).size;

    const revenueElement =
        document.getElementById(
            "dashboardRevenue"
        );

    const ordersElement =
        document.getElementById(
            "dashboardOrders"
        );

    const customersElement =
        document.getElementById(
            "dashboardCustomers"
        );

    if (revenueElement) {

        revenueElement.textContent =
            formatCurrency(revenue);
    }

    if (ordersElement) {

        ordersElement.textContent =
            String(orders.length);
    }

    if (customersElement) {

        customersElement.textContent =
            String(customers);
    }

    updateDashboardProductCount();
}


function updateDashboardProductCount() {

    const element =
        document.getElementById(
            "dashboardProducts"
        );

    if (!element) {
        return;
    }

    if (!AppState.user) {

        element.textContent =
            "0";

        return;
    }

    const businessName =
        AppState.user.businessName;

    const count =
        AppState.products.filter(
            product =>
                product.businessName ===
                businessName
        ).length;

    element.textContent =
        String(count);
}


function renderOrders(orders) {

    const container =
        document.getElementById(
            "ordersTableContainer"
        );

    if (!container) {
        return;
    }

    if (!orders.length) {

        container.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-icon">📋</div>
                <h3>No orders yet</h3>
                <p>
                    Orders will appear here when
                    customers purchase your products.
                </p>
            </div>
        `;

        return;
    }

    const rows =
        orders
            .slice(0, 10)
            .map(order => {

                return `
                    <div class="order-row">

                        <div>
                            <strong>
                                ${escapeHTML(
                                    order.customerName ||
                                    "Customer"
                                )}
                            </strong>

                            <small>
                                ${escapeHTML(
                                    order.email ||
                                    ""
                                )}
                            </small>
                        </div>

                        <strong>
                            ${formatCurrency(
                                Number(
                                    order.amount || 0
                                )
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                order.status ||
                                "Pending"
                            )}
                        </span>

                    </div>
                `;
            })
            .join("");

    container.innerHTML = rows;
}


function renderBusinessProducts() {

    const container =
        document.getElementById(
            "businessProductsList"
        );

    if (!container || !AppState.user) {
        return;
    }

    const businessName =
        AppState.user.businessName;

    const products =
        AppState.products.filter(
            product =>
                product.businessName ===
                businessName
        );

    if (!products.length) {

        container.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-icon">📦</div>
                <h3>No products</h3>
                <p>
                    Start by publishing your first product.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        products
            .map(product => {

                return `
                    <div class="business-product">

                        <div>

                            <strong>
                                ${escapeHTML(
                                    product.productName ||
                                    "Product"
                                )}
                            </strong>

                            <small>
                                ${escapeHTML(
                                    product.category ||
                                    "General"
                                )}
                            </small>

                        </div>

                        <strong>
                            ${formatCurrency(
                                Number(
                                    product.price || 0
                                )
                            )}
                        </strong>

                    </div>
                `;
            })
            .join("");
}


/* =========================================================
   UI HELPERS
========================================================= */

function updateUI() {

    updateUIProfile();

    updateCartUI();
}


function updateCurrentYear() {

    const year =
        document.getElementById(
            "currentYear"
        );

    if (year) {

        year.textContent =
            String(
                new Date().getFullYear()
            );
    }
}


function formatCurrency(
    amount
) {

    return `₦${Number(
        amount || 0
    ).toLocaleString(
        "en-NG",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )}`;
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "info"
) {

    const container =
        document.getElementById(
            "toastContainer"
        );

    if (!container) {

        alert(message);

        return;
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast toast-${type}`;

    toast.textContent =
        message;

    container.appendChild(
        toast
    );

    setTimeout(
        () => {

            toast.classList.add(
                "toast-hide"
            );

            setTimeout(
                () => toast.remove(),
                300
            );

        },
        3500
    );
}


/* =========================================================
   CLOSE MODALS WITH ESC
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (event.key !== "Escape") {
            return;
        }

        toggleCart(false);

        closeCheckout();

        closeProfileModal();

        closeMobileMenu();
    }
);