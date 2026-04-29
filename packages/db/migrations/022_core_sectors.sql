-- ELL Reference Data: Sectors (hierarchical, Elan Expo specific)
-- Owner: ELIZA. Read by LiFTY, LEENA.
-- Ref: ELL_RULES.md v4 — R1, R9, ADR-016

CREATE TABLE IF NOT EXISTS core_sectors (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES core_sectors(id),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_tr VARCHAR(100),
  name_fr VARCHAR(100),
  level INTEGER NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_core_sectors_parent ON core_sectors(parent_id);
CREATE INDEX IF NOT EXISTS idx_core_sectors_active ON core_sectors(is_active);
CREATE INDEX IF NOT EXISTS idx_core_sectors_level ON core_sectors(level);

-- Level 1: top-level categories
INSERT INTO core_sectors (slug, name_en, name_tr, name_fr, level, display_order) VALUES
  ('hvac-refrigeration', 'HVAC & Refrigeration', 'HVAC ve Soğutma', 'CVC et Réfrigération', 1, 10),
  ('construction-building', 'Construction & Building', 'İnşaat ve Yapı', 'Construction et Bâtiment', 1, 20),
  ('furniture-decoration', 'Furniture & Decoration', 'Mobilya ve Dekorasyon', 'Mobilier et Décoration', 1, 30),
  ('ceramics-bathroom', 'Ceramics, Bathroom & Kitchen', 'Seramik, Banyo ve Mutfak', 'Céramique, Salle de bain et Cuisine', 1, 40),
  ('food-processing', 'Food Processing & Packaging', 'Gıda İşleme ve Ambalaj', 'Transformation alimentaire et Emballage', 1, 50),
  ('water-wastewater', 'Water & Wastewater', 'Su ve Atık Su', 'Eau et Eaux usées', 1, 60),
  ('plastics-rubber', 'Plastics & Rubber', 'Plastik ve Kauçuk', 'Plastiques et Caoutchouc', 1, 70),
  ('electricity-energy', 'Electricity & Energy', 'Elektrik ve Enerji', 'Électricité et Énergie', 1, 80),
  ('automotive-transport', 'Automotive & Transport', 'Otomotiv ve Ulaşım', 'Automobile et Transport', 1, 90),
  ('textile-leather', 'Textile & Leather', 'Tekstil ve Deri', 'Textile et Cuir', 1, 100),
  ('agriculture-machinery', 'Agriculture & Machinery', 'Tarım ve Makineler', 'Agriculture et Machines', 1, 110),
  ('lighting', 'Lighting', 'Aydınlatma', 'Éclairage', 1, 120),
  ('other', 'Other', 'Diğer', 'Autre', 1, 999)
ON CONFLICT (slug) DO NOTHING;

-- Level 2: sub-categories
INSERT INTO core_sectors (parent_id, slug, name_en, name_tr, name_fr, level, display_order) VALUES
  -- HVAC
  ((SELECT id FROM core_sectors WHERE slug='hvac-refrigeration'), 'air-conditioning', 'Air Conditioning', 'Klima', 'Climatisation', 2, 10),
  ((SELECT id FROM core_sectors WHERE slug='hvac-refrigeration'), 'refrigeration', 'Refrigeration', 'Soğutma', 'Réfrigération', 2, 20),
  ((SELECT id FROM core_sectors WHERE slug='hvac-refrigeration'), 'ventilation', 'Ventilation', 'Havalandırma', 'Ventilation', 2, 30),
  ((SELECT id FROM core_sectors WHERE slug='hvac-refrigeration'), 'heating', 'Heating', 'Isıtma', 'Chauffage', 2, 40),
  -- Construction
  ((SELECT id FROM core_sectors WHERE slug='construction-building'), 'building-materials', 'Building Materials', 'Yapı Malzemeleri', 'Matériaux de construction', 2, 10),
  ((SELECT id FROM core_sectors WHERE slug='construction-building'), 'construction-equipment', 'Construction Equipment', 'İnşaat Ekipmanları', 'Équipement de construction', 2, 20),
  ((SELECT id FROM core_sectors WHERE slug='construction-building'), 'architecture-engineering', 'Architecture & Engineering', 'Mimari ve Mühendislik', 'Architecture et Ingénierie', 2, 30),
  -- Furniture
  ((SELECT id FROM core_sectors WHERE slug='furniture-decoration'), 'interior-design', 'Interior Design', 'İç Mimari', 'Design intérieur', 2, 10),
  ((SELECT id FROM core_sectors WHERE slug='furniture-decoration'), 'home-decoration', 'Home Decoration', 'Ev Dekorasyonu', 'Décoration intérieure', 2, 20),
  ((SELECT id FROM core_sectors WHERE slug='furniture-decoration'), 'office-furniture', 'Office Furniture', 'Ofis Mobilyası', 'Mobilier de bureau', 2, 30),
  ((SELECT id FROM core_sectors WHERE slug='furniture-decoration'), 'kitchen-bath-furniture', 'Kitchen & Bath Furniture', 'Mutfak ve Banyo Mobilyası', 'Mobilier de cuisine et salle de bain', 2, 40),
  -- Ceramics
  ((SELECT id FROM core_sectors WHERE slug='ceramics-bathroom'), 'tiles-flooring', 'Tiles & Flooring', 'Karo ve Zemin', 'Carreaux et Sols', 2, 10),
  ((SELECT id FROM core_sectors WHERE slug='ceramics-bathroom'), 'sanitary-ware', 'Sanitary Ware', 'Banyo Armatürleri', 'Sanitaires', 2, 20),
  ((SELECT id FROM core_sectors WHERE slug='ceramics-bathroom'), 'kitchen-equipment', 'Kitchen Equipment', 'Mutfak Ekipmanları', 'Équipement de cuisine', 2, 30),
  -- Food
  ((SELECT id FROM core_sectors WHERE slug='food-processing'), 'food-machinery', 'Food Machinery', 'Gıda Makinaları', 'Machines alimentaires', 2, 10),
  ((SELECT id FROM core_sectors WHERE slug='food-processing'), 'packaging-machinery', 'Packaging Machinery', 'Ambalaj Makinaları', 'Machines d''emballage', 2, 20),
  ((SELECT id FROM core_sectors WHERE slug='food-processing'), 'food-ingredients', 'Food & Ingredients', 'Gıda ve İçerik', 'Aliments et Ingrédients', 2, 30),
  -- Water
  ((SELECT id FROM core_sectors WHERE slug='water-wastewater'), 'water-treatment', 'Water Treatment', 'Su Arıtma', 'Traitement de l''eau', 2, 10),
  ((SELECT id FROM core_sectors WHERE slug='water-wastewater'), 'pumps-valves', 'Pumps & Valves', 'Pompalar ve Vanalar', 'Pompes et Vannes', 2, 20),
  ((SELECT id FROM core_sectors WHERE slug='water-wastewater'), 'irrigation', 'Irrigation', 'Sulama', 'Irrigation', 2, 30),
  -- Electricity
  ((SELECT id FROM core_sectors WHERE slug='electricity-energy'), 'cables-wiring', 'Cables & Wiring', 'Kablo ve Tesisat', 'Câbles et Câblage', 2, 10),
  ((SELECT id FROM core_sectors WHERE slug='electricity-energy'), 'solar-renewable', 'Solar & Renewable', 'Güneş ve Yenilenebilir', 'Solaire et Renouvelable', 2, 20),
  ((SELECT id FROM core_sectors WHERE slug='electricity-energy'), 'electric-motors', 'Electric Motors & Generators', 'Elektrik Motorları ve Jeneratörler', 'Moteurs électriques et Générateurs', 2, 30),
  -- Lighting
  ((SELECT id FROM core_sectors WHERE slug='lighting'), 'led-lighting', 'LED Lighting', 'LED Aydınlatma', 'Éclairage LED', 2, 10),
  ((SELECT id FROM core_sectors WHERE slug='lighting'), 'decorative-lighting', 'Decorative Lighting', 'Dekoratif Aydınlatma', 'Éclairage décoratif', 2, 20),
  ((SELECT id FROM core_sectors WHERE slug='lighting'), 'industrial-lighting', 'Industrial Lighting', 'Endüstriyel Aydınlatma', 'Éclairage industriel', 2, 30)
ON CONFLICT (slug) DO NOTHING;
