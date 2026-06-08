import { Elysia, t } from "elysia";
import { db } from "../db";
import { products, sales, saleItems, customers, suppliers, purchases, purchaseItems, customerPayments } from "../db/schema";
import { eventBus } from "../index";

export const syncRoutes = new Elysia({ prefix: "/api/sync" })
  .post("/upload", async ({ body }) => {
    const { offlineSales, offlineCustomers, offlinePayments } = body;
    // Process offline sales
    for (const sale of offlineSales) {
      // Insert sale and items, update stock
      const [newSale] = await db.insert(sales).values({
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        amountPaid: sale.paid,
        loanAmount: sale.loanAmount,
        customerId: sale.customerId,
        date: sale.date
      }).returning();
      for (const item of sale.items) {
        await db.insert(saleItems).values({
          saleId: newSale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.sellingPrice
        });
        await db.update(products).set({ stock: sql`stock - ${item.quantity}` }).where(eq(products.id, item.productId));
      }
      eventBus.emit("update", { type: "new-sale" });
    }
    // Similarly for customers, payments...
    return { success: true };
  }, {
    body: t.Object({
      offlineSales: t.Array(t.Any()),
      offlineCustomers: t.Array(t.Any()),
      offlinePayments: t.Array(t.Any())
    })
  });