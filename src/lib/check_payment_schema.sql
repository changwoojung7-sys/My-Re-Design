-- Check columns in payments table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments';

-- Check RLS policies for payments table
select * from pg_policies where tablename = 'payments';
