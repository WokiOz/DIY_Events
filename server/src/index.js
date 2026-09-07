import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, initDatabase } from './db.js';
import { authentifier, exigerAdmin, definirCookieSession, effacerCookieSession } from './auth.js';
import { hacherMotDePasse, verifierMotDePasse } from './mots-de-passe.js';

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
const COLONNES_UTILISATEUR = 'id, username, role, active, must_change_password, created_at';
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
const estAdmin = req => req.user.role === 'admin';

/* -------------------------------------------------------------- connexion */

app.post('/api/login', a(async (req, res) => {
  const nom = (req.body.username || '').trim().toLowerCase();
  const motDePasse = req.body.password || '';
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [nom]);
  const utilisateur = rows[0];
  if (!utilisateur || !utilisateur.active || !verifierMotDePasse(motDePasse, utilisateur.password_hash)) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }
  definirCookieSession(res, utilisateur);
  res.json({
    id: utilisateur.id, username: utilisateur.username,
    role: utilisateur.role, must_change_password: utilisateur.must_change_password
  });
}));

app.post('/api/logout', (req, res) => {
  effacerCookieSession(res);
  res.json({ ok: true });
});

app.use('/api', authentifier);

app.get('/api/me', (req, res) => {
  res.json({
    id: req.user.id, username: req.user.username,
    role: req.user.role, must_change_password: req.user.must_change_password
  });
});

app.post('/api/password', a(async (req, res) => {
  const motDePasse = req.body.password || '';
  if (motDePasse.length < 4) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 4 caractères' });
  const nouvelleVersion = req.user.token_version + 1;
  await pool.query(
    'UPDATE users SET password_hash = $1, must_change_password = false, token_version = $2 WHERE id = $3',
    [hacherMotDePasse(motDePasse), nouvelleVersion, req.user.id]
  );
  definirCookieSession(res, { ...req.user, token_version: nouvelleVersion });
  res.json({ ok: true });
}));

/* --------------------------------------------------------- comptes (admin) */

app.get('/api/users', exigerAdmin, a(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${COLONNES_UTILISATEUR} FROM users ORDER BY role DESC, username`);
  res.json(rows);
}));

app.post('/api/users', exigerAdmin, a(async (req, res) => {
  const nom = (req.body.username || '').trim().toLowerCase();
  const motDePasse = req.body.password || '';
  if (!nom) return res.status(400).json({ error: 'Le nom d’utilisateur est obligatoire' });
  if (motDePasse.length < 4) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 4 caractères' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'lecture') RETURNING ${COLONNES_UTILISATEUR}`,
      [nom, hacherMotDePasse(motDePasse)]
    );
    res.status(201).json(rows[0]);
  } catch (erreur) {
    if (erreur.code === '23505') return res.status(409).json({ error: 'Ce nom d’utilisateur existe déjà' });
    throw erreur;
  }
}));

app.patch('/api/users/:id', exigerAdmin, a(async (req, res) => {
  if (!('active' in req.body)) return res.status(400).json({ error: 'Rien à modifier' });
  const actif = Boolean(req.body.active);
  const { rows } = await pool.query(
    `UPDATE users SET active = $1, token_version = token_version + CASE WHEN $1 THEN 0 ELSE 1 END
     WHERE id = $2 AND role = 'lecture' RETURNING ${COLONNES_UTILISATEUR}`,
    [actif, req.params.id]
  );
  rows[0] ? res.json(rows[0]) : introuvable(res, 'Compte');
}));

app.delete('/api/users/:id', exigerAdmin, a(async (req, res) => {
  const { rowCount } = await pool.query(`DELETE FROM users WHERE id = $1 AND role = 'lecture'`, [req.params.id]);
  rowCount ? res.json({ ok: true }) : introuvable(res, 'Compte');
}));

app.get('/api/users/:id/permissions', exigerAdmin, a(async (req, res) => {
  const { rows } = await pool.query('SELECT event_id FROM permissions WHERE user_id = $1', [req.params.id]);
  res.json(rows.map(r => r.event_id));
}));

app.post('/api/users/:id/permissions/:eventId', exigerAdmin, a(async (req, res) => {
  await pool.query(
    'INSERT INTO permissions (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.params.id, req.params.eventId]
  );
  res.json({ ok: true });
}));

app.delete('/api/users/:id/permissions/:eventId', exigerAdmin, a(async (req, res) => {
  await pool.query('DELETE FROM permissions WHERE user_id = $1 AND event_id = $2', [req.params.id, req.params.eventId]);
  res.json({ ok: true });
}));

/* ---------------------------------------------------------------- onglets */

app.get('/api/tabs', a(async (req, res) => {
  const { rows } = estAdmin(req)
    ? await pool.query('SELECT * FROM tabs ORDER BY position, id')
    : await pool.query(
        `SELECT DISTINCT t.* FROM tabs t
         JOIN themes th ON th.tab_id = t.id
         JOIN events e ON e.theme_id = th.id
         JOIN permissions p ON p.event_id = e.id AND p.user_id = $1
         ORDER BY t.position, t.id`,
        [req.user.id]
      );
  res.json(rows);
}));

app.post('/api/tabs', exigerAdmin, a(async (req, res) => {
  const nom = (req.body.name || '').trim();
  if (!nom) return res.status(400).json({ error: 'Le nom est obligatoire' });
  const { rows } = await pool.query(
    `INSERT INTO tabs (name, image_url, position)
     VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM tabs)) RETURNING *`,
    [nom, req.body.image_url || null]
  );
  res.status(201).json(rows[0]);
}));

app.patch('/api/tabs/:id', exigerAdmin, a(async (req, res) => {
  const onglet = await patch('tabs', req.params.id, req.body, ['name', 'image_url']);
  onglet ? res.json(onglet) : introuvable(res, 'Onglet');
}));

app.delete('/api/tabs/:id', exigerAdmin, a((req, res) => supprimer('tabs', req.params.id, res)));

app.get('/api/tabs/:id/themes', a(async (req, res) => {
  const { rows } = estAdmin(req)
    ? await pool.query(
        `SELECT t.*, (SELECT COUNT(*)::int FROM events e WHERE e.theme_id = t.id) AS event_count
         FROM themes t WHERE t.tab_id = $1 ORDER BY t.position, t.id`,
        [req.params.id]
      )
    : await pool.query(
        `SELECT t.*,
                (SELECT COUNT(*)::int FROM events e JOIN permissions p ON p.event_id = e.id AND p.user_id = $2
                 WHERE e.theme_id = t.id) AS event_count
         FROM themes t
         WHERE t.tab_id = $1
           AND EXISTS (SELECT 1 FROM events e JOIN permissions p ON p.event_id = e.id AND p.user_id = $2 WHERE e.theme_id = t.id)
         ORDER BY t.position, t.id`,
        [req.params.id, req.user.id]
      );
  res.json(rows);
}));

/* ----------------------------------------------------------------- thèmes */

app.post('/api/themes', exigerAdmin, a(async (req, res) => {
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
  const evenements = estAdmin(req)
    ? await pool.query(
        `SELECT ${COLONNES_EVENT},
                COALESCE((SELECT SUM(amount) FROM expenses x WHERE x.event_id = e.id), 0)::float AS spent
         FROM events e WHERE theme_id = $1 ORDER BY position, id`,
        [req.params.id]
      )
    : await pool.query(
        `SELECT ${COLONNES_EVENT},
                COALESCE((SELECT SUM(amount) FROM expenses x WHERE x.event_id = e.id), 0)::float AS spent
         FROM events e
         JOIN permissions p ON p.event_id = e.id AND p.user_id = $2
         WHERE e.theme_id = $1 ORDER BY position, id`,
        [req.params.id, req.user.id]
      );
  if (!estAdmin(req) && evenements.rows.length === 0) return introuvable(res, 'Thème');
  res.json({ ...rows[0], events: evenements.rows });
}));

app.patch('/api/themes/:id', exigerAdmin, a(async (req, res) => {
  const theme = await patch('themes', req.params.id, req.body, ['name', 'image_url', 'description']);
  theme ? res.json(theme) : introuvable(res, 'Thème');
}));

app.delete('/api/themes/:id', exigerAdmin, a((req, res) => supprimer('themes', req.params.id, res)));

/* ------------------------------------------------------------- événements */

app.post('/api/events', exigerAdmin, a(async (req, res) => {
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
  if (!estAdmin(req)) {
    const acces = await pool.query(
      'SELECT 1 FROM permissions WHERE user_id = $1 AND event_id = $2',
      [req.user.id, req.params.id]
    );
    if (!acces.rows[0]) return introuvable(res, 'Événement');
  }
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

app.patch('/api/events/:id', exigerAdmin, a(async (req, res) => {
  const evenement = await patch(
    'events', req.params.id, req.body,
    ['name', 'description', 'event_date', 'location', 'guests', 'budget', 'image_url'],
    COLONNES_EVENT
  );
  evenement ? res.json(evenement) : introuvable(res, 'Événement');
}));

app.delete('/api/events/:id', exigerAdmin, a((req, res) => supprimer('events', req.params.id, res)));

/* ------------------------------------------------------------------ blocs */

app.post('/api/events/:id/blocks', exigerAdmin, a(async (req, res) => {
  if (!req.body.type) return res.status(400).json({ error: 'Type de bloc manquant' });
  const { rows } = await pool.query(
    `INSERT INTO blocks (event_id, type, title, data, position)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position), -1) + 1 FROM blocks WHERE event_id = $1))
     RETURNING *`,
    [req.params.id, req.body.type, req.body.title || null, req.body.data ?? {}]
  );
  res.status(201).json(rows[0]);
}));

app.patch('/api/blocks/:id', exigerAdmin, a(async (req, res) => {
  const bloc = await patch('blocks', req.params.id, req.body, ['title', 'data']);
  bloc ? res.json(bloc) : introuvable(res, 'Bloc');
}));

app.delete('/api/blocks/:id', exigerAdmin, a((req, res) => supprimer('blocks', req.params.id, res)));

/* --------------------------------------------------------------- dépenses */

app.post('/api/events/:id/expenses', exigerAdmin, a(async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO expenses (event_id, label, amount, position)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(position), -1) + 1 FROM expenses WHERE event_id = $1))
     RETURNING ${COLONNES_EXPENSE}`,
    [req.params.id, (req.body.label ?? '').trim(), req.body.amount || 0]
  );
  res.status(201).json(rows[0]);
}));

app.patch('/api/expenses/:id', exigerAdmin, a(async (req, res) => {
  const depense = await patch(
    'expenses', req.params.id, req.body, ['label', 'amount', 'paid'], COLONNES_EXPENSE
  );
  depense ? res.json(depense) : introuvable(res, 'Dépense');
}));

app.delete('/api/expenses/:id', exigerAdmin, a((req, res) => supprimer('expenses', req.params.id, res)));

/* ------------------------------------------------- envoi de fichiers, etc */

app.post('/api/upload', exigerAdmin, envoi.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const nom = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  res.json({ url: `/uploads/${req.file.filename}`, name: nom, size: req.file.size });
});

app.post('/api/reorder', exigerAdmin, a(async (req, res) => {
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
  const { rows } = estAdmin(req)
    ? await pool.query(
        `SELECT e.id, e.name, e.event_date, e.location,
                t.id AS theme_id, t.name AS theme_name, t.tab_id
         FROM events e JOIN themes t ON t.id = e.theme_id
         WHERE e.name ILIKE $1 OR e.location ILIKE $1 OR e.description ILIKE $1
         ORDER BY e.event_date DESC NULLS LAST, e.name
         LIMIT 20`,
        [`%${q}%`]
      )
    : await pool.query(
        `SELECT e.id, e.name, e.event_date, e.location,
                t.id AS theme_id, t.name AS theme_name, t.tab_id
         FROM events e JOIN themes t ON t.id = e.theme_id
         JOIN permissions p ON p.event_id = e.id AND p.user_id = $2
         WHERE e.name ILIKE $1 OR e.location ILIKE $1 OR e.description ILIKE $1
         ORDER BY e.event_date DESC NULLS LAST, e.name
         LIMIT 20`,
        [`%${q}%`, req.user.id]
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
