/* ======================================================
   1. CONFIGURACIÓN DE FIREBASE
====================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyDB8cTbr9J5WCxrl0hRiVMKYPgL92xF78A",
  authDomain: "whconfetteria.firebaseapp.com",
  projectId: "whconfetteria",
  storageBucket: "whconfetteria.firebasestorage.app",
  messagingSenderId: "181806092554",
  appId: "1:181806092554:web:1762e5114a93211fc2eaf3",
  measurementId: "G-6V2EL1PWCG"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ======================================================
   ESTADO GLOBAL
====================================================== */
let currentUser = null;
let currentCart = [];
let tempAvatarBase64 = "";
let tempEditAvatarBase64 = "";
let tempProductImgBase64 = "";

let products = [];
let todaySales = [];
let dailyClosures = [];

/* ======================================================
   CONTROL DE MODO CLARO / OSCURO
====================================================== */
function initTheme() {
    const savedTheme = localStorage.getItem('aromapos_theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeBtnUI(true);
    } else {
        document.body.classList.remove('dark-mode');
        updateThemeBtnUI(false);
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('aromapos_theme', isDark ? 'dark' : 'light');
    updateThemeBtnUI(isDark);
}

function updateThemeBtnUI(isDark) {
    const icon = document.getElementById('themeIcon');
    const text = document.getElementById('themeText');
    if (icon && text) {
        if (isDark) {
            icon.className = 'fa-solid fa-sun';
            text.textContent = 'Modo Claro';
        } else {
            icon.className = 'fa-solid fa-moon';
            text.textContent = 'Modo Oscuro';
        }
    }
}

// Inicializar el tema de inmediato
initTheme();

/* ======================================================
   CONTROL DE VISTAS / NAVEGACIÓN (CORREGIDO)
====================================================== */
function switchView(viewName) {
    // 1. Ocultar todas las vistas
    const views = document.querySelectorAll('.app-view');
    views.forEach(v => v.classList.remove('active'));

    // 2. Remover clase activa de todos los botones
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));

    // 3. Mostrar la vista seleccionada
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.add('active');
    }

    // 4. Activar el botón correspondiente
    const targetBtn = document.getElementById(`nav-${viewName}`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
}

/* ======================================================
   COMPRESIÓN DE FOTOS (EVITA ERRORES DE TAMAÑO)
====================================================== */
function compressImage(file, maxWidth, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function () {
            const canvas = document.createElement("canvas");
            const scale = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL("image/jpeg", 0.7));
        };
    };
}

/* ======================================================
   2. AUTENTICACIÓN EN LA NUBE (FIREBASE AUTH)
====================================================== */
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const userDoc = await db.collection("users").doc(user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : { name: user.email.split("@")[0], avatar: "" };

            currentUser = {
                uid: user.uid,
                email: user.email,
                name: userData.name || user.email.split("@")[0],
                avatar: userData.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
            };

            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'flex';

            document.getElementById('userNameDisplay').textContent = currentUser.name;
            document.getElementById('userAvatarImg').src = currentUser.avatar;
            document.getElementById('repBusinessName').textContent = currentUser.name;

            listenToRealtimeData(currentUser.uid);
            initSwipeGesture();
        } catch (err) {
            console.error("Error cargando perfil:", err);
        }
    } else {
        currentUser = null;
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('authScreen').style.display = 'flex';
    }
});

function switchAuthTab(tab) {
    if (tab === 'login') {
        document.getElementById('tabLoginBtn').classList.add('active');
        document.getElementById('tabRegisterBtn').classList.remove('active');
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    } else {
        document.getElementById('tabRegisterBtn').classList.add('active');
        document.getElementById('tabLoginBtn').classList.remove('active');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('loginForm').classList.add('hidden');
    }
}

function previewAvatar(e) {
    const file = e.target.files[0];
    if (file) {
        compressImage(file, 120, (compressed) => {
            tempAvatarBase64 = compressed;
            document.getElementById('avatarPreviewImg').src = tempAvatarBase64;
            document.getElementById('avatarPreviewContainer').style.display = 'block';
        });
    }
}

// Registro
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const avatar = tempAvatarBase64 || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        await db.collection("users").doc(uid).set({
            name: name,
            email: email,
            avatar: avatar,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Crear productos iniciales
        const defaultProds = [
            { name: "Café Espresso Doble", price: 3.50, category: "Bebidas", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=300&q=80" },
            { name: "Cappuccino Italiano", price: 4.75, category: "Bebidas", img: "https://images.unsplash.com/photo-1572442388796-11668ba67e53?auto=format&fit=crop&w=300&q=80" },
            { name: "Croissant Artesanal", price: 3.25, category: "Comidas", img: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=300&q=80" }
        ];

        for (let p of defaultProds) {
            await db.collection("users").doc(uid).collection("products").add(p);
        }

        alert("¡Cuenta registrada con éxito!");
    } catch (error) {
        alert("Error al registrarse: " + error.message);
    }
}

// Iniciar sesión
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert("Error de inicio de sesión: " + error.message);
    }
}

// Cerrar sesión
function handleLogout() {
    auth.signOut();
}

/* ======================================================
   3. MODIFICACIÓN DEL PERFIL (NUEVO)
====================================================== */
function openProfileModal() {
    if (!currentUser) return;
    document.getElementById('editProfileName').value = currentUser.name;
    document.getElementById('editAvatarPreviewImg').src = currentUser.avatar;
    tempEditAvatarBase64 = currentUser.avatar;
    document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
    document.getElementById('editProfileAvatarFile').value = '';
}

function previewEditAvatar(e) {
    const file = e.target.files[0];
    if (file) {
        compressImage(file, 150, (compressed) => {
            tempEditAvatarBase64 = compressed;
            document.getElementById('editAvatarPreviewImg').src = tempEditAvatarBase64;
        });
    }
}

async function handleSaveProfile(e) {
    e.preventDefault();
    const newName = document.getElementById('editProfileName').value.trim();
    if (!newName) return;

    try {
        const updateData = {
            name: newName,
            avatar: tempEditAvatarBase64 || currentUser.avatar
        };

        await db.collection("users").doc(currentUser.uid).update(updateData);

        // Actualizar estado local y vista
        currentUser.name = newName;
        currentUser.avatar = updateData.avatar;

        document.getElementById('userNameDisplay').textContent = newName;
        document.getElementById('userAvatarImg').src = updateData.avatar;
        document.getElementById('repBusinessName').textContent = newName;

        closeProfileModal();
        alert("¡Perfil actualizado con éxito!");
    } catch (err) {
        alert("Error al actualizar perfil: " + err.message);
    }
}

/* ======================================================
   4. SINCRONIZACIÓN EN TIEMPO REAL (FIRESTORE)
====================================================== */
function listenToRealtimeData(uid) {
    // 1. Productos
    db.collection("users").doc(uid).collection("products")
        .onSnapshot(snapshot => {
            products = [];
            snapshot.forEach(doc => {
                products.push({ id: doc.id, ...doc.data() });
            });
            renderPOSCatalog();
            renderInventoryTable();
        });

    // 2. Ventas del día actual
    db.collection("users").doc(uid).collection("today_sales")
        .orderBy("timestamp", "asc")
        .onSnapshot(snapshot => {
            todaySales = [];
            snapshot.forEach(doc => {
                todaySales.push({ id: doc.id, ...doc.data() });
            });
            updateLiveDayStatus();
        });

    // 3. Historial de Cierres Diarios
    db.collection("users").doc(uid).collection("daily_closures")
        .orderBy("timestamp", "desc")
        .onSnapshot(snapshot => {
            dailyClosures = [];
            snapshot.forEach(doc => {
                dailyClosures.push({ id: doc.id, ...doc.data() });
            });
            renderHistoryCardsAndTable();
        });
}

/* ======================================================
   5. CATÁLOGO Y VENTAS DEL DÍA
====================================================== */
function updateLiveDayStatus() {
    const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dateElem = document.getElementById('liveDateDisplay');
    if (dateElem) dateElem.textContent = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

    const totalAccumulated = todaySales.reduce((sum, s) => sum + s.total, 0);
    const countElem = document.getElementById('liveSalesCount');
    const revElem = document.getElementById('liveTotalRevenue');
    if (countElem) countElem.textContent = todaySales.length;
    if (revElem) revElem.textContent = `$${totalAccumulated.toFixed(2)}`;
}

function renderPOSCatalog(itemsToRender = products) {
    const grid = document.getElementById('posProductsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    itemsToRender.forEach(p => {
        const card = document.createElement('div');
        card.className = 'pos-product-card';
        card.onclick = () => addToCart(p.id);
        card.innerHTML = `
            <div class="prod-img-wrap">
                <img src="${p.img}" alt="${p.name}" loading="lazy">
            </div>
            <div class="prod-card-body">
                <div>
                    <span class="cat-tag">${p.category}</span>
                    <h4>${p.name}</h4>
                </div>
                <div class="prod-price-row">
                    <span>$${p.price.toFixed(2)}</span>
                    <button class="btn-add-cart" onclick="event.stopPropagation(); addToCart('${p.id}')">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterProducts() {
    const query = document.getElementById('searchProductInput').value.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query));
    renderPOSCatalog(filtered);
}

function filterCategory(cat, btn) {
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (cat === 'todos') {
        renderPOSCatalog(products);
    } else {
        renderPOSCatalog(products.filter(p => p.category === cat));
    }
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = currentCart.find(item => item.id === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        currentCart.push({ ...product, qty: 1 });
    }
    renderCart();
}

function changeCartQty(productId, delta) {
    const item = currentCart.find(i => i.id === productId);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        currentCart = currentCart.filter(i => i.id !== productId);
    }
    renderCart();
}

function clearCart() {
    currentCart = [];
    renderCart();
}

function renderCart() {
    const container = document.getElementById('ticketItemsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (currentCart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty-state">
                <i class="fa-solid fa-basket-shopping"></i>
                <p>Selecciona los productos para sumarlos al día</p>
            </div>
        `;
        document.getElementById('summaryTotal').textContent = "$0.00";
        return;
    }

    let total = 0;
    currentCart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        const row = document.createElement('div');
        row.className = 'ticket-item-row';
        row.innerHTML = `
            <div class="item-desc">
                <h5>${item.name}</h5>
                <span>$${item.price.toFixed(2)} c/u</span>
            </div>
            <div class="item-qty-controls">
                <button class="btn-qty" onclick="changeCartQty('${item.id}', -1)">-</button>
                <strong>${item.qty}</strong>
                <button class="btn-qty" onclick="changeCartQty('${item.id}', 1)">+</button>
            </div>
            <div style="font-weight:700;">$${itemTotal.toFixed(2)}</div>
        `;
        container.appendChild(row);
    });

    document.getElementById('summaryTotal').textContent = `$${total.toFixed(2)}`;
}

// Guardar venta individual acumulativa en Firestore
async function recordSingleSale() {
    if (currentCart.length === 0) {
        alert("Selecciona al menos un producto para registrar la venta.");
        return;
    }

    const payMethod = document.querySelector('input[name="payMethod"]:checked')?.value || "Efectivo";
    const total = currentCart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const saleEntry = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: currentCart.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        paymentMethod: payMethod,
        total: total,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("users").doc(currentUser.uid).collection("today_sales").add(saleEntry);
        clearCart();
    } catch (err) {
        alert("Error al guardar venta: " + err.message);
    }
}

/* ======================================================
   6. FINALIZAR DÍA Y GUARDAR CIERRE
====================================================== */
function openDailyClosurePrompt() {
    if (todaySales.length === 0) {
        alert("Aún no tienes ventas registradas en la jornada de hoy.");
        return;
    }

    const totalDay = todaySales.reduce((s, x) => s + x.total, 0);
    const confirmClose = confirm(
        `¿Deseas finalizar la jornada de hoy?\n\n` +
        `• Total Ventas: ${todaySales.length}\n` +
        `• TOTAL A FACTURAR: $${totalDay.toFixed(2)}\n\n` +
        `Se guardará en el historial deslizable y el contador de hoy se reiniciará.`
    );

    if (confirmClose) {
        finalizeDay();
    }
}

async function finalizeDay() {
    const totalDay = todaySales.reduce((s, x) => s + x.total, 0);
    let cash = 0, card = 0, transf = 0;
    let productsSold = {};

    todaySales.forEach(sale => {
        if (sale.paymentMethod === "Efectivo") cash += sale.total;
        if (sale.paymentMethod === "Tarjeta") card += sale.total;
        if (sale.paymentMethod === "Transferencia") transf += sale.total;

        sale.items.forEach(i => {
            productsSold[i.name] = (productsSold[i.name] || 0) + i.qty;
        });
    });

    const dayClosureRecord = {
        code: "CIERRE-" + String(dailyClosures.length + 1).padStart(3, '0'),
        date: new Date().toLocaleString(),
        closedBy: currentUser.name,
        totalSalesCount: todaySales.length,
        cashTotal: cash,
        cardTotal: card,
        transfTotal: transf,
        grandTotal: totalDay,
        productsBreakdown: productsSold,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("users").doc(currentUser.uid).collection("daily_closures").add(dayClosureRecord);

        // Limpiar ventas del día
        const batch = db.batch();
        const salesSnapshot = await db.collection("users").doc(currentUser.uid).collection("today_sales").get();
        salesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        showDailyReportModal(dayClosureRecord);
    } catch (err) {
        alert("Error al procesar cierre: " + err.message);
    }
}

/* ======================================================
   7. RENDERIZADO DE HISTORIAL DESLIZABLE
====================================================== */
function renderHistoryCardsAndTable() {
    const track = document.getElementById('historyCardsTrack');
    const tbody = document.getElementById('historyClosuresTableBody');
    if (!track || !tbody) return;

    track.innerHTML = '';
    tbody.innerHTML = '';

    if (dailyClosures.length === 0) {
        track.innerHTML = `<div style="padding:40px; color:var(--texto-suave);">No hay cierres registrados aún. Finaliza una jornada para ver las tarjetas.</div>`;
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--texto-suave);">Sin datos en el historial.</td></tr>`;
        return;
    }

    dailyClosures.forEach((c) => {
        const card = document.createElement('div');
        card.className = 'history-day-card';
        
        let topItemsHTML = '';
        const itemsEntries = Object.entries(c.productsBreakdown || {}).slice(0, 3);
        itemsEntries.forEach(([name, qty]) => {
            topItemsHTML += `<li>• ${qty}x ${name}</li>`;
        });

        card.innerHTML = `
            <div>
                <div class="card-date-badge">
                    <span class="day-chip">${c.code || "CIERRE"}</span>
                    <span><i class="fa-regular fa-clock"></i> ${c.date.split(',')[0]}</span>
                </div>

                <div class="card-grand-total">
                    <small>TOTAL FINAL DEL DÍA</small>
                    <h3>$${c.grandTotal.toFixed(2)}</h3>
                </div>

                <div class="card-breakdown">
                    <div class="card-breakdown-row"><span>Transacciones:</span><strong>${c.totalSalesCount} ventas</strong></div>
                    <div class="card-breakdown-row"><span>Efectivo:</span><strong>$${c.cashTotal.toFixed(2)}</strong></div>
                    <div class="card-breakdown-row"><span>Tarjeta/Transf:</span><strong>$${(c.cardTotal + c.transfTotal).toFixed(2)}</strong></div>
                    <div class="card-breakdown-row"><span>Cajero:</span><strong>${c.closedBy}</strong></div>
                </div>

                ${itemsEntries.length > 0 ? `
                <div class="card-top-products">
                    <p><i class="fa-solid fa-star gold-text"></i> Más Vendidos:</p>
                    <ul>${topItemsHTML}</ul>
                </div>` : ''}
            </div>

            <button class="btn-primary w-100" onclick='showDailyReportModal(${JSON.stringify(c)})'>
                <i class="fa-solid fa-receipt"></i> Ver Comprobante
            </button>
        `;
        track.appendChild(card);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.code || "CIERRE"}</strong></td>
            <td>${c.date}</td>
            <td>${c.closedBy}</td>
            <td><span class="badge-ticket">${c.totalSalesCount} ventas</span></td>
            <td>$${c.cashTotal.toFixed(2)}</td>
            <td>$${c.cardTotal.toFixed(2)}</td>
            <td>$${c.transfTotal.toFixed(2)}</td>
            <td style="font-weight:800; color:var(--cafe-caramelo);">$${c.grandTotal.toFixed(2)}</td>
            <td>
                <button class="btn-secondary" onclick='showDailyReportModal(${JSON.stringify(c)})'>
                    <i class="fa-solid fa-eye"></i> Factura
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function slideHistoryCarousel(direction) {
    const trackWrapper = document.querySelector('.history-slider-wrapper');
    if (trackWrapper) {
        trackWrapper.scrollBy({ left: direction * 340, behavior: 'smooth' });
    }
}

function initSwipeGesture() {
    const slider = document.querySelector('.history-slider-wrapper');
    if (!slider) return;

    let isDown = false, startX, scrollLeft;
    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => { isDown = false; });
    slider.addEventListener('mouseup', () => { isDown = false; });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        slider.scrollLeft = scrollLeft - (x - startX) * 1.5;
    });
}

/* ======================================================
   8. MODALES & PRODUCTOS
====================================================== */
function showDailyReportModal(record) {
    document.getElementById('repDate').textContent = `Fecha de Cierre: ${record.date}`;
    document.getElementById('repClosedBy').textContent = `Responsable: ${record.closedBy}`;
    document.getElementById('repSalesCount').textContent = record.totalSalesCount;
    document.getElementById('repCashTotal').textContent = `$${record.cashTotal.toFixed(2)}`;
    document.getElementById('repCardTotal').textContent = `$${record.cardTotal.toFixed(2)}`;
    document.getElementById('repTransfTotal').textContent = `$${record.transfTotal.toFixed(2)}`;
    document.getElementById('repGrandTotal').textContent = `$${record.grandTotal.toFixed(2)}`;

    const breakdownContainer = document.getElementById('repProductsBreakdown');
    breakdownContainer.innerHTML = '';
    for (const [prodName, qty] of Object.entries(record.productsBreakdown || {})) {
        const row = document.createElement('div');
        row.className = 'rcpt-row';
        row.innerHTML = `<span>${qty}x ${prodName}</span>`;
        breakdownContainer.appendChild(row);
    }

    document.getElementById('dailyReportModal').classList.add('active');
}

function closeDailyReportModal() {
    document.getElementById('dailyReportModal').classList.remove('active');
}

function openProductModal() {
    document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    tempProductImgBase64 = "";
    document.getElementById('productPreviewImg').src = "";
    document.getElementById('productImgPreviewBox').style.display = "none";
}

function previewProductImg(e) {
    const file = e.target.files[0];
    if (file) {
        compressImage(file, 300, (compressed) => {
            tempProductImgBase64 = compressed;
            document.getElementById('productPreviewImg').src = tempProductImgBase64;
            document.getElementById('productImgPreviewBox').style.display = "block";
        });
    }
}

async function handleSaveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('prodName').value.trim();
    const price = parseFloat(document.getElementById('prodPrice').value);
    const category = document.getElementById('prodCategory').value;
    const image = tempProductImgBase64 || "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=300&q=80";

    try {
        await db.collection("users").doc(currentUser.uid).collection("products").add({
            name, price, category, img: image
        });
        closeProductModal();
    } catch (err) {
        alert("Error al guardar producto: " + err.message);
    }
}

async function deleteProduct(id) {
    if (confirm("¿Eliminar este producto de la nube?")) {
        await db.collection("users").doc(currentUser.uid).collection("products").doc(id).delete();
    }
}

function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${p.img}" class="table-prod-img" alt="${p.name}"></td>
            <td><strong>${p.name}</strong></td>
            <td><span class="badge-ticket">${p.category}</span></td>
            <td>$${p.price.toFixed(2)}</td>
            <td>
                <button class="btn-secondary" onclick="deleteProduct('${p.id}')" style="color:var(--rojo-alerta);">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}