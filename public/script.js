// Automatically set backend URL depending on environment
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://127.0.0.1:5000' 
  : '';

// Global State
let cart = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initial Setup
  initAuth();
  initNavigation();
  initCart();
  initProductForm();
  loadProducts();
});

// --- AUTHENTICATION & LOGIN MODAL ---
function initAuth() {
  const loginModal = document.getElementById('loginModal') || document.querySelector('.auth-modal');
  const loginForm = document.getElementById('loginForm') || document.querySelector('.auth-modal form');
  const userDisplay = document.getElementById('userDisplay');

  // Check stored user session
  const savedUser = localStorage.getItem('bizspark_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    if (loginModal) loginModal.style.display = 'none';
    if (userDisplay) userDisplay.textContent = currentUser.email;
  } else {
    if (loginModal) loginModal.style.display = 'flex';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = loginForm.querySelector('input[type="email"]');
      if (emailInput && emailInput.value.trim() !== '') {
        currentUser = { email: emailInput.value.trim() };
        localStorage.setItem('bizspark_user', JSON.stringify(currentUser));
        if (loginModal) loginModal.style.display = 'none';
        if (userDisplay) userDisplay.textContent = currentUser.email;
      }
    });
  }
}

// --- NAVIGATION & TABS ---
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link, [data-tab]');
  const tabContents = document.querySelectorAll('.tab-content, .page-section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.getAttribute('data-tab') || link.getAttribute('href')?.replace('#', '');
      
      if (targetTab) {
        tabContents.forEach(section => {
          section.style.display = section.id === targetTab ? 'block' : 'none';
        });
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });
}

// --- SHOPPING CART SYSTEM ---
function initCart() {
  const cartBtn = document.getElementById('cartBtn') || document.querySelector('.cart-icon');
  const cartModal = document.getElementById('cartModal') || document.querySelector('.shopping-cart');
  const closeCartBtn = document.querySelector('.close-cart') || cartModal?.querySelector('span');

  if (cartBtn && cartModal) {
    cartBtn.addEventListener('click', () => {
      cartModal.style.display = cartModal.style.display === 'block' ? 'none' : 'block';
    });
  }

  if (closeCartBtn && cartModal) {
    closeCartBtn.addEventListener('click', () => {
      cartModal.style.display = 'none';
    });
  }
}

function addToCart(product) {
  cart.push(product);
  updateCartUI();
}

function updateCartUI() {
  const cartCount = document.getElementById('cartCount') || document.querySelector('.cart-count');
  const cartItemsContainer = document.getElementById('cartItems') || document.querySelector('.cart-items');
  const cartSubtotal = document.getElementById('cartSubtotal') || document.querySelector('.cart-subtotal');

  if (cartCount) cartCount.textContent = cart.length;

  if (cartItemsContainer) {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
    } else {
      cartItemsContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item" style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span>${item.productName}</span>
          <span>$${parseFloat(item.price).toFixed(2)}</span>
          <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer;">✕</button>
        </div>
      `).join('');
    }
  }

  if (cartSubtotal) {
    const total = cart.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
    cartSubtotal.textContent = `$${total.toFixed(2)}`;
  }
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartUI();
}

// --- PRODUCT PUBLISHING ---
function initProductForm() {
  const productForm = document.getElementById('productForm') || document.querySelector('form[action*="products"]');

  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(productForm);

      try {
        const response = await fetch(`${API_BASE_URL}/api/products`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        await response.json();
        alert('Product published successfully!');
        productForm.reset();
        loadProducts();
      } catch (error) {
        console.error('Error publishing product:', error);
        alert('Error connecting to backend. Ensure python api/index.py is running on port 5000.');
      }
    });
  }
}

// --- LOAD PRODUCTS FROM BACKEND ---
async function loadProducts() {
  const container = document.getElementById('uploadedItems') || document.querySelector('.uploaded-items');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    
    const products = await response.json();
    
    if (container) {
      if (products.length === 0) {
        container.innerHTML = "<p>You haven't uploaded any products yet.</p>";
        return;
      }

      container.innerHTML = products.map(item => `
        <div class="product-card" style="border: 1px solid #333; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
          <img src="${item.mediaUrl}" alt="${item.productName}" style="max-width:100px; height:auto; border-radius:6px; display:block; margin-bottom:8px;">
          <h4 style="margin: 4px 0;">${item.productName}</h4>
          <p style="margin: 4px 0;"><strong>Price:</strong> $${item.price}</p>
          <p style="margin: 4px 0;"><strong>Category:</strong> ${item.category}</p>
          <button onclick='addToCart(${JSON.stringify(item)})' style="margin-top:8px; padding: 6px 12px; cursor:pointer;">Add to Cart</button>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading products:', error);
  }
}