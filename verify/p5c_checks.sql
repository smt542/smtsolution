-- P5c static schema checks. Each query returns its label when the object exists.

select 'units.floor' where exists (
  select 1 from information_schema.columns
  where table_name = 'units' and column_name = 'floor'
);

select 'units.usage_type' where exists (
  select 1 from information_schema.columns
  where table_name = 'units' and column_name = 'usage_type'
);

select 'unit_meters.fixed_usage' where exists (
  select 1 from information_schema.columns
  where table_name = 'unit_meters' and column_name = 'fixed_usage'
);

select 'utility_scoped_prices'
from utility_scoped_prices
where false;

select 'rls' where exists (
  select 1 from pg_tables
  where tablename = 'utility_scoped_prices' and rowsecurity
);
