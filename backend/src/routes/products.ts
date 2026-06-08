import { Elysia, t } from "elysia";
import { db, sqlite } from "../db";
import { products } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { eventBus } from "../index";

export const productsRoutes = new Elysia({ prefix: "/api/products" })
  // List all products (with optional limit, lowStock, search)
  .get("/", ({ query: { limit, lowStock, search } }) => {
    let query = db.select().from(products);
    if (lowStock === "true") {
      query = query.where(sql`${products.stock} <= ${products.lowStockThreshold}`);
    }
    if (search) {
      // Use FTS5 for full‑text search
      const ftsResults = sqlite
        .prepare(`SELECT rowid FROM products_fts WHERE products_fts MATCH ? LIMIT 50`)
        .all(search);
      const ids = ftsResults.map((r: any) => r.rowid);
      if (ids.length === 0) return [];
      query = query.where(sql`${products.id} IN (${ids.join(",")})`);
    }
    if (limit) {
      query = query.limit(Number(limit));
    }
    return query.all();
  })

  // Get single product by ID
  .get("/:id", ({ params: { id } }) => {
    return db.select().from(products).where(eq(products.id, Number(id))).get();
  })

  // Get product by barcode
  .get("/barcode/:code", ({ params: { code } }) => {
    return db.select().from(products).where(eq(products.barcode, code)).get();
  })

  // Create new product
  .post("/", async ({ body }) => {
    const { name, barcode, purchasePrice, sellingPrice, stock, lowStockThreshold, supplierId } = body;
    const newProduct = await db.insert(products).values({
      name, barcode, purchasePrice, sellingPrice, stock, lowStockThreshold, supplierId
    }).returning().get();
    // Update FTS5
    sqlite.run(`INSERT OR REPLACE INTO products_fts(rowid, name, barcode) VALUES(?, ?, ?)`,
      [newProduct.id, name, barcode]);
    return newProduct;
  }, {
    body: t.Object({
      name: t.String(),
      barcode: t.String(),
      purchasePrice: t.Number(),
      sellingPrice: t.Number(),
      stock: t.Number(),
      lowStockThreshold: t.Number(),
      supplierId: t.Optional(t.Number())
    })
  })

  // Update product
  .put("/:id", async ({ params: { id }, body }) => {
    const updated = await db.update(products).set(body).where(eq(products.id, Number(id))).returning().get();
    if (updated) {
      // Update FTS5
      sqlite.run(`UPDATE products_fts SET name=?, barcode=? WHERE rowid=?`,
        [updated.name, updated.barcode, updated.id]);
      // Emit stock update event if stock changed
      if (body.stock !== undefined) {
        eventBus.emit("update", { type: "stock_update", productId: updated.id, newStock: updated.stock });
      }
    }
    return updated;
  })

  // Delete product
  .delete("/:id", async ({ params: { id } }) => {
    const deleted = await db.delete(products).where(eq(products.id, Number(id))).returning().get();
    sqlite.run(`DELETE FROM products_fts WHERE rowid=?`, [id]);
    return deleted;
  });