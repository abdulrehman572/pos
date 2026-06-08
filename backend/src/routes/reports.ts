import { Elysia } from "elysia";
import { db } from "../db";
import { sales, saleItems, purchases, purchaseItems, expenses, products, customers } from "../db/schema";
import { sql, and, gte, lte, eq } from "drizzle-orm";

export const reportsRoutes = new Elysia({ prefix: "/api/reports" })
  // Daily sales summary (for today or specific date)
  .get("/daily-sales", async ({ query: { date } }) => {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const daily = await db.select({
      totalSales: sql<number>`COALESCE(SUM(${sales.total}), 0)`,
      totalCash: sql<number>`COALESCE(SUM(CASE WHEN ${sales.paymentMethod} = 'cash' THEN ${sales.total} ELSE 0 END), 0)`,
      totalCard: sql<number>`COALESCE(SUM(CASE WHEN ${sales.paymentMethod} = 'card' THEN ${sales.total} ELSE 0 END), 0)`,
      totalUpi: sql<number>`COALESCE(SUM(CASE WHEN ${sales.paymentMethod} = 'upi' THEN ${sales.total} ELSE 0 END), 0)`,
      itemsSold: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)`,
    })
    .from(sales)
    .leftJoin(saleItems, eq(sales.id, saleItems.saleId))
    .where(and(gte(sales.date, startOfDay), lte(sales.date, endOfDay)))
    .get();

    // Profit calculation
    const profitQuery = await db.select({
      profit: sql<number>`COALESCE(SUM((${saleItems.unitPrice} - ${products.purchasePrice}) * ${saleItems.quantity}), 0)`,
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.date, startOfDay), lte(sales.date, endOfDay)))
    .get();

    return { ...daily, profit: profitQuery?.profit || 0, date: targetDate.toISOString().split('T')[0] };
  })

  // Monthly Profit & Loss
  .get("/monthly-pnl", async ({ query: { year, month } }) => {
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const totalSales = await db.select({ value: sql<number>`COALESCE(SUM(${sales.total}), 0)` })
      .from(sales)
      .where(and(gte(sales.date, startDate), lte(sales.date, endDate)))
      .get();

    const totalPurchases = await db.select({ value: sql<number>`COALESCE(SUM(${purchases.total}), 0)` })
      .from(purchases)
      .where(and(gte(purchases.date, startDate), lte(purchases.date, endDate)))
      .get();

    const totalExpenses = await db.select({ value: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(gte(expenses.date, startDate), lte(expenses.date, endDate)))
      .get();

    const profit = (totalSales?.value || 0) - (totalPurchases?.value || 0) - (totalExpenses?.value || 0);
    return {
      year: targetYear,
      month: targetMonth,
      totalSales: totalSales?.value || 0,
      totalPurchases: totalPurchases?.value || 0,
      totalExpenses: totalExpenses?.value || 0,
      profit,
    };
  })

  // Stock summary (total value at selling price)
  .get("/stock-summary", async () => {
    const stock = await db.select({
      totalStockValue: sql<number>`COALESCE(SUM(${products.stock} * ${products.sellingPrice}), 0)`,
      totalItems: sql<number>`COALESCE(SUM(${products.stock}), 0)`,
      distinctProducts: sql<number>`COUNT(*)`,
    }).from(products).get();
    return stock;
  })

  // Low stock products
  .get("/low-stock", async () => {
    const lowStock = await db.select()
      .from(products)
      .where(sql`${products.stock} <= ${products.lowStockThreshold}`)
      .all();
    return lowStock;
  })

  // Customer khata (balance > 0)
  .get("/khata", async () => {
    const customersWithBalance = await db.select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      balance: customers.balance,
    }).from(customers).where(sql`${customers.balance} > 0`).all();
    return customersWithBalance;
  })

  // NEW: Date-range sales report (for custom period)
  .get("/date-range-sales", async ({ query: { from, to } }) => {
    if (!from || !to) {
      return { totalSales: 0, profit: 0 };
    }
    const startDate = new Date(from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);

    const daily = await db.select({
      totalSales: sql<number>`COALESCE(SUM(${sales.total}), 0)`,
    })
    .from(sales)
    .where(and(gte(sales.date, startDate), lte(sales.date, endDate)))
    .get();

    const profitQuery = await db.select({
      profit: sql<number>`COALESCE(SUM((${saleItems.unitPrice} - ${products.purchasePrice}) * ${saleItems.quantity}), 0)`,
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.date, startDate), lte(sales.date, endDate)))
    .get();

    return { totalSales: daily?.totalSales || 0, profit: profitQuery?.profit || 0 };
  });