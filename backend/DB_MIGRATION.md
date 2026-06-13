Database Migration Notes

Changes added:
- `products.expiry_date` (INTEGER timestamp) — optional expiry date for products.
- `purchases.invoice_no` (INTEGER, UNIQUE) — application-generated invoice number starting at 1 for fresh installs.

Behavior:
- `backend/src/db/migrate.ts` creates columns on fresh installs.
- On existing databases the migration script will attempt to `ALTER TABLE` and add missing columns automatically at startup.
- A unique index on `purchases.invoice_no` is created if missing.

If you want to reset the DB to a clean state (fresh install) delete the `kiryana.db` file in the project root and restart the backend; migrations will recreate tables with new columns.

If you prefer to preserve data but add columns manually, run:

```sql
ALTER TABLE products ADD COLUMN expiry_date INTEGER;
ALTER TABLE purchases ADD COLUMN invoice_no INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS purchases_invoice_no_unique ON purchases (invoice_no);
```

After the schema is present, the application will auto-generate invoice numbers for new purchases.
