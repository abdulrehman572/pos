// backend/src/db/schema.ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------- Products ----------
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  barcode: text("barcode").unique().notNull(),
  purchasePrice: real("purchase_price").notNull(),
  sellingPrice: real("selling_price").notNull(),
  // Optional expiry date (timestamp). If present, used to warn about expired items.
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  stock: integer("stock").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(10),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

// FTS5 virtual table for fast product search (name + barcode)
// Note: Drizzle cannot create virtual tables directly; this definition is for type safety only.
// The actual virtual table must be created via raw SQL in migration (see migrate.ts).
export const productFts = sqliteTable("product_fts", {
  rowid: integer("rowid").primaryKey(),
  name: text("name"),
  barcode: text("barcode"),
});

// ---------- Suppliers ----------
export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  balance: real("balance").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

// ---------- Customers ----------
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  balance: real("balance").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

// ---------- Sales ----------
export const sales = sqliteTable("sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").references(() => customers.id),
  total: real("total").notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "card", "upi"] }).notNull(),
  amountPaid: real("amount_paid").notNull(),
  change: real("change").default(0),
  date: integer("date", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ---------- Sale Items ----------
export const saleItems = sqliteTable("sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").references(() => sales.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
});

// ---------- Purchases ----------
export const purchases = sqliteTable("purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  // Auto-incrementing invoice number (managed by application logic)
  invoiceNo: integer("invoice_no"),
  total: real("total").notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "card", "upi"] }).notNull(),
  amountPaid: real("amount_paid").notNull(),
  change: real("change").default(0),
  date: integer("date", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ---------- Purchase Items ----------
export const purchaseItems = sqliteTable("purchase_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseId: integer("purchase_id").references(() => purchases.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
});

// ---------- Payments (Customer & Supplier) ----------
export const customerPayments = sqliteTable("customer_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  amount: real("amount").notNull(),
  date: integer("date", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  note: text("note"),
});

export const supplierPayments = sqliteTable("supplier_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  amount: real("amount").notNull(),
  date: integer("date", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  note: text("note"),
});

// ---------- Expenses ----------
export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  category: text("category"),
  date: integer("date", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ---------- Price History ----------
export const priceHistory = sqliteTable("price_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").references(() => products.id).notNull(),
  oldPrice: real("old_price"),
  newPrice: real("new_price").notNull(),
  changedAt: integer("changed_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

// ---------- Stock Adjustments ----------
export const stockAdjustments = sqliteTable("stock_adjustments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantityChange: integer("quantity_change").notNull(), // positive for addition, negative for removal
  reason: text("reason"),
  adjustedAt: integer("adjusted_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

// ---------- Settings (key-value store) ----------
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});