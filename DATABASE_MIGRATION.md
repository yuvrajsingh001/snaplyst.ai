# Database Migration Guide

## Fix Price Column Type

The `price` column in the `product_stacks` table is currently defined as `INTEGER`, but it should be `NUMERIC` or `DECIMAL` to support decimal prices (e.g., $25.05).

### Steps to Fix:

1. **Open Supabase Dashboard**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Select your project
   - Navigate to **SQL Editor** in the left sidebar

2. **Run the Migration SQL**
   ```sql
   -- Change price column from INTEGER to NUMERIC(10,2)
   -- This allows prices up to 99,999,999.99 with 2 decimal places
   ALTER TABLE product_stacks 
   ALTER COLUMN price TYPE NUMERIC(10,2);
   ```

3. **Verify the Change**
   - Go to **Table Editor** → `product_stacks`
   - Check that the `price` column now shows as `numeric` type
   - Try updating a product with a decimal price (e.g., 25.05) to verify it works

### Alternative: If you want more precision

If you need prices with more decimal places or larger values, you can use:

```sql
-- For prices up to 999,999,999.99 (9 digits before decimal, 2 after)
ALTER TABLE product_stacks 
ALTER COLUMN price TYPE NUMERIC(10,2);

-- OR for even larger prices (e.g., 99,999,999,999.99)
ALTER TABLE product_stacks 
ALTER COLUMN price TYPE NUMERIC(12,2);
```

### Notes:

- This migration is **safe** - it won't lose any existing data
- Existing integer prices (e.g., 25) will be preserved as 25.00
- After running this migration, you'll be able to save decimal prices without errors

