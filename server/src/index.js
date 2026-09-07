import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, initDatabase } from './db.js';

const racine = path.dirname(fileURLToPath(import.meta.url));
const dossierPublic = path.join(racine, '..', 'public');
const dossierUploads = path.join(racine, '..', 'uploads');
fs.mkdirSync(dossierUploads, { recursive: true });

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(dossierUploads, { maxAge: '7d' }));
app.use(express.static(dossierPublic));

const stockage = multer.diskStorage({
  destination: (req, fichier, suite) => suite(null, dossierUploads),
  filename: (req, fichier, suite) => {
    const extension = path.extname(fichier.originalname).slice(0, 12).replace(/[^\w.]/g, '');
    suite(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`);
  }
});
const envoi = multer({ storage: stockage, limits: { fileSize: 50 * 1024 * 1024 } });

const COLONNES_EVENT =
  'id, theme_id, name, description, event_date, location, guests, budget::float AS budget, image_url, position, created_at';
const COLONNES_EXPENSE = 'id, event_id, label, amount::float AS amount, paid, position';
const TABLES_ORDONNABLES = ['tabs', 'themes', 'events', 'blocks'];
const COLONNES_REQUISES = ['name', 'label'];

const a = fn => (req, res) => fn(req, res).catch(erreur => {
  console.error(erreur);
  if (!res.headersSent) res.status(500).json({ error: 'Erreur du serveur' });
});

async function patch(table, id, corps, autorisees, colonnes = '*') {
  const morceaux = [];
  const valeurs = [];
  for (const cle of autorisees) {
    if (!(cle in corps)) continue;
    let valeur = corps[cle];
    if (valeur === '' && !COLONNES_REQUISES.includes(cle)) valeur = cle === 'amount' ? 0 : null;
    morceaux.push(`${cle} = $${morceaux.length + 1}`);
    valeurs.push(valeur);
  }
  if (!morceaux.length) {
    const { rows } = await pool.query(`SELECT ${colonnes} FROM ${table} WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }
  valeurs.push(id);
  const { rows } = await pool.query(
    `UPDATE ${table} SET ${morceaux.join(', ')} WHERE id = $${valeurs.length} RETURNING ${colonnes}`,
    valeurs
  );
  return rows[0] ?? null;
}

async function supprimer(table, id, res) {
  const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  if (!rowCount) return res.status(404).json({ error: 'Élément introuvable' });
  res.json({ ok: true });
}

const introuvable = (res, quoi) => res.status(404).json({ error: `${quoi} introuvable` });

/* ---------------------------------------------------------------- onglets */

app.get('/api/tabs', a(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tabs ORDER BY position, id');
  res.json(rows);
}));

app.post('/api/tabs', a(async (req, res) => {
  const nom = (req.body.name || '').trim();
  if (!nom) return res.status(400).json({ error: 'Le nom est obligatoire' });
  const { rows } = await pool.query(
    `INSERT INTO tabs (name, image_url, position)
     VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM tabs)) RETURNING *`,
    [nom, req.body.image_url || null]
  );
  res.status(201).json(rows[0]);
}));

app.patch('/api/tabs/:id', a(async (req, res) => {
  const onglet = await patch('tabs', req.params.id, req.body, ['name', 'image_url']);
  onglet ? res.json(onglet) : introuvable(res, 'Onglet');
}));

app.delete('/api/tabs/:id', a((req, res) => supprimer('tabs', req.params.id, res)));

app.get('/api/tabs/:id/themes', a(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.*, (SELECT COUNT(*)::int FROM events e WHERE e.theme_id = t.id) AS event_count
     FROM themes t WHERE t.tab_id = $1 ORDER BY t.position, t.id`,
    [req.params.id]
  );
  res.json(rows);
}));

/* ----------------------------------------------------------------- thèmes */

app.post('/api/themes', a(async (req, res) => {
  const nom = (req.body.name || '').trim();
  if (!req.body.tab_id) return res.status(400).json({ error: 'Onglet manquant' });
  if (!nom) return res.status(400).json({ error: 'Le nom est obligatoire' });
  const { rows } = await pool.query(
    `INSERT INTO themes (tab_id, name, description, image_url, position)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position), -1) + 1 FROM themes WHERE tab_id = $1))
     RETURNING *`,
    [req.body.tab_id, nom, req.body.description || null, req.body.image_url || null]
  );
  res.status(201).json(rows[0]);
}));

app.get('/api/themes/:id', a(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM themes WHERE id = $1', [req.params.id]);
  if (!rows[0]) return introuvable(res, 'Thème');
  const evenements = await pool.query(
    `SELECT ${COLONNES_EVENT},
            COALESCE((SELECT SUM(amount) FROM expenses x WHERE x.event_id = e.id), 0)::float AS spent
     FROM events e WHERE theme_id = $1 ORDER BY position, id`,
    [req.params.id]
  );
  res.json({ ...rows[0], events: evenements.rows });
}));

app.patch('/api/themes/:id', a(async (req, res) => {
  const theme = await patch('themes', req.params.id, req.body, ['name', 'image_url', 'description']);
  theme ? res.json(theme) : introuvable(res, 'Thème');
}));

app.delete('/api/themes/:id', a((req, res) => supprimer('themes', req.params.id, res)));

/* ------------------------------------------------------------- événements */

app.post('/api/events', a(async (req, res) => {
  const nom = (req.body.name || '').trim();
  if (!req.body.theme_id) return res.status(400).json({ error: 'Thème manquant' });
  if (!nom) return res.status(400).json({ error: 'Le nom est obligatoire' });
  const { rows } = await pool.query(
    `INSERT INTO events (theme_id, name, event_date, location, guests, budget, position)
     VALUES ($1, $2, $3, $4, $5, $6,
             (SELECT COALESCE(MAX(position), -1) + 1 FROM events WHERE theme_id = $1))
     RETURNING ${COLONNES_EVENT}`,
    [
      req.body.theme_id,
      nom,
      req.body.event_date || null,
      req.body.location || null,
      req.body.guests || null,
      req.body.budget ?? null
    ]
  );
  res.status(201).json(rows[0]);
}));

app.get('/api/events/:id', a(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${COLONNES_EVENT} FROM events WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return introuvable(res, 'Événement');
  const blocs = await pool.query(
    'SELECT * FROM blocks WHERE event_id = $1 ORDER BY position, id',
    [req.params.id]
  );
  const depenses = await pool.query(
    `SELECT ${COLONNES_EXPENSE} FROM expenses WHERE event_id = $1 ORDER BY position, id`,
    [req.params.id]
  );
  const theme = await pool.query(
    'SELECT t.id, t.name, t.tab_id FROM themes t WHERE t.id = $1',
    [rows[0].theme_id]
  );
  res.json({ ...rows[0], theme: theme.rows[0] ?? null, blocks: blocs.rows, expenses: depenses.rows });
}));

app.patch('/api/events/:id', a(async (req, res) => {
  const evenement = await patch(
    'events', req.params.id, req.body,
    ['name', 'description', 'event_date', 'location', 'guests', 'budget', 'image_url'],
    COLONNES_EVENT
  );
  evenement ? res.json(evenement) : introuvable(res, 'Événement');
}));

app.delete('/api/events/:id', a((req, res) => supprimer('events', req.params.id, res)));

/* ------------------------------------------------------------------ blocs */

app.post('/api/events/:id/blocks', a(async (req, res) => {
  if (!req.body.type) return res.status(400).json({ error: 'Type de bloc manquant' });
  const { rows } = await pool.query(
    `INSERT INTO blocks (event_id, type, title, data, position)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position), -1) + 1 FROM blocks WHERE event_id = $1))
     RETURNING *`,
    [req.params.id, req.body.type, req.body.title || null, req.body.data ?? {}]
  );
  res.status(201).json(rows[0]);
}));

app.patch('/api/blocks/:id', a(async (req, res) => {
  const bloc = await patch('blocks', req.params.id, req.body, ['title', 'data']);
  bloc ? res.json(bloc) : introuvable(res, 'Bloc');
}));

app.delete('/api/blocks/:id', a((req, res) => supprimer('blocks', req.params.id, res)));

/* --------------------------------------------------------------- dépenses */

app.post('/api/events/:id/expenses', a(async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO expenses (event_id, label, amount, position)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(position), -1) + 1 FROM expenses WHERE event_id = $1))
     RETURNING ${COLONNES_EXPENSE}`,
    [req.params.id, (req.body.label ?? '').trim(), req.body.amount || 0]
  );
  res.status(201).json(rows[0]);
}));

app.patch('/api/expenses/:id', a(async (req, res) => {
  const depense = await patch(
    'expenses', req.params.id, req.body, ['label', 'amount', 'paid'], COLONNES_EXPENSE
  );
  depense ? res.json(depense) : introuvable(res, 'Dépense');
}));

app.delete('/api/expenses/:id', a((req, res) => supprimer('expenses', req.params.id, res)));

/* ------------------------------------------------- envoi de fichiers, etc */

app.post('/api/upload', envoi.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const nom = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  res.json({ url: `/uploads/${req.file.filename}`, name: nom, size: req.file.size });
});

app.post('/api/reorder', a(async (req, res) => {
  const { table, ids } = req.body;
  if (!TABLES_ORDONNABLES.includes(table)) return res.status(400).json({ error: 'Table non autorisée' });
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'Liste d’identifiants manquante' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await client.query(`UPDATE ${table} SET position = $1 WHERE id = $2`, [i, Number(ids[i])]);
    }
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
  res.json({ ok: true });
}));

app.get('/api/search', a(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 3) return res.json([]);
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.event_date, e.location,
            t.id AS theme_id, t.name AS theme_name, t.tab_id
     FROM events e JOIN themes t ON t.id = e.theme_id
     WHERE e.name ILIKE $1 OR e.location ILIKE $1 OR e.description ILIKE $1
     ORDER BY e.event_date DESC NULLS LAST, e.name
     LIMIT 20`,
    [`%${q}%`]
  );
  res.json(rows);
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

app.get('*', (req, res) => res.sendFile(path.join(dossierPublic, 'index.html')));

app.use((erreur, req, res, next) => {
  console.error(erreur);
  const trop = erreur.code === 'LIMIT_FILE_SIZE';
  res.status(trop ? 413 : 500).json({ error: trop ? 'Fichier trop volumineux (50 Mo maximum)' : 'Erreur du serveur' });
});

const port = process.env.PORT || 3000;
initDatabase()
  .then(() => app.listen(port, () => console.log(`Prêt sur le port ${port}`)))
  .catch(erreur => {
    console.error('Impossible de préparer la base :', erreur);
    process.exit(1);
  });
