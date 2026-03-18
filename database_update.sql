-- Run this in your Supabase SQL Editor to add Name and DOB columns

ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS dob DATE;
