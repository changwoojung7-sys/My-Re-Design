-- Add seq column to missions table if it doesn't exist
do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name = 'missions' and column_name = 'seq') then
        alter table public.missions add column seq integer default 1;
    end if;
end $$;
