// test-db.ts (place in ~/kiryana-app/)
import { db } from "./backend/src/db";
import { products } from "./backend/src/db/schema";

async function test() {
  const sample = await db.select().from(products).limit(5).all();
  console.log("Sample products:", sample);
}

test().catch(console.error);