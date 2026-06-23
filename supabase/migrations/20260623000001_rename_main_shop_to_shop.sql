-- Rename the shop location from "Main Shop" to "Shop" for display consistency.
-- All filtering uses location_id or location_type — never the name — so this is safe.
UPDATE public.locations
SET name = 'Shop'
WHERE name = 'Main Shop'
  AND type = 'shop';
