// ==========================================
// 1. PRODUCTS DATA
// ==========================================
let products = [
    {
        id: 1,
        name: "kdkd",
        category: "Electronics",
        seller: "obinna's Shop",
        description: "kfkfnvninriw ofiowiwronviowroinerijireoio ern oireuio hero iheriohierohio eruoer",
        price: 222,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80"
    },
    {
        id: 2,
        name: "shoe",
        category: "Fashion",
        seller: "joyceifeajuna982's Shop",
        description: "nbfbhidhchdci idh cchdc donvoi nvnvfnvfviofnvifnvnefvor vir vrwvjrijijefje ejevjrejvrej9r",
        price: 22,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80"
    }
];

let cart = [];
const PLACEHOLDER_IMAGE = "https://via.placeholder.com/300x200?text=No+Image+Available";

// Safe image path builder
function getValidImageSrc(imageInput) {
    if (!imageInput || typeof imageInput !== 'string' || imageInput.trim() === '') {
        return PLACEHOLDER_IMAGE;
    }
    const trimmed = imageInput.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        return trimmed;
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

// ==========================================
// 2. PRODUCT RENDERING (HOME PAGE)
// ==========================================
function renderProducts(items) {
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) return; // Safely exit if not on home page

    productGrid.innerHTML = '';

    if (!items || items.length === 0) {
        productGrid.innerHTML = '<p class="no-products">No products found.</p>';
        return;
    }

    items.forEach(product => {
        const productCard = document.createElement('div');
        productCard.classList.add('product-card');

        const imageSrc = getValidImageSrc(product.image);

        productCard.innerHTML = `
            <div class="product-image-container">
                <img 
                    src="${imageSrc}" 
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

// ==========================================
// 3. AUTHENTICATION & LOGIN FORM
// ==========================================
function initAuth() {
    const loginForm = document.getElementById('login-form') || document.querySelector('form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', function (e) {
        const emailInput = document.getElementById('email') || loginForm.querySelector('input[type="email"]');
        const passwordInput = document.getElementById('password') || loginForm.querySelector('input[type="password"]');

        if (!emailInput || !passwordInput) return; // Proceed with normal submission if not a sign-in form

        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            alert('Please enter both email and password.');
            return;
        }

        localStorage.setItem('bizspark_user', JSON.stringify({ email: email, isLoggedIn: true }));
        alert(`Welcome back, ${email}!`);
        window.location.href = '/';
    });
}

// ==========================================
// 4. SELL FORM HANDLER
// ==========================================
function initSellForm() {
    const sellForm = document.getElementById('sell-form');
    if (!sellForm) return;

    sellForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const name = document.getElementById('product-name')?.value || 'New Item';
        const price = document.getElementById('product-price')?.value || 0;
        const category = document.getElementById('product-category')?.value || 'General';
        const seller = document.getElementById('product-seller')?.value || 'My Shop';
        const description = document.getElementById('product-desc')?.value || '';

        const fileInput = document.getElementById('product-image-file');
        const urlInput = document.getElementById('product-image-url')?.value.trim();

        if (fileInput && fileInput.files && fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function (event) {
                addNewProduct({ name, price, category, seller, description, image: event.target.result });
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else if (urlInput && urlInput !== '') {
            addNewProduct({ name, price, category, seller, description, image: urlInput });
        } else {
            addNewProduct({ name, price, category, seller, description, image: PLACEHOLDER_IMAGE });
        }

        sellForm.reset();
    });
}

function addNewProduct(productData) {
    const newProduct = { id: Date.now(), ...productData };
    products.unshift(newProduct);
    renderProducts(products);
}

// ==========================================
// 5. SEARCH, FILTER & CART
// ==========================================
function initFilters() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');

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

    if (searchInput) searchInput.addEventListener('input', filterProducts);
    if (categoryFilter) categoryFilter.addEventListener('change', filterProducts);
}

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
    const cartCount = document.getElementById('cart-count');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');

    if (cartCount) {
        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalCount;
    }

    if (!cartItemsContainer || !cartTotal) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-cart"><p>Your cart is empty</p></div>';
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

// ==========================================
// 6. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        renderProducts(products);
        initAuth();
        initSellForm();
        initFilters();
    } catch (e) {
        console.error("Initialization error:", e);
    }
});