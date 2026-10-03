/* =========================================================
   CONFIG & UTILITIES
========================================================= */

const CONFIG = {
    DEFAULT_IMG: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=60"
};

/**
 * Escapes HTML characters to prevent XSS.
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Validates and formats image URLs without overriding custom sources upfront.
 */
function getValidImageSrc(src) {
    if (!src || typeof src !== 'string' || src.trim() === '') {
        return CONFIG.DEFAULT_IMG;
    }
    const trimmed = src.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        return trimmed;
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/* =========================================================
   UI RENDERING TEMPLATES
========================================================= */

/**
 * Renders product cards for the marketplace view.
 */
function renderProducts(products, containerElement) {
    if (!containerElement) return;

    if (!products || products.length === 0) {
        containerElement.innerHTML = `<div class="no-products">No products found.</div>`;
        return;
    }

    containerElement.innerHTML = products.map(product => {
        const image = getValidImageSrc(product.mediaUrl || product.image);
        const name = product.productName || product.name || "Product";
        const category = product.category || "General";
        const shop = product.shopName || product.shop || "Store";
        const description = product.description || "";
        const price = product.price ? `₦${Number(product.price).toLocaleString()}` : "₦0";

        return `
            <div class="product-card" data-id="${escapeHTML(product.id)}">
                <div class="media-container">
                    <img
                        class="product-media"
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(name)}"
                        onerror="this.onerror=null; this.src='${CONFIG.DEFAULT_IMG}';"
                        loading="lazy"
                    >
                </div>
                <div class="product-info">
                    <span class="product-category">${escapeHTML(category)}</span>
                    <h3 class="product-title">${escapeHTML(name)}</h3>
                    <p class="product-shop">${escapeHTML(shop)}</p>
                    <p class="product-description">${escapeHTML(description)}</p>
                    <div class="product-bottom">
                        <span class="product-price">${escapeHTML(price)}</span>
                        <button class="add-to-cart-btn" onclick="addToCart('${escapeHTML(product.id)}')">Add to cart</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Renders items in the shopping cart.
 */
function renderCart(cartItems, containerElement) {
    if (!containerElement) return;

    if (!cartItems || cartItems.length === 0) {
        containerElement.innerHTML = `<p class="empty-cart">Your cart is empty.</p>`;
        return;
    }

    containerElement.innerHTML = cartItems.map(item => {
        const image = getValidImageSrc(item.mediaUrl || item.image);
        const name = item.productName || item.name || "Product";
        const price = item.price ? `₦${Number(item.price).toLocaleString()}` : "₦0";

        return `
            <div class="cart-item" data-id="${escapeHTML(item.id)}">
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(name)}"
                    onerror="this.onerror=null; this.src='${CONFIG.DEFAULT_IMG}';"
                    class="cart-item-img"
                >
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${escapeHTML(name)}</h4>
                    <span class="cart-item-price">${escapeHTML(price)}</span>
                </div>
                <button class="remove-cart-btn" onclick="removeFromCart('${escapeHTML(item.id)}')">&times;</button>
            </div>
        `;
    }).join('');
}