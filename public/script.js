const CONFIG = {
    API_URL: "/api",

    STORAGE_KEYS: {
        TOKEN: "bizspark_token",
        USER: "bizspark_user",
        CART: "bizspark_cart"
    },

    DEFAULT_IMG:
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",

    MAX_IMAGE_SIZE_MB: 4,
    MAX_IMAGE_WIDTH: 1600,
    IMAGE_QUALITY: 0.82
};

const AppState = {
    token: localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN) || null,

    user: (() => {
        try {
            return JSON.parse(
                localStorage.getItem(CONFIG.STORAGE_KEYS.USER)
            );
        } catch {
            return null;
        }
    })(),

    cart: (() => {
        try {
            const cart = JSON.parse(
                localStorage.getItem(CONFIG.STORAGE_KEYS.CART)
            );

            return Array.isArray(cart) ? cart : [];
        } catch {
            return [];
        }
    })(),

    products: [],
    orders: [],
    searchQuery: "",

    saveUser(user) {
        this.user = user;

        if (user) {
            localStorage.setItem(
                CONFIG.STORAGE_KEYS.USER,
                JSON.stringify(user)
            );
        } else {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
        }
    },

    saveToken(token) {
        this.token = token;

        if (token) {
            localStorage.setItem(
                CONFIG.STORAGE_KEYS.TOKEN,
                token
            );
        } else {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
        }
    },

    saveCart(cart) {
        this.cart = Array.isArray(cart) ? cart : [];

        localStorage.setItem(
            CONFIG.STORAGE_KEYS.CART,
            JSON.stringify(this.cart)
        );
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

    if (AppState.token && AppState.user) {
        unlockSite();
    } else {
        lockSite();
    }

    updateCartUI();
}


/* ============================================================
   API
============================================================ */

async function apiFetch(endpoint, options = {}) {
    const headers = new Headers(options.headers || {});

    headers.set("Accept", "application/json");

    if (AppState.token) {
        headers.set(
            "Authorization",
            `Bearer ${AppState.token}`
        );
    }

    /*
     * IMPORTANT:
     * Do NOT manually set Content-Type when sending FormData.
     * The browser must generate the multipart boundary.
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
    } catch (networkError) {
        throw new Error(
            "Unable to connect to the BizSpark server."
        );
    }

    const contentType =
        response.headers.get("content-type") || "";

    let data = {};

    if (contentType.includes("application/json")) {
        data = await response.json().catch(() => ({}));
    } else {
        const text = await response.text().catch(() => "");

        data = {
            error: text || "The server returned an invalid response."
        };
    }

    if (!response.ok) {
        throw new Error(
            data.details ||
            data.error ||
            `Server error (${response.status})`
        );
    }

    return data;
}


/* ============================================================
   AUTH
============================================================ */

function setupAuthListeners() {
    const authForm =
        document.getElementById("authForm") ||
        document.getElementById("loginForm");

    authForm?.addEventListener(
        "submit",
        handleAuth
    );

    const logoutBtn =
        document.getElementById("authBtn") ||
        document.getElementById("logoutBtn");

    logoutBtn?.addEventListener(
        "click",
        handleLogout
    );
}


function lockSite() {
    const appContent =
        document.getElementById("appContent");

    const authModal =
        document.getElementById("authModal") ||
        document.getElementById("loginModal");

    if (appContent) {
        appContent.style.display = "none";
    }

    if (authModal) {
        authModal.style.display = "flex";
    }
}


function unlockSite() {
    const appContent =
        document.getElementById("appContent");

    const authModal =
        document.getElementById("authModal") ||
        document.getElementById("loginModal");

    if (authModal) {
        authModal.style.display = "none";
    }

    if (appContent) {
        appContent.style.display = "block";
    }

    updateUIProfile();
    updateCartUI();

    fetchProducts();
}


async function handleAuth(e) {
    e.preventDefault();

    const emailInput =
        document.getElementById("authEmail") ||
        document.getElementById("email");

    const email =
        emailInput?.value.trim();

    if (!email) {
        showToast(
            "Please enter your email address.",
            "error"
        );
        return;
    }

    const bizName =
        email
            .split("@")[0]
            .replace(/[._-]/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase())
        + "'s Shop";

    AppState.saveToken(
        "local_" + crypto.randomUUID()
    );

    AppState.saveUser({
        email,
        businessName: bizName
    });

    showToast(
        `Welcome, ${bizName}!`,
        "success"
    );

    unlockSite();
}


function handleLogout() {
    AppState.saveToken(null);
    AppState.saveUser(null);

    showToast(
        "Signed out successfully.",
        "info"
    );

    lockSite();
}


/* ============================================================
   NAVIGATION
============================================================ */

function setupNavigation() {
    document
        .querySelectorAll(".nav-item, .nav-link")
        .forEach(link => {

            link.addEventListener("click", e => {
                e.preventDefault();

                document
                    .querySelectorAll(".nav-item, .nav-link")
                    .forEach(item => {
                        item.classList.remove("active");
                    });

                link.classList.add("active");

                const target =
                    link.dataset.target ||
                    link.dataset.tab ||
                    link.getAttribute("href")?.replace("#", "");

                if (target) {
                    switchSection(target);
                }
            });

        });
}


function switchSection(id) {
    document
        .querySelectorAll(
            ".page-section, .tab-content"
        )
        .forEach(section => {
            section.style.display = "none";
            section.classList.remove("active");
        });

    const target =
        document.getElementById(id);

    if (target) {
        target.style.display = "block";
        target.classList.add("active");
    }

    if (
        id === "dashboardSection" ||
        id === "dashboard"
    ) {
        fetchDashboardMetrics();
    }
}


/* ============================================================
   PRODUCTS
============================================================ */

async function fetchProducts() {
    const loading =
        document.getElementById("marketLoading");

    try {
        if (loading) {
            loading.style.display = "block";
        }

        const products =
            await apiFetch("/products");

        AppState.products =
            Array.isArray(products)
                ? products
                : [];

        renderGrids();

    } catch (error) {
        console.error(
            "Product fetch error:",
            error
        );

        showToast(
            `Could not load products: ${error.message}`,
            "error"
        );

    } finally {
        if (loading) {
            loading.style.display = "none";
        }
    }
}


function renderGrids() {
    const marketGrid =
        document.getElementById(
            "marketProductsGrid"
        );

    const ownerGrid =
        document.getElementById(
            "ownerProductsGrid"
        );

    const shopGrid =
        document.getElementById(
            "myShopProductsGrid"
        );

    const emptyMarket =
        document.getElementById(
            "emptyMarketText"
        );

    const emptyOwner =
        document.getElementById(
            "emptyOwnerText"
        );

    const emptyShop =
        document.getElementById(
            "emptyShopText"
        );

    if (marketGrid) {
        marketGrid.innerHTML = "";
    }

    if (ownerGrid) {
        ownerGrid.innerHTML = "";
    }

    if (shopGrid) {
        shopGrid.innerHTML = "";
    }

    const query =
        AppState.searchQuery
            .toLowerCase()
            .trim();

    const filtered =
        AppState.products.filter(product => {

            return (
                (product.productName || "")
                    .toLowerCase()
                    .includes(query) ||

                (product.businessName || "")
                    .toLowerCase()
                    .includes(query) ||

                (product.category || "")
                    .toLowerCase()
                    .includes(query)
            );
        });

    if (emptyMarket) {
        emptyMarket.style.display =
            filtered.length
                ? "none"
                : "block";
    }

    filtered.forEach(product => {

        if (marketGrid) {
            marketGrid.appendChild(
                createProductCard(
                    product,
                    false
                )
            );
        }

    });

    const myBusiness =
        (
            AppState.user?.businessName || ""
        ).toLowerCase();

    const myProducts =
        AppState.products.filter(product => {

            return (
                product.businessName || ""
            )
                .toLowerCase() === myBusiness;
        });

    if (emptyOwner) {
        emptyOwner.style.display =
            myProducts.length
                ? "none"
                : "block";
    }

    if (emptyShop) {
        emptyShop.style.display =
            myProducts.length
                ? "none"
                : "block";
    }

    myProducts.forEach(product => {

        if (ownerGrid) {
            ownerGrid.appendChild(
                createProductCard(
                    product,
                    true
                )
            );
        }

        if (shopGrid) {
            shopGrid.appendChild(
                createProductCard(
                    product,
                    true
                )
            );
        }

    });
}


function createProductCard(
    product,
    isOwner
) {
    const card =
        document.createElement("article");

    card.className = "product-card";

    const productId =
        String(product.id);

    const price =
        Number.parseFloat(
            product.price || 0
        );

    const image =
        product.mediaUrl ||
        CONFIG.DEFAULT_IMG;

    card.innerHTML = `
        <div class="card-top-content">

            <div class="media-container">

                <img
                    src="${escapeAttribute(image)}"
                    class="product-media"
                    alt="${escapeAttribute(
                        product.productName ||
                        "Product"
                    )}"
                    loading="lazy"
                    onerror="
                        this.onerror=null;
                        this.src='${CONFIG.DEFAULT_IMG}'
                    "
                >

                <span class="category-tag">
                    ${escapeHtml(
                        product.category ||
                        "General"
                    )}
                </span>

            </div>

            <div class="product-details">

                <h3 class="product-title">
                    ${escapeHtml(
                        product.productName ||
                        "Untitled Product"
                    )}
                </h3>

                <p class="product-desc">
                    ${escapeHtml(
                        product.description ||
                        ""
                    )}
                </p>

                <div class="vendor-row">

                    <span class="vendor-name">
                        <i class="fa-solid fa-store"></i>

                        ${escapeHtml(
                            product.businessName ||
                            "Merchant"
                        )}
                    </span>

                </div>

            </div>

        </div>

        <div class="card-bottom-row">

            <div class="product-price">
                $${price.toFixed(2)}
            </div>

            ${
                isOwner
                    ? `
                        <button
                            class="cart-add-btn danger-btn"
                            type="button"
                            data-action="delete"
                            data-id="${escapeAttribute(productId)}"
                            title="Delete product"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    `
                    : `
                        <button
                            class="cart-add-btn add-product-btn"
                            type="button"
                            data-action="cart"
                            data-id="${escapeAttribute(productId)}"
                        >
                            <i class="fa-solid fa-cart-shopping"></i>
                            <span>Add to Cart</span>
                        </button>
                    `
            }

        </div>
    `;

    const button =
        card.querySelector(
            "button[data-action]"
        );

    button?.addEventListener(
        "click",
        () => {

            if (
                button.dataset.action ===
                "delete"
            ) {
                deleteProduct(productId);
            } else {
                addToCart(productId);
            }

        }
    );

    return card;
}


/* ============================================================
   PRODUCT FORM
============================================================ */

function setupForms() {
    const productForm =
        document.getElementById(
            "productForm"
        );

    productForm?.addEventListener(
        "submit",
        publishProduct
    );
}


async function publishProduct(e) {
    e.preventDefault();

    const form =
        e.currentTarget;

    const submitBtn =
        form.querySelector(
            'button[type="submit"]'
        );

    const fileInput =
        document.getElementById(
            "productImage"
        );

    const productName =
        document
            .getElementById("productName")
            ?.value
            .trim();

    const priceValue =
        document
            .getElementById("productPrice")
            ?.value;

    const category =
        document
            .getElementById("productCategory")
            ?.value
            .trim();

    const description =
        document
            .getElementById("productDescription")
            ?.value
            .trim();

    const businessName =
        document
            .getElementById("formBusinessName")
            ?.value
            .trim() ||
        AppState.user?.businessName ||
        "Merchant";

    const errorBox =
        document.getElementById(
            "publishError"
        );

    if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
    }

    if (!productName) {
        showPublishError(
            "Product name is required."
        );
        return;
    }

    const price =
        Number(priceValue);

    if (
        !Number.isFinite(price) ||
        price < 0
    ) {
        showPublishError(
            "Please enter a valid price."
        );
        return;
    }

    if (
        !fileInput ||
        !fileInput.files ||
        !fileInput.files.length
    ) {
        showPublishError(
            "Please choose a product image."
        );
        return;
    }

    const originalFile =
        fileInput.files[0];

    if (
        !originalFile.type.startsWith(
            "image/"
        )
    ) {
        showPublishError(
            "Please select a valid image."
        );
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;

        submitBtn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Preparing image...
        `;
    }

    try {

        const compressedFile =
            await compressImage(
                originalFile
            );

        if (submitBtn) {
            submitBtn.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Publishing...
            `;
        }

        const formData =
            new FormData();

        formData.append(
            "businessName",
            businessName
        );

        formData.append(
            "productName",
            productName
        );

        formData.append(
            "price",
            price.toFixed(2)
        );

        formData.append(
            "category",
            category || "General"
        );

        formData.append(
            "description",
            description || ""
        );

        formData.append(
            "productImage",
            compressedFile,
            "product-image.jpg"
        );

        console.log(
            "Sending product to:",
            `${CONFIG.API_URL}/products`
        );

        const result =
            await apiFetch(
                "/products",
                {
                    method: "POST",
                    body: formData
                }
            );

        console.log(
            "Product response:",
            result
        );

        form.reset();

        const fileName =
            document.getElementById(
                "fileNameText"
            );

        if (fileName) {
            fileName.textContent =
                "Choose Image File";
        }

        updateUIProfile();

        await fetchProducts();

        showToast(
            result.message ||
            "Product published successfully!",
            "success"
        );

        switchSection(
            "marketSection"
        );

    } catch (error) {

        console.error(
            "PUBLISH PRODUCT ERROR:",
            error
        );

        showPublishError(
            error.message ||
            "Could not publish product."
        );

        showToast(
            error.message ||
            "Could not publish product.",
            "error"
        );

    } finally {

        if (submitBtn) {
            submitBtn.disabled = false;

            submitBtn.innerHTML = `
                <i class="fa-solid fa-cloud-arrow-up"></i>
                Publish Product
            `;
        }

    }
}


function showPublishError(message) {
    const errorBox =
        document.getElementById(
            "publishError"
        );

    if (errorBox) {
        errorBox.textContent = message;
        errorBox.style.display = "block";
    }

    showToast(
        message,
        "error"
    );
}


/* ============================================================
   IMAGE COMPRESSION
============================================================ */

function loadImage(file) {
    return new Promise(
        (resolve, reject) => {

            const url =
                URL.createObjectURL(file);

            const image =
                new Image();

            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };

            image.onerror = () => {
                URL.revokeObjectURL(url);

                reject(
                    new Error(
                        "The selected image could not be read."
                    )
                );
            };

            image.src = url;
        }
    );
}


async function compressImage(file) {
    if (
        !file.type.startsWith("image/")
    ) {
        throw new Error(
            "The selected file must be an image."
        );
    }

    /*
     * Use Image() rather than createImageBitmap().
     * This is more compatible with mobile browsers.
     */
    const image =
        await loadImage(file);

    let width =
        image.naturalWidth ||
        image.width;

    let height =
        image.naturalHeight ||
        image.height;

    if (!width || !height) {
        throw new Error(
            "Could not determine image dimensions."
        );
    }

    if (
        width >
        CONFIG.MAX_IMAGE_WIDTH
    ) {
        const scale =
            CONFIG.MAX_IMAGE_WIDTH /
            width;

        width =
            Math.round(width * scale);

        height =
            Math.round(height * scale);
    }

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width = width;
    canvas.height = height;

    const ctx =
        canvas.getContext("2d", {
            alpha: false
        });

    if (!ctx) {
        throw new Error(
            "Your browser could not process the image."
        );
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    ctx.drawImage(
        image,
        0,
        0,
        width,
        height
    );

    const blob =
        await new Promise(
            resolve => {

                canvas.toBlob(
                    resolve,
                    "image/jpeg",
                    CONFIG.IMAGE_QUALITY
                );

            }
        );

    if (!blob) {
        throw new Error(
            "Could not compress the image."
        );
    }

    const maxBytes =
        CONFIG.MAX_IMAGE_SIZE_MB *
        1024 *
        1024;

    if (blob.size > maxBytes) {
        throw new Error(
            "The image is still too large after compression. Please choose a smaller image."
        );
    }

    return new File(
        [blob],
        "product-image.jpg",
        {
            type: "image/jpeg",
            lastModified: Date.now()
        }
    );
}


function setupFileInput() {
    const input =
        document.getElementById(
            "productImage"
        );

    if (!input) return;

    input.addEventListener(
        "change",
        () => {

            const text =
                document.getElementById(
                    "fileNameText"
                );

            if (!text) return;

            if (
                input.files &&
                input.files.length
            ) {
                text.textContent =
                    input.files[0].name;
            } else {
                text.textContent =
                    "Choose Image File";
            }

        }
    );
}


/* ============================================================
   DELETE
============================================================ */

async function deleteProduct(id) {
    if (
        !confirm(
            "Are you sure you want to delete this product?"
        )
    ) {
        return;
    }

    try {

        await apiFetch(
            `/products/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        await fetchProducts();

        showToast(
            "Product deleted successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Delete error:",
            error
        );

        showToast(
            `Could not delete product: ${error.message}`,
            "error"
        );
    }
}


/* ============================================================
   CART
============================================================ */

function setupCartListeners() {
    const cartToggle =
        document.getElementById(
            "cartToggleBtn"
        );

    const closeCart =
        document.getElementById(
            "closeCartBtn"
        );

    const overlay =
        document.getElementById(
            "cartOverlay"
        );

    cartToggle?.addEventListener(
        "click",
        () => toggleCartDrawer(true)
    );

    closeCart?.addEventListener(
        "click",
        () => toggleCartDrawer(false)
    );

    overlay?.addEventListener(
        "click",
        () => toggleCartDrawer(false)
    );

    document.addEventListener(
        "keydown",
        e => {

            if (e.key === "Escape") {
                toggleCartDrawer(false);
                closeCheckoutModal();
            }

        }
    );

    document.addEventListener(
        "click",
        e => {

            const removeButton =
                e.target.closest(
                    "[data-remove-cart]"
                );

            if (removeButton) {
                removeFromCart(
                    removeButton.dataset.removeCart
                );
            }

        }
    );
}


function addToCart(id) {
    const product =
        AppState.products.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!product) {
        showToast(
            "Product is no longer available.",
            "error"
        );
        return;
    }

    const existing =
        AppState.cart.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (existing) {
        existing.qty =
            Number(existing.qty || 0) + 1;
    } else {

        AppState.cart.push({
            id: product.id,
            productName:
                product.productName,
            price:
                Number(product.price || 0),
            qty: 1
        });

    }

    AppState.saveCart(
        AppState.cart
    );

    updateCartUI();

    toggleCartDrawer(true);

    showToast(
        `${product.productName} added to cart.`,
        "success"
    );
}


function removeFromCart(id) {
    AppState.saveCart(
        AppState.cart.filter(
            item =>
                String(item.id) !==
                String(id)
        )
    );

    updateCartUI();

    showToast(
        "Item removed from cart.",
        "info"
    );
}


function changeCartQuantity(
    id,
    change
) {
    const item =
        AppState.cart.find(
            cartItem =>
                String(cartItem.id) ===
                String(id)
        );

    if (!item) return;

    item.qty =
        Number(item.qty || 0) +
        Number(change);

    if (item.qty <= 0) {
        removeFromCart(id);
        return;
    }

    AppState.saveCart(
        AppState.cart
    );

    updateCartUI();
}


function updateCartUI() {
    const badge =
        document.getElementById(
            "cartCountBadge"
        );

    const subtotalEl =
        document.getElementById(
            "cartSubtotal"
        );

    const listEl =
        document.getElementById(
            "cartItemsList"
        );

    const totalItems =
        AppState.cart.reduce(
            (sum, item) =>
                sum +
                Number(item.qty || 0),
            0
        );

    const subtotal =
        AppState.cart.reduce(
            (sum, item) =>
                sum +
                Number(item.price || 0) *
                Number(item.qty || 0),
            0
        );

    if (badge) {
        badge.textContent =
            totalItems;
    }

    if (subtotalEl) {
        subtotalEl.textContent =
            `$${subtotal.toFixed(2)}`;
    }

    if (!listEl) return;

    if (!AppState.cart.length) {

        listEl.innerHTML = `
            <div class="empty-cart-msg">
                Your cart is empty.
            </div>
        `;

        return;
    }

    listEl.innerHTML =
        AppState.cart
            .map(item => {

                const price =
                    Number(
                        item.price || 0
                    );

                const quantity =
                    Number(
                        item.qty || 0
                    );

                const itemTotal =
                    price * quantity;

                return `
                    <div class="cart-item">

                        <div class="cart-item-info">

                            <strong>
                                ${escapeHtml(
                                    item.productName ||
                                    "Product"
                                )}
                            </strong>

                            <span>
                                $${price.toFixed(2)}
                            </span>

                            <div
                                class="quantity-controls"
                            >

                                <button
                                    type="button"
                                    data-cart-minus="${escapeAttribute(item.id)}"
                                >
                                    −
                                </button>

                                <span>
                                    ${quantity}
                                </span>

                                <button
                                    type="button"
                                    data-cart-plus="${escapeAttribute(item.id)}"
                                >
                                    +
                                </button>

                            </div>

                        </div>

                        <div class="cart-item-right">

                            <strong>
                                $${itemTotal.toFixed(2)}
                            </strong>

                            <button
                                type="button"
                                class="remove-cart-btn"
                                data-remove-cart="${escapeAttribute(item.id)}"
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>

                        </div>

                    </div>
                `;

            })
            .join("");

    listEl
        .querySelectorAll(
            "[data-cart-minus]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {
                    changeCartQuantity(
                        button.dataset.cartMinus,
                        -1
                    );
                }
            );

        });

    listEl
        .querySelectorAll(
            "[data-cart-plus]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {
                    changeCartQuantity(
                        button.dataset.cartPlus,
                        1
                    );
                }
            );

        });
}


function toggleCartDrawer(force) {
    const drawer =
        document.getElementById(
            "cartDrawer"
        );

    const overlay =
        document.getElementById(
            "cartOverlay"
        );

    if (!drawer) return;

    const shouldOpen =
        typeof force === "boolean"
            ? force
            : !drawer.classList.contains(
                "open"
            );

    drawer.classList.toggle(
        "open",
        shouldOpen
    );

    if (overlay) {
        overlay.classList.toggle(
            "open",
            shouldOpen
        );

        overlay.setAttribute(
            "aria-hidden",
            shouldOpen
                ? "false"
                : "true"
        );
    }

    drawer.setAttribute(
        "aria-hidden",
        shouldOpen
            ? "false"
            : "true"
    );

    document.body.classList.toggle(
        "cart-open",
        shouldOpen
    );
}


/* ============================================================
   CHECKOUT
============================================================ */

function setupCheckout() {
    const checkoutBtn =
        document.getElementById(
            "checkoutBtn"
        );

    const checkoutForm =
        document.getElementById(
            "checkoutForm"
        );

    checkoutBtn?.addEventListener(
        "click",
        openCheckoutModal
    );

    checkoutForm?.addEventListener(
        "submit",
        submitCartOrder
    );
}


function openCheckoutModal() {
    if (!AppState.cart.length) {
        showToast(
            "Your cart is empty.",
            "error"
        );
        return;
    }

    const modal =
        document.getElementById(
            "checkoutModal"
        );

    const summary =
        document.getElementById(
            "checkoutSummary"
        );

    if (!modal) return;

    const subtotal =
        AppState.cart.reduce(
            (sum, item) =>
                sum +
                Number(item.price || 0) *
                Number(item.qty || 0),
            0
        );

    if (summary) {

        summary.innerHTML = `
            <div class="checkout-summary">

                ${AppState.cart
                    .map(item => `
                        <div class="checkout-line">

                            <span>
                                ${escapeHtml(
                                    item.productName
                                )}
                                × ${item.qty}
                            </span>

                            <strong>
                                $${(
                                    Number(item.price) *
                                    Number(item.qty)
                                ).toFixed(2)}
                            </strong>

                        </div>
                    `)
                    .join("")}

                <div class="checkout-total">

                    <span>
                        Total
                    </span>

                    <strong>
                        $${subtotal.toFixed(2)}
                    </strong>

                </div>

            </div>
        `;
    }

    const customerName =
        document.getElementById(
            "custName"
        );

    const customerEmail =
        document.getElementById(
            "custEmail"
        );

    if (
        customerEmail &&
        !customerEmail.value
    ) {
        customerEmail.value =
            AppState.user?.email || "";
    }

    modal.style.display = "flex";

    toggleCartDrawer(false);
}


function closeCheckoutModal() {
    const modal =
        document.getElementById(
            "checkoutModal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}


async function submitCartOrder(e) {
    e.preventDefault();

    if (!AppState.cart.length) {
        showToast(
            "Your cart is empty.",
            "error"
        );
        return;
    }

    const name =
        document
            .getElementById("custName")
            ?.value
            .trim();

    const email =
        document
            .getElementById("custEmail")
            ?.value
            .trim();

    if (!name || !email) {
        showToast(
            "Please complete your details.",
            "error"
        );
        return;
    }

    const button =
        e.currentTarget.querySelector(
            'button[type="submit"]'
        );

    if (button) {
        button.disabled = true;

        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Processing...
        `;
    }

    try {

        await apiFetch(
            "/orders",
            {
                method: "POST",
                body: JSON.stringify({
                    customerName: name,
                    email,
                    items: AppState.cart
                })
            }
        );

        AppState.saveCart([]);

        updateCartUI();

        e.currentTarget.reset();

        closeCheckoutModal();

        showToast(
            "Order placed successfully!",
            "success"
        );

    } catch (error) {

        console.error(
            "Checkout error:",
            error
        );

        showToast(
            `Checkout failed: ${error.message}`,
            "error"
        );

    } finally {

        if (button) {
            button.disabled = false;

            button.innerHTML = `
                <i class="fa-solid fa-check"></i>
                Place Order
            `;
        }

    }
}


/* ============================================================
   DASHBOARD
============================================================ */

async function fetchDashboardMetrics() {
    try {

        const data =
            await apiFetch(
                "/dashboard"
            );

        const transactions =
            Array.isArray(
                data.transactions
            )
                ? data.transactions
                : [];

        const total =
            transactions.reduce(
                (sum, order) =>
                    sum +
                    Number(
                        order.amount || 0
                    ),
                0
            );

        const revenue =
            document.getElementById(
                "totalRevenue"
            );

        const orderNumber =
            document.getElementById(
                "orderNum"
            );

        if (revenue) {
            revenue.textContent =
                `$${total.toFixed(2)}`;
        }

        if (orderNumber) {
            orderNumber.textContent =
                transactions.length;
        }

        const tbody =
            document.getElementById(
                "transactionsTableBody"
            );

        if (!tbody) return;

        if (!transactions.length) {

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="4"
                        class="table-empty"
                    >
                        No transactions yet.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML =
            transactions
                .map(transaction => `
                    <tr>

                        <td>
                            ${escapeHtml(
                                transaction.customerName ||
                                "Customer"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                transaction.email ||
                                ""
                            )}
                        </td>

                        <td>
                            ${
                                transaction.date
                                    ? new Date(
                                        transaction.date
                                    ).toLocaleDateString()
                                    : "-"
                            }
                        </td>

                        <td class="status-cell">
                            ${escapeHtml(
                                transaction.status ||
                                "Pending"
                            )}
                        </td>

                    </tr>
                `)
                .join("");

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        showToast(
            `Dashboard error: ${error.message}`,
            "error"
        );
    }
}


/* ============================================================
   SEARCH
============================================================ */

function setupSearch() {
    const searchInput =
        document.getElementById(
            "searchInput"
        );

    if (!searchInput) return;

    searchInput.addEventListener(
        "input",
        e => {

            AppState.searchQuery =
                e.target.value;

            renderGrids();

        }
    );
}


/* ============================================================
   PROFILE
============================================================ */

function updateUIProfile() {
    if (!AppState.user) return;

    const nameEl =
        document.getElementById(
            "displayBusinessName"
        ) ||
        document.getElementById(
            "userDisplay"
        );

    const emailEl =
        document.getElementById(
            "displayBusinessEmail"
        );

    const formBizEl =
        document.getElementById(
            "formBusinessName"
        );

    const name =
        AppState.user.businessName ||
        AppState.user.email ||
        "Business";

    if (nameEl) {
        nameEl.textContent = name;
    }

    if (emailEl) {
        emailEl.textContent =
            AppState.user.email || "";
    }

    if (formBizEl) {
        formBizEl.value =
            AppState.user.businessName ||
            "";
    }

    const avatar =
        document.getElementById(
            "businessLogo"
        );

    if (avatar) {
        avatar.textContent =
            name.charAt(0).toUpperCase();
    }
}


function editShopName() {
    const current =
        AppState.user?.businessName ||
        "";

    const newName =
        prompt(
            "Enter new shop name:",
            current
        );

    if (!newName?.trim()) return;

    AppState.user.businessName =
        newName.trim();

    AppState.saveUser(
        AppState.user
    );

    updateUIProfile();

    renderGrids();

    showToast(
        "Shop name updated.",
        "success"
    );
}


/* ============================================================
   TOAST
============================================================ */

function showToast(
    message,
    type = "info"
) {
    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast toast-${type}`;

    toast.textContent =
        message;

    document.body.appendChild(
        toast
    );

    requestAnimationFrame(() => {
        toast.classList.add(
            "show"
        );
    });

    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

        setTimeout(
            () => toast.remove(),
            250
        );

    }, 3200);
}


/* ============================================================
   SECURITY HELPERS
============================================================ */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {
    return escapeHtml(value);
}