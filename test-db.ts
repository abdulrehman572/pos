import { db } from "./backend/src/db";
import { products } from "./backend/src/db/schema";

const allProducts = await db.select().from(products).limit(5);
console.log("Sample products:", allProducts);
