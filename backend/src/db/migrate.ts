// backend/src/db/migrate.ts
import { sqlite } from "./index";

async function migrate() {
  console.log("📦 Running database migrations...");

  // Create all tables (if not exists)
  sqlite.exec(`
    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE NOT NULL,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      expiry_date INTEGER,
      stock INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 10,
      supplier_id INTEGER REFERENCES suppliers(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      balance REAL DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      balance REAL DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Sales
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      total REAL NOT NULL,
      payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'upi')) NOT NULL,
      amount_paid REAL NOT NULL,
      change REAL DEFAULT 0,
      date INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    -- Sale Items
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL
    );

    -- Purchases
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      invoice_no INTEGER UNIQUE,
      total REAL NOT NULL,
      payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'upi')) NOT NULL,
      amount_paid REAL NOT NULL,
      change REAL DEFAULT 0,
      date INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    -- Purchase Items
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL
    );

    -- Customer Payments
    CREATE TABLE IF NOT EXISTS customer_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      amount REAL NOT NULL,
      date INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      note TEXT
    );

    -- Supplier Payments
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      amount REAL NOT NULL,
      date INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      note TEXT
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      date INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    -- Price History
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      old_price REAL,
      new_price REAL NOT NULL,
      changed_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Stock Adjustments
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_change INTEGER NOT NULL,
      reason TEXT,
      adjusted_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Create FTS5 virtual table (external content mode)
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(name, barcode, content='products', content_rowid='id');
  `);

  // For existing databases: add columns if missing (safe upgrade path)
  try {
    const prodCols = sqlite.prepare("PRAGMA table_info('products')").all();
    const hasExpiry = prodCols.some(c => c.name === 'expiry_date');
    if (!hasExpiry) {
      sqlite.exec(`ALTER TABLE products ADD COLUMN expiry_date INTEGER;`);
      console.log('🔧 Added column products.expiry_date');
    }
  } catch (e) { console.warn('Could not ensure products.expiry_date:', e); }

  try {
    const purCols = sqlite.prepare("PRAGMA table_info('purchases')").all();
    const hasInvoice = purCols.some(c => c.name === 'invoice_no');
    if (!hasInvoice) {
      sqlite.exec(`ALTER TABLE purchases ADD COLUMN invoice_no INTEGER;`);
      console.log('🔧 Added column purchases.invoice_no');
    }
    // Ensure unique index exists for invoice_no for lookup
    sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS purchases_invoice_no_unique ON purchases (invoice_no);`);
  } catch (e) { console.warn('Could not ensure purchases.invoice_no:', e); }

  // Drop old triggers if they exist to avoid conflicts
  sqlite.exec(`
    DROP TRIGGER IF EXISTS products_ai;
    DROP TRIGGER IF EXISTS products_ad;
    DROP TRIGGER IF EXISTS products_au;
  `);

  // Correct triggers for FTS5 synchronization
  sqlite.exec(`
    -- After insert: add to FTS
    CREATE TRIGGER products_ai AFTER INSERT ON products BEGIN
      INSERT INTO products_fts(rowid, name, barcode) VALUES (new.id, new.name, new.barcode);
    END;

    -- After delete: remove from FTS using 'delete' command
    CREATE TRIGGER products_ad AFTER DELETE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid) VALUES('delete', old.id);
    END;

    -- After update: remove old, insert new
    CREATE TRIGGER products_au AFTER UPDATE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid) VALUES('delete', old.id);
      INSERT INTO products_fts(rowid, name, barcode) VALUES (new.id, new.name, new.barcode);
    END;
  `);

  console.log("✅ Database migrated and FTS5 ready");
}

migrate().catch(console.error);