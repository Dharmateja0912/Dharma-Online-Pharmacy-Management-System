# Dharma Online Pharmacy Management System

A beginner-friendly CSE mini-project built with HTML, CSS, JavaScript, Node.js, Express.js and MySQL. It demonstrates a pharmacy product catalogue, customer accounts, admin inventory, shopping cart, orders and prescription review.

> **Academic demonstration only.** The sample catalogue is not medical advice. Do not use this project to operate a real pharmacy without professional, legal, privacy, security and regulatory review. Prescription uploads are stored locally and this starter project is not designed for production handling of sensitive medical records.

## 1. Requirements

- Node.js 18 or later
- MySQL Server 8 or compatible
- MySQL Workbench (optional, for viewing tables)
- VS Code (recommended)

## 2. Install and run

1. Extract the ZIP file.
2. Open the extracted `Dharma_Online_Pharmacy_Management_System` folder in VS Code.
3. Open a terminal in that folder.
4. Install dependencies:

   ```bash
   npm install
   ```

5. Copy `.env.example` to a new file named `.env`.
6. Edit `.env` and enter your local MySQL password:

   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=dharma_pharmacy
   SESSION_SECRET=use_a_long_random_secret_here
   ```

   If your MySQL root account has no password, keep `DB_PASSWORD=` empty.

7. Make sure MySQL Server is running.
8. Start the project:

   ```bash
   npm start
   ```

9. Open `http://localhost:3000` in your browser.

The server creates the `dharma_pharmacy` database and all six tables automatically when it starts. It also inserts sample catalogue records and a demo admin if one does not already exist.

## 3. Demo administrator

- Email: `admin@dharma.com`
- Password: `Admin@123`

Log in through the Login page. The server redirects an admin to `admin.html` and a customer to `customer.html`.

For a real deployment, change the demo admin password and implement a secure admin-account provisioning process. Do not use demo credentials on a public server.

## 4. Customer workflow

1. Select Register and create a customer account.
2. Log in.
3. Browse products and search/filter by category.
4. Add non-prescription demo products to the cart.
5. Enter a delivery address and place an order.
6. View the order in Order management.
7. Upload a prescription from the customer dashboard if needed. An admin must verify it.

Prescription-required demo products cannot be ordered until a verified prescription exists for the customer. This is a simplified academic workflow, not a clinical prescription validation service.

## 5. Administrator workflow

1. Log in using the demo administrator credentials.
2. Open the admin dashboard.
3. Add or delete catalogue items.
4. Review inventory and dashboard counts.
5. Update order statuses.
6. Open uploaded prescription files and mark them Verified or Rejected.

## 6. Database tables

The database is named `dharma_pharmacy`.

| Table | Purpose |
|---|---|
| users | Customer and administrator accounts |
| suppliers | Medicine supplier details |
| medicines | Product catalogue and stock |
| orders | Customer order header |
| order_items | Products and quantities in an order |
| prescriptions | Uploaded prescription file and review status |

### View tables in MySQL Workbench

1. Open MySQL Workbench and connect to your local MySQL server.
2. Run:

   ```sql
   USE dharma_pharmacy;
   SHOW TABLES;
   SELECT * FROM users;
   SELECT * FROM suppliers;
   SELECT * FROM medicines;
   SELECT * FROM orders;
   SELECT * FROM order_items;
   SELECT * FROM prescriptions;
   ```

3. Refresh the Schemas panel. Expand `dharma_pharmacy` → Tables.

## 7. SQL schema

The complete table creation SQL is in `db.js` in the `createTables()` function. The following commands can also be used to inspect the schema:

```sql
USE dharma_pharmacy;
DESCRIBE users;
DESCRIBE suppliers;
DESCRIBE medicines;
DESCRIBE orders;
DESCRIBE order_items;
DESCRIBE prescriptions;
```

The application uses parameterized SQL queries to reduce SQL injection risk. The order creation route uses a database transaction so stock changes and order records are committed together.

## 8. Main API routes

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | API health check |
| POST | `/api/register` | Public | Customer registration |
| POST | `/api/login` | Public | Login |
| POST | `/api/logout` | Logged in | Logout |
| GET | `/api/me` | Public | Current session |
| GET | `/api/medicines` | Public | Search catalogue |
| POST | `/api/medicines` | Admin | Add medicine |
| PUT | `/api/medicines/:id` | Admin | Update medicine |
| DELETE | `/api/medicines/:id` | Admin | Delete medicine |
| GET | `/api/orders` | Logged in | List permitted orders |
| POST | `/api/orders` | Customer | Place order |
| PUT | `/api/orders/:id/status` | Admin | Update order status |
| POST | `/api/prescriptions` | Logged in | Upload prescription |
| GET | `/api/prescriptions` | Admin | List prescription uploads |
| PUT | `/api/prescriptions/:id` | Admin | Verify or reject upload |

## 9. Git and GitHub

Create a repository named `Dharma-Online-Pharmacy-Management-System`.

In the project terminal:

```bash
git init
git add .
git commit -m "Initial Dharma pharmacy management project"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/Dharma-Online-Pharmacy-Management-System.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username. Create the empty repository on GitHub first. The `.gitignore` excludes `.env`, `node_modules` and uploaded prescription files. Never commit database passwords, real prescriptions or customer personal data.

## 10. Troubleshooting

- **Access denied for MySQL:** check `DB_USER` and `DB_PASSWORD` in `.env`.
- **ECONNREFUSED:** start MySQL Server and confirm `DB_HOST`.
- **Port 3000 is busy:** change `PORT=3001` in `.env`, restart and open `http://localhost:3001`.
- **Cannot find module:** run `npm install` in the project folder.
- **Images do not load:** demo image URLs need internet access. The application still works without them.
- **Prescription upload error:** use PDF, JPG or PNG under 5 MB.

## 11. Important limitations and next improvements

This is a functional learning starter, not a production pharmacy system. Before real use, add HTTPS, CSRF protection, login rate limiting, secure session storage, strict authorization and audit logs, private prescription storage, malware scanning, retention/deletion controls, backups, stronger validation, and compliance review. A real dispensing workflow must be reviewed by qualified pharmacy professionals and comply with applicable laws.
