// Sample products data with distinct web image URLs
let products = [
    {
        id: 1,
        name: "kdkd",
        category: "Electronics",
        seller: "obinna's Shop",
        description: "kfkfnvninriw ofiowiwronviowroinerijireoio ern oireuio hero iheriohierohio eruoer",
        price: 222,
        // Any direct image URL will display here
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80" 
    },
    {
        id: 2,
        name: "shoe",
        category: "Electronics",
        seller: "joyceifeajuna982's Shop",
        description: "nbfbhidhchdci idh cchdc donvoi nvnvfnvfviofnvifnvnefvor vir vrwvjrijijefje ejevjrejvrej9r",
        price: 22,
        // Completely different image URL for the second item
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80" 
    }
];

let cart = [];

// DOM Elements
const productGrid = document.getElementById('product-grid');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const cartCount = document.getElementById('cart-count');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotal = document.getElementById('cart-total');

// Neutral placeholder ONLY used if the image link is broken or completely empty
const PLACEHOLDER_IMAGE = "https://via.placeholder.com/300x200?text=No+Image+Available";

// Helper to determine the image source dynamically for ANY product
function getDynamicImage(imageInput) {
    if (!imageInput || typeof imageInput !== 'string' || imageInput.trim() === '') {
        return PLACEHOLDER_IMAGE;
    }

    const trimmed = imageInput.trim();

    // 1. Direct Web URLs, Base64 uploads, or Blob preview URLs
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        return trimmed;
    }

    // 2. Relative paths
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

// Function to render products
function renderProducts(items) {
    if (!productGrid) return;
    
    productGrid.innerHTML = '';

    if (!items || items.length === 0) {
        productGrid.innerHTML = '<p class="no-products">No products found.</p>';
        return;
    }

    items.forEach(product => {
        const productCard = document.createElement('div');
        productCard.classList.add('product-card');

        // Extract the exact unique image for THIS specific product
        const finalImageSrc = getDynamicImage(product.image);

        productCard.innerHTML = `
            <div class="product-image-container">
                <img 
                    src="${finalImageSrc}" 
                    alt="${product.name || 'Product Image'}" 
                    class="product-image"
                    onerror="this.onerror=null; this.src='${PLACEHOLDER_IMAGE}';"
                />
            </div>
            <div class="product-details">
                <span class="product-category">${product.category || 'General'}</span>
                <h3 class="product-title">${product.name}</h3>
                <p class="product-seller">${product.seller || 'Verified Shop'}</p>
                <p class="product-desc">${product.description || ''}</p>
                <div class="product-footer">
                    <span class="product-price">₦${product.price}</span>
                    <button class="add-to-cart-btn" onclick="addToCart(${product.id})">Add to cart</button>
                </div>
            </div>
        `;

        productGrid.appendChild(productCard);
    });
}

// Search and Category Filtering
function filterProducts() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedCategory = categoryFilter ? categoryFilter.value : 'All categories';

    const filtered = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) || 
                              product.description.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory === 'All categories' || product.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    renderProducts(filtered);
}

// Shopping Cart Functions
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCartUI();
}

function updateCartUI() {
    if (cartCount) {
        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalCount;
    }

    if (!cartItemsContainer || !cartTotal) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <p>Your cart is empty</p>
                <small>Add products from the marketplace.</small>
            </div>
        `;
        cartTotal.textContent = '₦0.00';
        return;
    }

    cartItemsContainer.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        total += item.price * item.quantity;
        const itemElement = document.createElement('div');
        itemElement.classList.add('cart-item');
        itemElement.innerHTML = `
            <div>
                <h4>${item.name}</h4>
                <p>₦${item.price} x ${item.quantity}</p>
            </div>
            <button onclick="removeFromCart(${item.id})">✕</button>
        `;
        cartItemsContainer.appendChild(itemElement);
    });

    cartTotal.textContent = `₦${total.toFixed(2)}`;
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    renderProducts(products);

    if (searchInput) searchInput.addEventListener('input', filterProducts);
    if (categoryFilter) categoryFilter.addEventListener('change', filterProducts);
});