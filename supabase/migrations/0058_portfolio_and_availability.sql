-- Feature 8: Disponibilidad on/off en tiempo real
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_available_for_aid boolean NOT NULL DEFAULT true;

-- Feature 4: Galería de trabajos (portafolio)
CREATE TABLE portfolio_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portfolio_photos_business_id_idx ON portfolio_photos(business_id);
CREATE INDEX portfolio_photos_created_at_idx ON portfolio_photos(created_at DESC);

ALTER TABLE portfolio_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY portfolio_photos_select_all ON portfolio_photos
  FOR SELECT USING (true);

CREATE POLICY portfolio_photos_insert_staff ON portfolio_photos
  FOR INSERT WITH CHECK (is_business_staff(business_id));

CREATE POLICY portfolio_photos_delete_staff ON portfolio_photos
  FOR DELETE USING (is_business_staff(business_id));
