const mysql = require("mysql2/promise");
require("dotenv").config();

const config = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "Manmai",
  password: process.env.DB_PASSWORD || "Manmai@0912",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

async function initializeDatabase() {
  const connection = await mysql.createConnection(config);
  const databaseName = process.env.DB_NAME || "dharma_pharmacy";
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName.replace(/`/g, "")}\``);
  await connection.end();

  pool = mysql.createPool({ ...config, database: databaseName, dateStrings: true });
  await createTables();
  await seedData();
  return pool;
}

async function createTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      userid INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(120) NOT NULL UNIQUE,
      phone VARCHAR(20),
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'customer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS suppliers (
      supplierid INT AUTO_INCREMENT PRIMARY KEY,
      suppliername VARCHAR(120) NOT NULL,
      phone VARCHAR(20),
      email VARCHAR(120),
      address TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS medicines (
      medicineid INT AUTO_INCREMENT PRIMARY KEY,
      supplierid INT,
      medicinename VARCHAR(120) NOT NULL,
      category VARCHAR(80) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      quantity INT NOT NULL DEFAULT 0,
      expirydate DATE,
      prescriptionrequired BOOLEAN NOT NULL DEFAULT FALSE,
      imageurl VARCHAR(500),
      FOREIGN KEY (supplierid) REFERENCES suppliers(supplierid) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      orderid INT AUTO_INCREMENT PRIMARY KEY,
      customerid INT NOT NULL,
      orderdate DATETIME DEFAULT CURRENT_TIMESTAMP,
      totalamount DECIMAL(10,2) NOT NULL,
      deliveryaddress TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'Pending',
      FOREIGN KEY (customerid) REFERENCES users(userid)
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      itemid INT AUTO_INCREMENT PRIMARY KEY,
      orderid INT NOT NULL,
      medicineid INT NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (orderid) REFERENCES orders(orderid) ON DELETE CASCADE,
      FOREIGN KEY (medicineid) REFERENCES medicines(medicineid)
    )`,
    `CREATE TABLE IF NOT EXISTS prescriptions (
      prescriptionid INT AUTO_INCREMENT PRIMARY KEY,
      customerid INT NOT NULL,
      orderid INT,
      prescriptionfile VARCHAR(255) NOT NULL,
      verificationstatus VARCHAR(30) NOT NULL DEFAULT 'Pending',
      uploadeddate DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customerid) REFERENCES users(userid),
      FOREIGN KEY (orderid) REFERENCES orders(orderid) ON DELETE SET NULL
    )`
  ];
  for (const sql of statements) await pool.query(sql);
}

async function seedData() {
  const [admins] = await pool.query("SELECT userid FROM users WHERE role='admin' LIMIT 1");
  if (!admins.length) {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("Admin@123", 10);
    await pool.query(
      "INSERT INTO users (name,email,phone,password,role) VALUES (?,?,?,?,?)",
      ["Dharma Administrator", "admin@dharma.com", "9999999999", hash, "admin"]
    );
  }

  const [suppliers] = await pool.query("SELECT supplierid FROM suppliers LIMIT 1");
  let supplierId;
  if (!suppliers.length) {
    const [result] = await pool.query(
      "INSERT INTO suppliers (suppliername,phone,email,address) VALUES (?,?,?,?)",
      ["Dharma Healthcare Supplies", "9000000000", "supplier@example.com", "Kurnool, Andhra Pradesh"]
    );
    supplierId = result.insertId;
  } else supplierId = suppliers[0].supplierid;

  const [medicines] = await pool.query("SELECT medicineid FROM medicines LIMIT 1");
  if (!medicines.length) {
    const demo = [
      ["Vitamin C Tablets", "Vitamins", "Demo listing for catalogue testing. Not medical advice.", 85, 50, "2028-12-31", 0, "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600"],
      ["Digital Thermometer", "Devices", "A sample healthcare device listing.", 250, 25, "2029-12-31", 0, "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600"],
      ["First Aid Kit", "First Aid", "A sample first-aid product listing.", 399, 18, "2029-06-30", 0, "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600"],
      ["Prescription Medicine Demo", "Prescription", "Restricted demo listing. Requires prescription verification before dispensing.", 120, 10, "2028-08-31", 1, "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600"]
    ];
    for (const item of demo) {
      await pool.query(
        `INSERT INTO medicines
        (supplierid,medicinename,category,description,price,quantity,expirydate,prescriptionrequired,imageurl)
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [supplierId, ...item]
      );
    }
  }
}

function getPool() {
  if (!pool) throw new Error("Database has not been initialized.");
  return pool;
}

module.exports = { initializeDatabase, getPool };
