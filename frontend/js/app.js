// ===== CONFIGURATION =====
const API_BASE_URL = 'http://localhost:8000/api';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_info';

// ===== UTILITY FUNCTIONS =====
function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function getUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
}

function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

function showSpinner(show = true) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.toggle('hidden', !show);
    }
}

function showToast(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}

function getAuthHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
}

async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            ...getAuthHeaders(),
            ...options.headers
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || error.message || `API Error: ${response.status}`);
    }

    return response.json();
}

// ===== USER AUTHENTICATION =====
async function login() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;

    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    showSpinner(true);
    try {
        const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        setToken(response.access_token);
        
        // Fetch user info
        const userInfo = await apiCall('/users/me');
        setUser(userInfo);

        showToast('Login successful!', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function register() {
    const fullName = document.getElementById('fullName')?.value;
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;

    if (!fullName || !email || !password || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    showSpinner(true);
    try {
        await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                full_name: fullName,
                email,
                password
            })
        });

        showToast('Registration successful! Redirecting to login...', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

// ===== USER STATE MANAGEMENT =====
function updateUserUI() {
    const user = getUser();
    const token = getToken();
    const userBtn = document.getElementById('userBtn');
    const userName = document.getElementById('userName');
    const loginLink = document.getElementById('loginLink');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminLink = document.getElementById('adminLink');

    if (!userBtn || !userName) return;

    if (token && user) {
        userName.textContent = user.full_name || user.email;
        loginLink.classList.add('hidden');
        logoutBtn.classList.remove('hidden');

        // Show admin panel for admin users
        if (user.role === 'admin' && adminLink) {
            adminLink.classList.remove('hidden');
        }
    } else {
        userName.textContent = 'Guest';
        loginLink.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        if (adminLink) adminLink.classList.add('hidden');
    }
}

function logout() {
    clearAuth();
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

// ===== DROPDOWN MENU =====
function setupDropdownMenu() {
    const userBtn = document.getElementById('userBtn');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!userBtn || !userDropdown) return;

    userBtn.addEventListener('click', () => {
        userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.add('hidden');
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

// ===== HOME PAGE - PRODUCTS =====
let currentPage = 1;
const itemsPerPage = 10;
let allProducts = [];
let filteredProducts = [];

async function loadProducts(page = 1) {
    showSpinner(true);
    try {
        const response = await apiCall(`/products/?page=${page}&limit=${itemsPerPage}`);
        allProducts = response.products || response;
        filteredProducts = [...allProducts];
        
        currentPage = page;
        renderProducts();
        updatePagination();
    } catch (error) {
        showToast('Failed to load products: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function loadCategories() {
    try {
        const categories = await apiCall('/categories/');
        const categorySelect = document.getElementById('categoryFilter');
        const productCategory = document.getElementById('productCategory');

        if (categorySelect) {
            const currentValue = categorySelect.value;
            categorySelect.innerHTML = '<option value="">All Categories</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                categorySelect.appendChild(option);
            });
            categorySelect.value = currentValue;
        }

        if (productCategory) {
            productCategory.innerHTML = '<option value="">Select Category</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                productCategory.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (filteredProducts.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-light);">No products found</p>';
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image_url || 'https://via.placeholder.com/220x200?text=Product'}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <p class="product-category">${product.category_name || 'Uncategorized'}</p>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-price">$${product.price.toFixed(2)}</p>
                <div class="product-actions">
                    <button class="product-btn" onclick="openProductModal(${product.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updatePagination() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');

    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = filteredProducts.length < itemsPerPage;
    if (pageInfo) pageInfo.textContent = `Page ${currentPage}`;
}

// ===== PRODUCT SEARCH & FILTER =====
async function searchProducts() {
    const query = document.getElementById('searchInput')?.value || '';
    
    showSpinner(true);
    try {
        if (query.trim()) {
            const results = await apiCall(`/products/search?q=${encodeURIComponent(query)}`);
            filteredProducts = Array.isArray(results) ? results : results.products || [];
        } else {
            filteredProducts = [...allProducts];
        }
        currentPage = 1;
        renderProducts();
        updatePagination();
    } catch (error) {
        showToast('Search failed: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function filterByCategory() {
    const categoryId = document.getElementById('categoryFilter')?.value;

    showSpinner(true);
    try {
        if (categoryId) {
            const results = await apiCall(`/products/category/${categoryId}`);
            filteredProducts = Array.isArray(results) ? results : results.products || [];
        } else {
            filteredProducts = [...allProducts];
        }
        currentPage = 1;
        renderProducts();
        updatePagination();
    } catch (error) {
        showToast('Filter failed: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

function filterByPrice() {
    const minPrice = parseFloat(document.getElementById('minPrice')?.value) || 0;
    const maxPrice = parseFloat(document.getElementById('maxPrice')?.value) || Infinity;

    filteredProducts = allProducts.filter(p => p.price >= minPrice && p.price <= maxPrice);
    currentPage = 1;
    renderProducts();
    updatePagination();
}

function sortProducts(sortBy) {
    switch(sortBy) {
        case 'price-low':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'popular':
            // Sort by stock descending as a proxy for popularity
            filteredProducts.sort((a, b) => b.stock - a.stock);
            break;
        case 'newest':
        default:
            filteredProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    currentPage = 1;
    renderProducts();
    updatePagination();
}

// ===== PRODUCT MODAL =====
let selectedProductId = null;

async function openProductModal(productId) {
    selectedProductId = productId;
    showSpinner(true);

    try {
        const product = await apiCall(`/products/${productId}`);
        
        document.getElementById('modalImage').src = product.image_url || 'https://via.placeholder.com/300x300';
        document.getElementById('modalTitle').textContent = product.name;
        document.getElementById('modalDescription').textContent = product.description;
        document.getElementById('modalCategory').textContent = product.category_name;
        document.getElementById('modalStock').textContent = `${product.stock} in stock`;
        document.getElementById('modalPrice').textContent = `$${product.price.toFixed(2)}`;
        document.getElementById('quantityInput').max = product.stock;

        const modal = document.getElementById('productModal');
        modal.classList.remove('hidden');
    } catch (error) {
        showToast('Failed to load product details: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.add('hidden');
    selectedProductId = null;
}

async function addToCartFromModal() {
    const user = getUser();
    if (!user) {
        showToast('Please log in to add items to cart', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 500);
        return;
    }

    const quantity = parseInt(document.getElementById('quantityInput')?.value) || 1;
    await addToCart(selectedProductId, quantity);
    closeProductModal();
}

// ===== CART MANAGEMENT =====
async function addToCart(productId, quantity = 1) {
    const user = getUser();
    if (!user) {
        showToast('Please log in to add items to cart', 'error');
        return;
    }

    showSpinner(true);
    try {
        await apiCall('/cart/items', {
            method: 'POST',
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity
            })
        });

        showToast('Added to cart!', 'success');
        await updateCartCount();
    } catch (error) {
        showToast('Failed to add to cart: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function updateCartCount() {
    const user = getUser();
    if (!user) return;

    try {
        const cart = await apiCall('/cart/');
        const count = cart.items?.length || 0;
        const cartCount = document.getElementById('cartCount');
        if (cartCount) {
            cartCount.textContent = count;
        }
    } catch (error) {
        console.error('Failed to update cart count:', error);
    }
}

async function loadCart() {
    const user = getUser();
    if (!user) {
        document.getElementById('emptyCartMessage').classList.remove('hidden');
        document.getElementById('cartItemsContainer').classList.add('hidden');
        return;
    }

    showSpinner(true);
    try {
        const cart = await apiCall('/cart/');
        const items = cart.items || [];

        if (items.length === 0) {
            document.getElementById('emptyCartMessage').classList.remove('hidden');
            document.getElementById('cartItemsContainer').classList.add('hidden');
            document.getElementById('cartStatus').textContent = 'Your cart is empty';
        } else {
            document.getElementById('emptyCartMessage').classList.add('hidden');
            document.getElementById('cartItemsContainer').classList.remove('hidden');
            document.getElementById('cartStatus').textContent = `${items.length} items in your cart`;
            renderCartItems(items);
            updateCartTotals(items);
        }
    } catch (error) {
        showToast('Failed to load cart: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

function renderCartItems(items) {
    const container = document.getElementById('cartItemsContainer');
    if (!container) return;

    container.innerHTML = '';
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <img src="${item.product_image || 'https://via.placeholder.com/80'}" alt="${item.product_name}" class="cart-item-image">
            <div class="cart-item-details">
                <p class="cart-item-name">${item.product_name}</p>
                <p class="cart-item-price">$${item.product_price.toFixed(2)}</p>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn" onclick="updateQuantity(${item.item_id}, ${item.quantity - 1})">-</button>
                <input type="number" value="${item.quantity}" class="quantity-input" readonly>
                <button class="quantity-btn" onclick="updateQuantity(${item.item_id}, ${item.quantity + 1})">+</button>
            </div>
            <div class="cart-item-subtotal">$${(item.product_price * item.quantity).toFixed(2)}</div>
            <button class="cart-item-remove" onclick="removeFromCart(${item.item_id})" title="Remove">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(itemEl);
    });
}

function updateCartTotals(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    document.getElementById('subtotalPrice').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('taxPrice').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('totalPrice').textContent = `$${total.toFixed(2)}`;
}

async function updateQuantity(itemId, newQuantity) {
    if (newQuantity <= 0) {
        await removeFromCart(itemId);
        return;
    }

    showSpinner(true);
    try {
        await apiCall(`/cart/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity: newQuantity })
        });
        await loadCart();
    } catch (error) {
        showToast('Failed to update cart: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function removeFromCart(itemId) {
    const confirmed = confirm('Remove this item from cart?');
    if (!confirmed) return;

    showSpinner(true);
    try {
        await apiCall(`/cart/items/${itemId}`, { method: 'DELETE' });
        showToast('Item removed from cart', 'success');
        await loadCart();
        await updateCartCount();
    } catch (error) {
        showToast('Failed to remove item: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function checkout() {
    const user = getUser();
    if (!user) {
        showToast('Please log in to checkout', 'error');
        return;
    }

    showSpinner(true);
    try {
        const order = await apiCall('/orders/', { method: 'POST', body: '{}' });
        showToast('Order created successfully!', 'success');
        
        // Clear cart
        await apiCall('/cart/clear', { method: 'DELETE' });
        await updateCartCount();

        setTimeout(() => {
            window.location.href = `order-details.html?id=${order.id}`;
        }, 1000);
    } catch (error) {
        showToast('Checkout failed: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

// ===== ORDERS =====
async function loadOrders() {
    const user = getUser();
    if (!user) {
        document.getElementById('emptyOrdersMessage').classList.remove('hidden');
        document.getElementById('ordersGrid').classList.add('hidden');
        return;
    }

    showSpinner(true);
    try {
        const orders = await apiCall('/orders/');
        const ordersList = Array.isArray(orders) ? orders : orders.orders || [];

        if (ordersList.length === 0) {
            document.getElementById('emptyOrdersMessage').classList.remove('hidden');
            document.getElementById('ordersGrid').classList.add('hidden');
        } else {
            document.getElementById('emptyOrdersMessage').classList.add('hidden');
            document.getElementById('ordersGrid').classList.remove('hidden');
            renderOrders(ordersList);
        }
    } catch (error) {
        showToast('Failed to load orders: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

function renderOrders(orders) {
    const grid = document.getElementById('ordersGrid');
    if (!grid) return;

    grid.innerHTML = '';
    orders.forEach(order => {
        const orderEl = document.createElement('div');
        orderEl.className = 'order-card';
        
        const statusClass = `status-${order.status.toLowerCase()}`;
        const orderDate = new Date(order.created_at).toLocaleDateString();
        
        orderEl.innerHTML = `
            <div class="order-card-header">
                <div class="order-card-id">Order #${order.id}</div>
                <div class="order-card-status ${statusClass}">${order.status}</div>
            </div>
            <div class="order-card-info">
                <div class="info-item">
                    <span class="info-label">Date</span>
                    <span class="info-value">${orderDate}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Total</span>
                    <span class="info-value">$${order.total.toFixed(2)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Items</span>
                    <span class="info-value">${order.items?.length || 0}</span>
                </div>
            </div>
            <div class="order-card-footer">
                <a href="order-details.html?id=${order.id}" class="btn btn-primary">
                    <i class="fas fa-eye"></i> View Details
                </a>
            </div>
        `;
        grid.appendChild(orderEl);
    });
}

async function loadOrderDetails() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');

    if (!orderId) {
        showToast('Order not found', 'error');
        return;
    }

    showSpinner(true);
    try {
        const order = await apiCall(`/orders/${orderId}`);
        
        document.getElementById('orderTitle').textContent = `Order #${order.id}`;
        document.getElementById('orderId').textContent = `#${order.id}`;
        document.getElementById('orderDate').textContent = new Date(order.created_at).toLocaleDateString();
        document.getElementById('orderStatus').textContent = order.status.toUpperCase();
        document.getElementById('orderStatus').className = `status-badge status-${order.status.toLowerCase()}`;
        
        // Render status timeline
        renderStatusTimeline(order.status);
        
        // Render order items
        renderOrderItems(order.items || []);
        
        // Update totals
        const subtotal = order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
        const tax = subtotal * 0.1;
        const total = subtotal + tax;
        
        document.getElementById('subtotalPrice').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('taxPrice').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('totalPrice').textContent = `$${total.toFixed(2)}`;
    } catch (error) {
        showToast('Failed to load order details: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

function renderStatusTimeline(currentStatus) {
    const statuses = ['pending', 'processing', 'shipped', 'delivered'];
    const timelineContainer = document.getElementById('statusTimeline');
    
    if (!timelineContainer) return;
    timelineContainer.innerHTML = '';

    statuses.forEach(status => {
        const statusIndex = statuses.indexOf(status);
        const currentIndex = statuses.indexOf(currentStatus.toLowerCase());
        
        let stepClass = 'status-step';
        if (statusIndex < currentIndex) stepClass += ' completed';
        if (statusIndex === currentIndex) stepClass += ' active';

        const stepEl = document.createElement('div');
        stepEl.className = stepClass;
        
        const icon = document.createElement('div');
        icon.className = 'status-step-icon';
        icon.innerHTML = statusIndex <= currentIndex ? '<i class="fas fa-check"></i>' : statusIndex + 1;
        
        const info = document.createElement('div');
        info.className = 'status-step-info';
        info.innerHTML = `
            <div class="status-step-title">${status.charAt(0).toUpperCase() + status.slice(1)}</div>
            <div class="status-step-date">${statusIndex <= currentIndex ? 'Completed' : 'Pending'}</div>
        `;
        
        stepEl.appendChild(icon);
        stepEl.appendChild(info);
        timelineContainer.appendChild(stepEl);
    });
}

function renderOrderItems(items) {
    const container = document.getElementById('orderItemsContainer');
    if (!container) return;

    container.innerHTML = '';
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'order-item';
        itemEl.innerHTML = `
            <img src="${item.image || 'https://via.placeholder.com/80'}" alt="${item.name}" class="order-item-image">
            <div class="order-item-details">
                <div class="order-item-name">${item.name}</div>
                <div class="order-item-meta">Quantity: ${item.quantity} × $${item.price.toFixed(2)}</div>
            </div>
            <div class="order-item-total">
                <span class="label">Subtotal</span>
                <span class="value">$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        `;
        container.appendChild(itemEl);
    });
}

// ===== ADMIN DASHBOARD =====
async function initAdmin() {
    const user = getUser();
    if (!user || user.role !== 'admin') {
        showToast('Access denied. Admin only.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        return;
    }

    setupAdminTabs();
    setupAdminModals();
    await loadAdminData();
}

function setupAdminTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabs = document.querySelectorAll('.admin-tab');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            // Update button states
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update tab visibility
            tabs.forEach(tab => {
                if (tab.id === `${tabName}Tab`) {
                    tab.classList.remove('hidden');
                } else {
                    tab.classList.add('hidden');
                }
            });

            // Reload data for the tab
            if (tabName === 'products') loadAdminProducts();
            else if (tabName === 'categories') loadAdminCategories();
            else if (tabName === 'orders') loadAdminOrders();
        });
    });
}

function setupAdminModals() {
    // Product Modal
    const addProductBtn = document.getElementById('addProductBtn');
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');

    if (addProductBtn && productModal) {
        addProductBtn.addEventListener('click', () => {
            document.getElementById('productModalTitle').textContent = 'Add Product';
            productForm.reset();
            productForm.dataset.productId = '';
            productModal.classList.remove('hidden');
        });
    }

    // Category Modal
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const categoryModal = document.getElementById('categoryModal');
    const categoryForm = document.getElementById('categoryForm');

    if (addCategoryBtn && categoryModal) {
        addCategoryBtn.addEventListener('click', () => {
            document.getElementById('categoryModalTitle').textContent = 'Add Category';
            categoryForm.reset();
            categoryForm.dataset.categoryId = '';
            categoryModal.classList.remove('hidden');
        });
    }

    // Close modal buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.add('hidden');
        });
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.add('hidden');
        });
    });

    // Form submissions
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveProduct();
        });
    }

    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveCategory();
        });
    }
}

async function loadAdminData() {
    await loadAdminProducts();
    await loadCategories();
}

async function loadAdminProducts() {
    showSpinner(true);
    try {
        const response = await apiCall('/products/?limit=100');
        const products = Array.isArray(response) ? response : response.products || [];
        renderAdminProducts(products);
    } catch (error) {
        showToast('Failed to load products: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

function renderAdminProducts(products) {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.category_name}</td>
            <td>$${product.price.toFixed(2)}</td>
            <td>${product.stock}</td>
            <td>
                <div class="actions">
                    <button class="action-btn edit" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn delete" onclick="deleteProduct(${product.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function editProduct(productId) {
    showSpinner(true);
    try {
        const product = await apiCall(`/products/${productId}`);
        
        document.getElementById('productModalTitle').textContent = 'Edit Product';
        document.getElementById('productName').value = product.name;
        document.getElementById('productDescription').value = product.description;
        document.getElementById('productCategory').value = product.category_id;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productStock').value = product.stock;
        document.getElementById('productImage').value = product.image_url;

        const productForm = document.getElementById('productForm');
        productForm.dataset.productId = productId;
        document.getElementById('productModal').classList.remove('hidden');
    } catch (error) {
        showToast('Failed to load product: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function saveProduct() {
    const productId = document.getElementById('productForm').dataset.productId;
    const data = {
        name: document.getElementById('productName').value,
        description: document.getElementById('productDescription').value,
        category_id: parseInt(document.getElementById('productCategory').value),
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value),
        image_url: document.getElementById('productImage').value
    };

    showSpinner(true);
    try {
        if (productId) {
            await apiCall(`/products/${productId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showToast('Product updated successfully', 'success');
        } else {
            await apiCall('/products/', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showToast('Product created successfully', 'success');
        }

        document.getElementById('productModal').classList.add('hidden');
        await loadAdminProducts();
    } catch (error) {
        showToast('Failed to save product: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function deleteProduct(productId) {
    const confirmed = confirm('Are you sure you want to delete this product?');
    if (!confirmed) return;

    showSpinner(true);
    try {
        await apiCall(`/products/${productId}`, { method: 'DELETE' });
        showToast('Product deleted successfully', 'success');
        await loadAdminProducts();
    } catch (error) {
        showToast('Failed to delete product: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function loadAdminCategories() {
    showSpinner(true);
    try {
        const categories = await apiCall('/categories/');
        renderAdminCategories(categories);
    } catch (error) {
        showToast('Failed to load categories: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

function renderAdminCategories(categories) {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    categories.forEach(cat => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cat.name}</td>
            <td>
                <div class="actions">
                    <button class="action-btn edit" onclick="editCategory(${cat.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn delete" onclick="deleteCategory(${cat.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function editCategory(categoryId) {
    showSpinner(true);
    try {
        const categories = await apiCall('/categories/');
        const category = categories.find(c => c.id === categoryId);
        
        if (!category) throw new Error('Category not found');

        document.getElementById('categoryModalTitle').textContent = 'Edit Category';
        document.getElementById('categoryName').value = category.name;

        const categoryForm = document.getElementById('categoryForm');
        categoryForm.dataset.categoryId = categoryId;
        document.getElementById('categoryModal').classList.remove('hidden');
    } catch (error) {
        showToast('Failed to load category: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function saveCategory() {
    const categoryId = document.getElementById('categoryForm').dataset.categoryId;
    const data = { name: document.getElementById('categoryName').value };

    showSpinner(true);
    try {
        if (categoryId) {
            await apiCall(`/categories/${categoryId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showToast('Category updated successfully', 'success');
        } else {
            await apiCall('/categories/', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showToast('Category created successfully', 'success');
        }

        document.getElementById('categoryModal').classList.add('hidden');
        await loadAdminCategories();
        await loadCategories();
    } catch (error) {
        showToast('Failed to save category: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function deleteCategory(categoryId) {
    const confirmed = confirm('Are you sure you want to delete this category?');
    if (!confirmed) return;

    showSpinner(true);
    try {
        await apiCall(`/categories/${categoryId}`, { method: 'DELETE' });
        showToast('Category deleted successfully', 'success');
        await loadAdminCategories();
        await loadCategories();
    } catch (error) {
        showToast('Failed to delete category: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

async function loadAdminOrders() {
    showSpinner(true);
    try {
        const orders = await apiCall('/admin/orders/');
        renderAdminOrders(orders);
    } catch (error) {
        showToast('Failed to load orders: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

function renderAdminOrders(orders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${order.id}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>$${order.total.toFixed(2)}</td>
            <td>
                <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
            </td>
            <td>
                <div class="actions">
                    <button class="action-btn edit" onclick="updateOrderStatus(${order.id})">
                        <i class="fas fa-exchange-alt"></i> Change Status
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateOrderStatus(orderId) {
    const modal = document.getElementById('orderStatusModal');
    const form = document.getElementById('orderStatusForm');
    form.dataset.orderId = orderId;
    modal.classList.remove('hidden');

    form.onsubmit = async (e) => {
        e.preventDefault();
        await saveOrderStatus(orderId);
    };
}

async function saveOrderStatus(orderId) {
    const status = document.getElementById('orderStatusSelect').value;

    showSpinner(true);
    try {
        await apiCall(`/admin/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        showToast('Order status updated successfully', 'success');
        document.getElementById('orderStatusModal').classList.add('hidden');
        await loadAdminOrders();
    } catch (error) {
        showToast('Failed to update status: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

// ===== EVENT LISTENERS INITIALIZATION =====
function initializeEventListeners() {
    // Home page search
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    if (searchBtn) searchBtn.addEventListener('click', searchProducts);
    if (searchInput) searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchProducts();
    });

    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) categoryFilter.addEventListener('change', filterByCategory);

    // Price filter
    const applyPriceBtn = document.getElementById('applyPriceBtn');
    if (applyPriceBtn) applyPriceBtn.addEventListener('click', filterByPrice);

    // Sort
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.addEventListener('change', (e) => sortProducts(e.target.value));

    // Pagination
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => loadProducts(currentPage - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => loadProducts(currentPage + 1));

    // Product modal
    const modalClose = document.querySelector('.modal-close');
    if (modalClose) modalClose.addEventListener('click', closeProductModal);

    const addToCartBtn = document.getElementById('addToCartBtn');
    if (addToCartBtn) addToCartBtn.addEventListener('click', addToCartFromModal);

    // Cart
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            window.location.href = 'cart.html';
        });
    }

    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);

    // Dropdown menu
    setupDropdownMenu();
}

// ===== APP INITIALIZATION =====
window.app = {
    login,
    register,
    logout,
    loadProducts,
    addToCart,
    loadCart,
    loadOrders,
    loadOrderDetails,
    initAdmin
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateUserUI();
    initializeEventListeners();

    // Route-specific initialization
    if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
        loadProducts();
        loadCategories();
    }

    updateCartCount();
});

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    const modal = e.target.closest('.modal');
    if (modal && e.target === modal) {
        modal.classList.add('hidden');
    }
});
