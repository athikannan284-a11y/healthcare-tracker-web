-- FIX: Run this to correct the 'name' column type and ensure 'dob' is correct

-- 1. Drop the incorrect 'name' column if it's float4
ALTER TABLE reports DROP COLUMN IF EXISTS name;

-- 2. Add 'name' column with the correct TEXT type
ALTER TABLE reports ADD COLUMN name TEXT;

-- 3. Ensure 'dob' column is DATE type
ALTER TABLE reports DROP COLUMN IF EXISTS dob;
ALTER TABLE reports ADD COLUMN dob DATE;
