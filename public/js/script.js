const API = "";
const money = value => `₹${Number(value || 0).toFixed(2)}`;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch]));
async function api(url, options = {}) {
  const response = await fetch(API + url, { credentials: "same-origin", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function showMessage(element, message, error = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", error);
}
function getCart() { try { return JSON.parse(localStorage.getItem("dharmaCart") || "[]"); } catch { return []; } }
function saveCart(cart) { localStorage.setItem("dharmaCart", JSON.stringify(cart)); updateCartCount(); }
function updateCartCount() {
  const count = document.getElementById("cartCount");
  if (count) count.textContent = getCart().reduce((sum, item) => sum + item.quantity, 0);
}
async function currentUser() { const data = await api("/api/me"); return data.user; }

document.addEventListener("DOMContentLoaded", async () => {
  updateCartCount();

  const homeSearch = document.getElementById("homeSearch");
  if (homeSearch) homeSearch.addEventListener("submit", e => {
    e.preventDefault();
    location.href = `medicines.html?search=${encodeURIComponent(document.getElementById("homeSearchInput").value)}`;
  });

  const registerForm = document.getElementById("registerForm");
  if (registerForm) registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const message = document.getElementById("formMessage");
    try {
      const body = Object.fromEntries(new FormData(registerForm).entries());
      await api("/api/register", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      showMessage(message, "Registration successful. Redirecting to login…");
      setTimeout(() => location.href = "login.html", 1000);
    } catch (err) { showMessage(message, err.message, true); }
  });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const message = document.getElementById("formMessage");
    try {
      const body = Object.fromEntries(new FormData(loginForm).entries());
      const data = await api("/api/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      showMessage(message, "Login successful. Redirecting…");
      setTimeout(() => location.href = data.user.role === "admin" ? "admin.html" : "customer.html", 500);
    } catch (err) { showMessage(message, err.message, true); }
  });

  document.querySelectorAll("#logoutButton").forEach(button => button.addEventListener("click", async () => {
    try { await api("/api/logout", { method:"POST" }); } finally { location.href = "index.html"; }
  }));

  if (document.getElementById("medicineGrid")) {
    const params = new URLSearchParams(location.search);
    document.getElementById("medicineSearch").value = params.get("search") || "";
    document.getElementById("categoryFilter").value = params.get("category") || "";
    document.getElementById("searchMedicines").addEventListener("click", loadMedicines);
    document.getElementById("medicineSearch").addEventListener("keydown", e => { if (e.key === "Enter") loadMedicines(); });
    document.getElementById("categoryFilter").addEventListener("change", loadMedicines);
    await loadMedicines();
  }

  const medicineForm = document.getElementById("medicineForm");
  if (medicineForm) {
    await loadAdmin();
    medicineForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const data = Object.fromEntries(new FormData(medicineForm).entries());
        data.prescriptionrequired = medicineForm.elements.prescriptionrequired.checked;
        data.price = Number(data.price); data.quantity = Number(data.quantity);
        await api("/api/medicines", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) });
        medicineForm.reset();
        showMessage(document.getElementById("adminMessage"), "Medicine added successfully.");
        await loadAdmin();
      } catch (err) { showMessage(document.getElementById("adminMessage"), err.message, true); }
    });
    document.getElementById("refreshMedicines").addEventListener("click", loadAdmin);
  }

  if (document.getElementById("welcomeTitle")) {
    try {
      const user = await currentUser();
      if (!user) return location.href = "login.html";
      document.getElementById("welcomeTitle").textContent = `Welcome, ${user.name}`;
    } catch { location.href = "login.html"; }
  }

  const prescriptionForm = document.getElementById("prescriptionForm");
  if (prescriptionForm) prescriptionForm.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const result = await api("/api/prescriptions", { method:"POST", body:new FormData(prescriptionForm) });
      showMessage(document.getElementById("prescriptionMessage"), result.message);
      prescriptionForm.reset();
    } catch (err) { showMessage(document.getElementById("prescriptionMessage"), err.message, true); }
  });

  if (document.getElementById("cartItems")) renderCart();
  const placeOrder = document.getElementById("placeOrderButton");
  if (placeOrder) placeOrder.addEventListener("click", checkout);

  if (document.getElementById("ordersList")) loadOrders();
});

async function loadMedicines() {
  const grid = document.getElementById("medicineGrid");
  try {
    const search = document.getElementById("medicineSearch").value;
    const category = document.getElementById("categoryFilter").value;
    const products = await api(`/api/medicines?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`);
    grid.innerHTML = products.length ? products.map(p => `
      <article class="product-card">
        <img src="${escapeHtml(p.imageurl || "https://images.unsplash.com/photo-1585435557343-3b092031a831?w=600")}" alt="${escapeHtml(p.medicinename)}" onerror="this.src='https://images.unsplash.com/photo-1585435557343-3b092031a831?w=600'">
        <div class="product-card-body"><span class="tag">${escapeHtml(p.category)}</span><h3>${escapeHtml(p.medicinename)}</h3>
        <p>${escapeHtml(p.description)}</p><div class="product-meta"><span class="price">${money(p.price)}</span><span class="stock">${p.quantity} in stock</span></div>
        ${p.prescriptionrequired ? '<span class="tag">Prescription verification required</span>' : ''}
        <button class="btn add-cart" data-id="${p.medicineid}" ${p.quantity < 1 ? "disabled" : ""}>${p.quantity < 1 ? "Out of stock" : "Add to cart"}</button></div></article>`).join("") : "<p>No products found. Try another search.</p>";
    grid.querySelectorAll(".add-cart").forEach(button => button.addEventListener("click", () => {
      const p = products.find(item => item.medicineid === Number(button.dataset.id));
      const cart = getCart(); const existing = cart.find(item => item.medicineid === p.medicineid);
      if (existing) existing.quantity += 1; else cart.push({ medicineid:p.medicineid, name:p.medicinename, price:Number(p.price), quantity:1, stock:p.quantity, prescriptionrequired:!!p.prescriptionrequired });
      saveCart(cart); button.textContent = "Added ✓"; setTimeout(() => button.textContent = "Add to cart", 900);
    }));
  } catch (err) { grid.textContent = err.message; }
}

async function renderCart() {
  const cart = getCart(); const container = document.getElementById("cartItems");
  if (!cart.length) { container.innerHTML = "<p>Your cart is empty. <a href='medicines.html'>Browse products</a>.</p>"; document.getElementById("cartTotal").textContent = "Total: ₹0.00"; return; }
  container.innerHTML = cart.map(item => `<div class="cart-row"><div><b>${escapeHtml(item.name)}</b><div class="muted small">${money(item.price)} each ${item.prescriptionrequired ? "• Prescription required" : ""}</div></div><input type="number" min="1" max="${item.stock}" value="${item.quantity}" data-id="${item.medicineid}" class="cart-qty"><b>${money(item.price * item.quantity)}</b><button class="btn btn-small remove-cart" data-id="${item.medicineid}">Remove</button></div>`).join("");
  document.getElementById("cartTotal").textContent = `Total: ${money(cart.reduce((sum,item) => sum + item.price * item.quantity, 0))}`;
  container.querySelectorAll(".cart-qty").forEach(input => input.addEventListener("change", () => {
    const current = getCart(); const item = current.find(p => p.medicineid === Number(input.dataset.id));
    item.quantity = Math.max(1, Math.min(item.stock, Number(input.value) || 1)); saveCart(current); renderCart();
  }));
  container.querySelectorAll(".remove-cart").forEach(button => button.addEventListener("click", () => {
    saveCart(getCart().filter(p => p.medicineid !== Number(button.dataset.id))); renderCart();
  }));
}
async function checkout() {
  const message = document.getElementById("cartMessage");
  try {
    const cart = getCart();
    if (!cart.length) throw new Error("Your cart is empty.");
    const user = await currentUser();
    if (!user) { location.href = "login.html"; return; }
    const deliveryaddress = document.getElementById("deliveryAddress").value.trim();
    if (!deliveryaddress) throw new Error("Enter your delivery address.");
    const result = await api("/api/orders", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ items:cart.map(p => ({medicineid:p.medicineid,quantity:p.quantity})), deliveryaddress }) });
    saveCart([]); renderCart(); showMessage(message, `Order #${result.orderid} placed successfully. Total ${money(result.totalamount)}.`);
  } catch (err) { showMessage(message, err.message, true); }
}

async function loadAdmin() {
  try {
    const summary = await api("/api/admin/summary");
    document.getElementById("statCustomers").textContent = summary.customers;
    document.getElementById("statMedicines").textContent = summary.medicines;
    document.getElementById("statOrders").textContent = summary.orders;
    document.getElementById("statPending").textContent = summary.pendingOrders;
    const medicines = await api("/api/medicines");
    document.getElementById("adminMedicineList").innerHTML = `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Prescription</th><th>Action</th></tr></thead><tbody>${medicines.map(p => `<tr><td>${p.medicineid}</td><td>${escapeHtml(p.medicinename)}</td><td>${escapeHtml(p.category)}</td><td>${money(p.price)}</td><td>${p.quantity}</td><td>${p.prescriptionrequired ? "Yes" : "No"}</td><td><div class="table-actions"><button class="btn btn-small edit-medicine" data-id="${p.medicineid}">Edit</button><button class="btn btn-small delete-medicine" data-id="${p.medicineid}">Delete</button></div></td></tr>`).join("")}</tbody></table></div>`;
    document.querySelectorAll(".edit-medicine").forEach(button => button.addEventListener("click", async () => {
      const product = medicines.find(item => item.medicineid === Number(button.dataset.id));
      if (!product) return;
      const medicinename = prompt("Product name:", product.medicinename);
      if (medicinename === null) return;
      const category = prompt("Category:", product.category);
      if (category === null) return;
      const price = prompt("Price (₹):", product.price);
      if (price === null) return;
      const quantity = prompt("Available stock:", product.quantity);
      if (quantity === null) return;
      try {
        await api(`/api/medicines/${product.medicineid}`, {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...product,medicinename,category,price:Number(price),quantity:Number(quantity)})});
        await loadAdmin();
      } catch (err) { alert(err.message); }
    }));
    document.querySelectorAll(".delete-medicine").forEach(button => button.addEventListener("click", async () => {
      if (!confirm("Delete this medicine?")) return;
      try { await api(`/api/medicines/${button.dataset.id}`, {method:"DELETE"}); await loadAdmin(); }
      catch (err) { alert(err.message); }
    }));
    const orders = await api("/api/orders");
    document.getElementById("adminOrders").innerHTML = orders.length ? `<div class="table-wrap"><table><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Update</th></tr>${orders.map(o => `<tr><td>#${o.orderid}</td><td>${escapeHtml(o.customername)}</td><td>${money(o.totalamount)}</td><td>${escapeHtml(o.status)}</td><td><div class="table-actions"><select id="status-${o.orderid}">${["Pending","Processing","Shipped","Delivered","Cancelled"].map(s => `<option ${s===o.status?"selected":""}>${s}</option>`).join("")}</select><button class="btn btn-small update-order" data-id="${o.orderid}">Save</button></div></td></tr>`).join("")}</table></div>` : "<p>No orders yet.</p>";
    document.querySelectorAll(".update-order").forEach(button => button.addEventListener("click", async () => {
      try { await api(`/api/orders/${button.dataset.id}/status`, {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:document.getElementById(`status-${button.dataset.id}`).value})}); alert("Order status updated."); await loadAdmin(); }
      catch (err) { alert(err.message); }
    }));
    const prescriptions = await api("/api/prescriptions");
    document.getElementById("prescriptionList").innerHTML = prescriptions.length ? `<div class="table-wrap"><table><tr><th>Customer</th><th>File</th><th>Status</th><th>Action</th></tr>${prescriptions.map(p => `<tr><td>${escapeHtml(p.customername)}</td><td><a target="_blank" rel="noopener" href="${escapeHtml(p.prescriptionfile)}">View file</a></td><td>${escapeHtml(p.verificationstatus)}</td><td>${p.verificationstatus==="Pending" ? `<button class="btn btn-small verify-prescription" data-id="${p.prescriptionid}" data-status="Verified">Verify</button> <button class="btn btn-small btn-outline verify-prescription" data-id="${p.prescriptionid}" data-status="Rejected">Reject</button>` : "Reviewed"}</td></tr>`).join("")}</table></div>` : "<p>No prescriptions uploaded.</p>";
    document.querySelectorAll(".verify-prescription").forEach(button => button.addEventListener("click", async () => {
      try { await api(`/api/prescriptions/${button.dataset.id}`, {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:button.dataset.status})}); await loadAdmin(); }
      catch (err) { alert(err.message); }
    }));
  } catch (err) { document.getElementById("adminMessage").textContent = `${err.message} Please log in as admin.`; }
}

async function loadOrders() {
  const container = document.getElementById("ordersList");
  try {
    const user = await currentUser();
    if (!user) { location.href = "login.html"; return; }
    const orders = await api("/api/orders");
    if (!orders.length) { container.innerHTML = "<p>No orders yet. <a href='medicines.html'>Browse the catalogue</a>.</p>"; return; }
    container.innerHTML = `<div class="table-wrap"><table><tr><th>Order ID</th>${user.role==="admin"?"<th>Customer</th>":""}<th>Date</th><th>Total</th><th>Delivery address</th><th>Status</th><th>Items</th></tr>${orders.map(o => `<tr><td>#${o.orderid}</td>${user.role==="admin"?`<td>${escapeHtml(o.customername)}</td>`:""}<td>${escapeHtml(o.orderdate)}</td><td>${money(o.totalamount)}</td><td>${escapeHtml(o.deliveryaddress)}</td><td><span class="status">${escapeHtml(o.status)}</span></td><td><button class="btn btn-small order-items" data-id="${o.orderid}">View items</button></td></tr>`).join("")}</table></div><div id="orderItemDetails"></div>`;
    container.querySelectorAll(".order-items").forEach(button => button.addEventListener("click", async () => {
      try {
        const items = await api(`/api/orders/${button.dataset.id}/items`);
        document.getElementById("orderItemDetails").innerHTML = `<h3>Items in order #${button.dataset.id}</h3>${items.map(i => `<p>${escapeHtml(i.medicinename)} × ${i.quantity} — ${money(i.price)}</p>`).join("")}`;
      } catch (err) { alert(err.message); }
    }));
  } catch (err) { container.textContent = err.message; }
}
