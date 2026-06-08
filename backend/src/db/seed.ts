// backend/src/db/seed.ts
import { db } from "./index";
import { products, suppliers, customers, settings } from "./schema";

async function seed() {
  console.log("🌱 Seeding database...");

  // Clear existing data (optional)
  await db.delete(products);
  await db.delete(suppliers);
  await db.delete(customers);
  await db.delete(settings);

  // Insert suppliers
  const supplierList = [
    { name: "Supplier A", phone: "1234567890", address: "Address A" },
    { name: "Supplier B", phone: "1234567891", address: "Address B" },
    { name: "Supplier C", phone: "1234567892", address: "Address C" },
  ];
  const insertedSuppliers = [];
  for (const sup of supplierList) {
    const [s] = await db.insert(suppliers).values(sup).returning().all();
    insertedSuppliers.push(s);
  }
  console.log(`✅ Inserted ${insertedSuppliers.length} suppliers`);

  // Insert customers
  const customerList = [
    { name: "Customer 1", phone: "9876543210", address: "Cust Address 1" },
    { name: "Customer 2", phone: "9876543211", address: "Cust Address 2" },
    { name: "Customer 3", phone: "9876543212", address: "Cust Address 3" },
  ];
  const insertedCustomers = [];
  for (const cust of customerList) {
    const [c] = await db.insert(customers).values(cust).returning().all();
    insertedCustomers.push(c);
  }
  console.log(`✅ Inserted ${insertedCustomers.length} customers`);

  // Insert 50 products
  const productsData = [];
  for (let i = 1; i <= 50; i++) {
    productsData.push({
      name: `Product ${i}`,
      barcode: `89012345${String(i).padStart(3, "0")}`,
      purchasePrice: 50 + i,
      sellingPrice: 80 + i,
      stock: 100 + i,
      lowStockThreshold: 10,
      supplierId: (i % 3) + 1,
    });
  }
  for (const prod of productsData) {
    await db.insert(products).values(prod).run();
  }
  console.log(`✅ Inserted ${productsData.length} products`);

  // Insert settings
  await db.insert(settings).values({ key: "shop_name", value: "Kiryana Store" }).run();
  await db.insert(settings).values({ key: "gst_rate", value: "5" }).run();
  console.log("✅ Settings inserted");

  console.log("🎉 Seeding complete!");
}

seed().catch(console.error);