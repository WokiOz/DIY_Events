CREATE TABLE IF NOT EXISTS tabs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS themes (
  id SERIAL PRIMARY KEY,
  tab_id INTEGER NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  location TEXT,
  guests INTEGER,
  budget NUMERIC(12,2),
  image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blocks (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS themes_tab_id_idx ON themes(tab_id);
CREATE INDEX IF NOT EXISTS events_theme_id_idx ON events(theme_id);
CREATE INDEX IF NOT EXISTS blocks_event_id_idx ON blocks(event_id);
CREATE INDEX IF NOT EXISTS expenses_event_id_idx ON expenses(event_id);

INSERT INTO tabs (name, position)
SELECT 'Fêtes de famille', 0
WHERE NOT EXISTS (SELECT 1 FROM tabs);

INSERT INTO themes (tab_id, name, description, position)
SELECT (SELECT id FROM tabs ORDER BY position, id LIMIT 1), exemple.name, exemple.description, exemple.position
FROM (VALUES
  ('Anniversaires', 'Bougies, gâteau et invités', 0),
  ('Mariages', 'Le grand jour, du traiteur à la décoration', 1),
  ('Baptêmes', 'Cérémonie et repas de famille', 2)
) AS exemple(name, description, position)
WHERE EXISTS (SELECT 1 FROM tabs) AND NOT EXISTS (SELECT 1 FROM themes);
