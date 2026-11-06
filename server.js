require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { initializeDatabase, getPool } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    cb(allowed.includes(file.mimetype) ? null : new Error("Only PDF, JPG and PNG files are allowed."), allowed.includes(file.mimetype));
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 4 }
}));
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please log in first." });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") return res.status(403).json({ error: "Administrator access required." });
  next();
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", message: "Dharma Pharmacy API is running." }));

app.post("/api/register", async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: "Name, email and a password of at least 8 characters are required." });
    const hash = await bcrypt.hash(password, 12);
    const [result] = await getPool().query(
      "INSERT INTO users (name,email,phone,password,role) VALUES (?,?,?,?, 'customer')",
      [name.trim(), email.trim().toLowerCase(), phone || null, hash]
    );
    res.status(201).json({ message: "Registration successful. Please log in.", userid: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "An account with this email already exists." });
    next(err);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const [rows] = await getPool().query("SELECT userid,name,email,password,role FROM users WHERE email=?", [email]);
    if (!rows.length || !(await bcrypt.compare(req.body.password || "", rows[0].password))) return res.status(401).json({ error: "Invalid email or password." });
    req.session.user = { userid: rows[0].userid, name: rows[0].name, email: rows[0].email, role: rows[0].role };
    res.json({ message: "Login successful.", user: req.session.user });
  } catch (err) { next(err); }
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ message: "Logged out." })));
app.get("/api/me", (req, res) => res.json({ user: req.session.user || null }));

app.get("/api/medicines", async (req, res, next) => {
  try {
    const { search = "", category = "" } = req.query;
    const [rows] = await getPool().query(
      `SELECT medicineid,medicinename,category,description,price,quantity,expirydate,
       prescriptionrequired,imageurl FROM medicines
       WHERE medicinename LIKE ? AND category LIKE ? ORDER BY medicinename`,
      [`%${search}%`, category ? category : "%"]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

app.post("/api/medicines", requireAdmin, async (req, res, next) => {
  try {
    const { supplierid, medicinename, category, description, price, quantity, expirydate, prescriptionrequired, imageurl } = req.body;
    if (!medicinename || !category || Number(price) < 0 || Number(quantity) < 0) return res.status(400).json({ error: "Enter valid medicine details." });
    const [result] = await getPool().query(
      `INSERT INTO medicines (supplierid,medicinename,category,description,price,quantity,expirydate,prescriptionrequired,imageurl)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [supplierid || null, medicinename, category, description || "", price, quantity, expirydate || null, !!prescriptionrequired, imageurl || ""]
    );
    res.status(201).json({ message: "Medicine added.", medicineid: result.insertId });
  } catch (err) { next(err); }
});

app.put("/api/medicines/:id", requireAdmin, async (req, res, next) => {
  try {
    const { medicinename, category, description, price, quantity, expirydate, prescriptionrequired, imageurl } = req.body;
    const [result] = await getPool().query(
      `UPDATE medicines SET medicinename=?,category=?,description=?,price=?,quantity=?,expirydate=?,prescriptionrequired=?,imageurl=?
       WHERE medicineid=?`,
      [medicinename, category, description || "", price, quantity, expirydate || null, !!prescriptionrequired, imageurl || "", req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Medicine not found." });
    res.json({ message: "Medicine updated." });
  } catch (err) { next(err); }
});

app.delete("/api/medicines/:id", requireAdmin, async (req, res, next) => {
  try {
    await getPool().query("DELETE FROM medicines WHERE medicineid=?", [req.params.id]);
    res.json({ message: "Medicine deleted if it existed." });
  } catch (err) { next(err); }
});

app.get("/api/admin/summary", requireAdmin, async (_req, res, next) => {
  try {
    const db = getPool();
    const [[users]] = await db.query("SELECT COUNT(*) AS count FROM users WHERE role='customer'");
    const [[medicines]] = await db.query("SELECT COUNT(*) AS count FROM medicines");
    const [[orders]] = await db.query("SELECT COUNT(*) AS count FROM orders");
    const [[pending]] = await db.query("SELECT COUNT(*) AS count FROM orders WHERE status='Pending'");
    res.json({ customers: users.count, medicines: medicines.count, orders: orders.count, pendingOrders: pending.count });
  } catch (err) { next(err); }
});

app.get("/api/orders", requireLogin, async (req, res, next) => {
  try {
    const admin = req.session.user.role === "admin";
    const sql = `SELECT o.orderid,o.customerid,o.orderdate,o.totalamount,o.deliveryaddress,o.status,u.name AS customername
      FROM orders o JOIN users u ON u.userid=o.customerid ${admin ? "" : "WHERE o.customerid=?"}
      ORDER BY o.orderdate DESC`;
    const [rows] = await getPool().query(sql, admin ? [] : [req.session.user.userid]);
    res.json(rows);
  } catch (err) { next(err); }
});

app.get("/api/orders/:id/items", requireLogin, async (req, res, next) => {
  try {
    const [orders] = await getPool().query("SELECT customerid FROM orders WHERE orderid=?", [req.params.id]);
    if (!orders.length) return res.status(404).json({ error: "Order not found." });
    if (req.session.user.role !== "admin" && orders[0].customerid !== req.session.user.userid) return res.status(403).json({ error: "Not allowed." });
    const [items] = await getPool().query(
      `SELECT oi.quantity,oi.price,m.medicinename FROM order_items oi JOIN medicines m ON m.medicineid=oi.medicineid WHERE oi.orderid=?`,
      [req.params.id]
    );
    res.json(items);
  } catch (err) { next(err); }
});

app.post("/api/orders", requireLogin, async (req, res, next) => {
  const db = getPool();
  const connection = await db.getConnection();
  try {
    const { items, deliveryaddress, prescriptionIds = [] } = req.body;
    if (!Array.isArray(items) || !items.length || !deliveryaddress) return res.status(400).json({ error: "Cart items and delivery address are required." });
    await connection.beginTransaction();
    let total = 0;
    const checked = [];
    for (const item of items) {
      const [rows] = await connection.query("SELECT medicineid,medicinename,price,quantity,prescriptionrequired FROM medicines WHERE medicineid=? FOR UPDATE", [item.medicineid]);
      if (!rows.length) throw new Error("A selected medicine no longer exists.");
      const medicine = rows[0];
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || medicine.quantity < quantity) throw new Error(`Insufficient stock for ${medicine.medicinename}.`);
      if (medicine.prescriptionrequired) {
        const [verified] = await connection.query(
          `SELECT prescriptionid FROM prescriptions WHERE customerid=? AND verificationstatus='Verified' AND prescriptionid IN (?) LIMIT 1`,
          [req.session.user.userid, prescriptionIds.length ? prescriptionIds : [0]]
        );
        if (!verified.length) throw new Error(`A verified prescription is required for ${medicine.medicinename}. Upload it and wait for admin verification.`);
      }
      total += Number(medicine.price) * quantity;
      checked.push({ medicineid: medicine.medicineid, quantity, price: medicine.price });
    }
    const [orderResult] = await connection.query(
      "INSERT INTO orders (customerid,totalamount,deliveryaddress,status) VALUES (?,?,?,'Pending')",
      [req.session.user.userid, total.toFixed(2), deliveryaddress]
    );
    for (const item of checked) {
      await connection.query("INSERT INTO order_items (orderid,medicineid,quantity,price) VALUES (?,?,?,?)", [orderResult.insertId, item.medicineid, item.quantity, item.price]);
      await connection.query("UPDATE medicines SET quantity=quantity-? WHERE medicineid=?", [item.quantity, item.medicineid]);
    }
    await connection.commit();
    res.status(201).json({ message: "Order placed successfully.", orderid: orderResult.insertId, totalamount: total.toFixed(2) });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message || "Could not place order." });
  } finally { connection.release(); }
});

app.put("/api/orders/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const allowed = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid order status." });
    const [result] = await getPool().query("UPDATE orders SET status=? WHERE orderid=?", [req.body.status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Order not found." });
    res.json({ message: "Order status updated." });
  } catch (err) { next(err); }
});

app.post("/api/prescriptions", requireLogin, upload.single("prescription"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a PDF, JPG or PNG prescription." });
    const [result] = await getPool().query(
      "INSERT INTO prescriptions (customerid,orderid,prescriptionfile,verificationstatus) VALUES (?,?,?,'Pending')",
      [req.session.user.userid, req.body.orderid || null, `/uploads/${req.file.filename}`]
    );
    res.status(201).json({ message: "Prescription uploaded. It is pending admin verification.", prescriptionid: result.insertId });
  } catch (err) { next(err); }
});

app.get("/api/prescriptions", requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(
      `SELECT p.prescriptionid,p.customerid,p.orderid,p.prescriptionfile,p.verificationstatus,p.uploadeddate,u.name AS customername
       FROM prescriptions p JOIN users u ON u.userid=p.customerid ORDER BY p.uploadeddate DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

app.put("/api/prescriptions/:id", requireAdmin, async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!["Verified", "Rejected"].includes(status)) return res.status(400).json({ error: "Status must be Verified or Rejected." });
    const [result] = await getPool().query("UPDATE prescriptions SET verificationstatus=? WHERE prescriptionid=?", [status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Prescription not found." });
    res.json({ message: `Prescription ${status.toLowerCase()}.` });
  } catch (err) { next(err); }
});

app.get("/api/admin/users", requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await getPool().query("SELECT userid,name,email,phone,role,created_at FROM users ORDER BY userid DESC");
    res.json(rows);
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error." });
});

initializeDatabase()
  .then(() => app.listen(PORT, () => console.log(`Dharma Pharmacy running at http://localhost:${PORT}`)))
  .catch(err => { console.error("Database startup failed:", err.message); process.exit(1); });
