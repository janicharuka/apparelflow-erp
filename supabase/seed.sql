-- =====================================================================
-- Seed: production recipes (Bill of Materials). Safe to re-run.
-- Demo USERS are created by `npm run seed:users` (needs Supabase Auth Admin API).
-- =====================================================================

insert into public.recipes (recipe_code, name, category, std_fabric_yards, wastage_cap)
values
  ('REC-BL01', 'Casual Blouse', 'Blouse',   1.8, 5.0),
  ('REC-CT02', 'Crop Top',      'Crop Top', 1.1, 8.0)
on conflict (recipe_code) do update
  set name = excluded.name, category = excluded.category,
      std_fabric_yards = excluded.std_fabric_yards, wastage_cap = excluded.wastage_cap;

insert into public.recipe_components (recipe_id, component_name, pieces_per_garment, sort_order)
select r.id, c.component_name, c.pieces, c.sort_order
from public.recipes r
join (values
  ('REC-BL01', 'Front Body Panel',        1, 1),
  ('REC-BL01', 'Back Body Panel',         1, 2),
  ('REC-BL01', 'Sleeves (Left & Right)',  2, 3),
  ('REC-BL01', 'Collar & Stand',          1, 4),
  ('REC-BL01', 'Sleeve Cuffs',            2, 5),
  ('REC-CT02', 'Front Chest Panel',       1, 1),
  ('REC-CT02', 'Back Support Panel',      1, 2),
  ('REC-CT02', 'Neck Binding Strip',      1, 3),
  ('REC-CT02', 'Hem Elastic Casing',      1, 4),
  ('REC-CT02', 'Side Strap Accents',      2, 5)
) as c(recipe_code, component_name, pieces, sort_order) on c.recipe_code = r.recipe_code
on conflict (recipe_id, component_name) do update
  set pieces_per_garment = excluded.pieces_per_garment, sort_order = excluded.sort_order;
