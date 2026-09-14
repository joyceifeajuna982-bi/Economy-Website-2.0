// Automatically set backend URL depending on environment
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://127.0.0.1:5000' 
  : '';

// Global State
let cart = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavigation();
  initCart();
  initProductForm();
  loadProducts();
});

// --- AUTHENTICATION & LOGIN MODAL ---
function initAuth() {
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const userDisplay = document.getElementById('userDisplay');

  // Check stored user session in localStorage
  const savedUser = localStorage.getItem('bizspark_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    if (loginModal) loginModal.style.display = 'none';
    if (userDisplay) userDisplay.textContent = currentUser.email;
  } else {
    if (loginModal) loginModal.style.display = 'flex';
  }

  // Handle Login Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('email');
      if (emailInput && emailInput.value.trim() !== '') {
        currentUser = { email: emailInput.value.trim() };
        localStorage.setItem('bizspark_user', JSON.stringify(currentUser));
        
        if (loginModal) loginModal.style.display = 'none';
        if (userDisplay) userDisplay.textContent = currentUser.email;
      }
    });
  }
}

// --- NAVIGATION & TAB SWITCHING ---
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const tabContents = document.querySelectorAll('.tab-content');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.getAttribute('data-tab');

      if (targetTab) {
        // Toggle tab sections
        tabContents.forEach(section => {
          section.style.display = section.id === targetTab ? 'block' : 'none';
        });

        // Update active class on nav links
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });
}

// --- SHOPPING CART SYSTEM ---
function initCart() {
  const cartBtn = document.getElementById('cartBtn');
  const cartModal = document.getElementById('cartModal');
  const closeCartBtn = document.querySelector('.close-cart');

  if (cartBtn && cartModal) {
    cartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = cartModal.style.display === 'block';
      cartModal.style.display = isVisible ? 'none' : 'block';
    });
  }

  if (closeCartBtn && cartModal) {
    closeCartBtn.addEventListener('click', () => {
      cartModal.style.display = 'none';
    });
  }

  // Close cart when clicking outside
  document.addEventListener('click', (e) => {
    if (cartModal && !cartModal.contains(e.target) && e.target !== cartBtn) {
      cartModal.style.display = 'none';
    }
  });
}

function addToCart(product) {
  cart.push(product);
  updateCartUI();
  
  // Auto-open cart modal on item add
  const cartModal = document.getElementById('cartModal');
  if (cartModal) cartModal.style.display = 'block';
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartUI();
}

function updateCartUI() {
  const cartCount = document.getElementById('cartCount');
  const cartItemsContainer = document.getElementById('cartItems');
  const cartSubtotal = document.getElementById('cartSubtotal');

  if (cartCount) cartCount.textContent = cart.length;

  if (cartItemsContainer) {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
    } else {
      cartItemsContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #232733;">
          <div>
            <div style="font-weight:600;">${item.productName}</div>
            <div style="font-size:0.85rem; color:#9ca3af;">$${parseFloat(item.price).toFixed(2)}</div>
          </div>
          <button onclick="removeFromCart(${index})" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer;">✕</button>
        </div>
      `).join('');
    }
  }

  if (cartSubtotal) {
    const total = cart.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
    cartSubtotal.textContent = `$${total.toFixed(2)}`;
  }
}

// --- PRODUCT FORM SUBMISSION ---
function initProductForm() {
  const productForm = document.getElementById('productForm');

  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(productForm);

      try {
        const response = await fetch(`${API_BASE_URL}/api/products`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Server status ${response.status}`);
        }

        await response.json();
        alert('Product published successfully!');
        productForm.reset();
        
        // Switch to marketplace tab and reload list
        const marketplaceTab = document.querySelector('[data-tab="marketplace"]');
        if (marketplaceTab) marketplaceTab.click();
        
        loadProducts();
      } catch (error) {
        console.error('Error publishing product:', error);
        alert('Error connecting to backend. Ensure python server is running.');
      }
    });
  }
}

// --- FETCH & RENDER PRODUCTS ---
async function loadProducts() {
  const container = document.getElementById('uploadedItems');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    
    const products = await response.json();
    
    if (container) {
      if (!products || products.length === 0) {
        container.innerHTML = "<p style='grid-column: 1/-1; color: #9ca3af;'>No products uploaded yet.</p>";
        return;
      }

      container.innerHTML = products.map(item => `
        <div class="product-card" style="background:#161922; border:1px solid #232733; padding:1rem; border-radius:10px; display:flex; flex-direction:column; justify-space-between;">
          <img src="${item.mediaUrl}" alt="${item.productName}" style="width:100%; height:180px; object-fit:cover; border-radius:6px; margin-bottom:12px;">
          <div style="flex-grow:1;">
            <span style="font-size:0.75rem; background:#232733; padding:2px 8px; border-radius:4px; color:#9ca3af;">${item.category || 'General'}</span>
            <h3 style="margin:8px 0 4px 0; font-size:1.1rem; color:#fff;">${item.productName}</h3>
            <p style="color:#9ca3af; font-size:0.85rem; margin-bottom:12px;">By ${item.businessName || 'Merchant'}</p>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <span style="font-size:1.2rem; font-weight:bold; color:#6366f1;">$${parseFloat(item.price).toFixed(2)}</span>
            <button onclick='addToCart(${JSON.stringify(item).replace(/'/g, "&apos;")})' class="btn-primary" style="padding:0.4rem 0.8rem; font-size:0.85rem;">Add to Cart</button>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading products:', error);
    if (container) {
      container.innerHTML = "<p style='grid-column: 1/-1; color: #ef4444;'>Unable to load products. Check server connection.</p>";
    }
  }
}