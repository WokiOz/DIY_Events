import crypto from 'node:crypto';
import { pool } from './db.js';

const CLE_PAR_DEFAUT = 'changez-cette-cle-en-production';
const DUREE_SESSION_MS = 180 * 24 * 60 * 60 * 1000; // 180 jours

let SECRET = null;

// Sans SESSION_SECRET (ou avec l'ancienne valeur par défaut, publique dans le
// dépôt), n'importe qui pourrait fabriquer un cookie admin valide. On génère
// alors une clé aléatoire, conservée en base pour survivre aux redémarrages.
export async function initialiserSecret() {
  const env = process.env.SESSION_SECRET;
  if (env && env !== CLE_PAR_DEFAUT) {
    SECRET = env;
    return;
  }
  await pool.query(
    `INSERT INTO parametres (cle, valeur) VALUES ('session_secret', $1) ON CONFLICT (cle) DO NOTHING`,
    [crypto.randomBytes(32).toString('hex')]
  );
  const { rows } = await pool.query(`SELECT valeur FROM parametres WHERE cle = 'session_secret'`);
  SECRET = rows[0].valeur;
  console.log('SESSION_SECRET absent : clé de session aléatoire conservée en base.');
}

function signer(valeur) {
  const signature = crypto.createHmac('sha256', SECRET).update(valeur).digest('base64url');
  return `${valeur}.${signature}`;
}

function verifierSignature(cookie) {
  const i = cookie.lastIndexOf('.');
  if (i < 0) return null;
  const valeur = cookie.slice(0, i);
  const signature = cookie.slice(i + 1);
  const attendue = crypto.createHmac('sha256', SECRET).update(valeur).digest('base64url');
  if (signature.length !== attendue.length) return null;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(attendue)) ? valeur : null;
}

function lireCookies(req) {
  const entete = req.headers.cookie;
  if (!entete) return {};
  return Object.fromEntries(entete.split(';').map(morceau => {
    const i = morceau.indexOf('=');
    const brut = morceau.slice(i + 1);
    let valeur;
    try { valeur = decodeURIComponent(brut); } catch { valeur = brut; }
    return [morceau.slice(0, i).trim(), valeur];
  }));
}

function lireJeton(valeurCookie) {
  const charge = verifierSignature(valeurCookie);
  if (!charge) return null;
  const [id, version, expiration] = charge.split(':');
  if (Number(expiration) < Date.now()) return null;
  return { id: Number(id), version: Number(version) };
}

// « Secure » seulement en HTTPS, pour ne pas casser l'usage local en http
const attributsCookie = res => {
  const https = res.req?.secure || res.req?.headers['x-forwarded-proto'] === 'https';
  return `HttpOnly; Path=/; SameSite=Lax${https ? '; Secure' : ''}`;
};

export function definirCookieSession(res, utilisateur) {
  const expiration = Date.now() + DUREE_SESSION_MS;
  const jeton = signer(`${utilisateur.id}:${utilisateur.token_version}:${expiration}`);
  res.setHeader('Set-Cookie', `session=${jeton}; Max-Age=${Math.floor(DUREE_SESSION_MS / 1000)}; ${attributsCookie(res)}`);
}

export function effacerCookieSession(res) {
  res.setHeader('Set-Cookie', `session=; Max-Age=0; ${attributsCookie(res)}`);
}

export async function authentifier(req, res, next) {
  try {
    const cookies = lireCookies(req);
    const jeton = cookies.session ? lireJeton(cookies.session) : null;
    if (!jeton) return res.status(401).json({ error: 'Non connecté' });
    const { rows } = await pool.query(
      'SELECT id, username, role, active, must_change_password, token_version FROM users WHERE id = $1',
      [jeton.id]
    );
    const utilisateur = rows[0];
    if (!utilisateur || !utilisateur.active || utilisateur.token_version !== jeton.version) {
      return res.status(401).json({ error: 'Session expirée' });
    }
    req.user = utilisateur;
    next();
  } catch (erreur) {
    next(erreur);
  }
}

export function exigerAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Réservé aux administrateurs' });
  next();
}

/* ------------------------------------------- tentatives de connexion */

// Sans limite, un mot de passe court se devine par essais successifs.
// Compté par identifiant (derrière un proxy, l'IP vue est celle du proxy).
const ESSAIS_MAX = 10;
const FENETRE_MS = 15 * 60 * 1000;
const SUIVI_MAX = 10000;
const tentatives = new Map();

export function connexionBloquee(nom) {
  const suivi = tentatives.get(nom);
  if (!suivi || suivi.bloqueJusqua <= Date.now()) return 0;
  return Math.ceil((suivi.bloqueJusqua - Date.now()) / 60000);
}

export function noterEchecConnexion(nom) {
  const maintenant = Date.now();
  let suivi = tentatives.get(nom);
  if (!suivi || maintenant - suivi.debut > FENETRE_MS) suivi = { echecs: 0, debut: maintenant, bloqueJusqua: 0 };
  suivi.echecs++;
  if (suivi.echecs >= ESSAIS_MAX) suivi.bloqueJusqua = maintenant + FENETRE_MS;
  tentatives.delete(nom);
  tentatives.set(nom, suivi);
  while (tentatives.size > SUIVI_MAX) tentatives.delete(tentatives.keys().next().value);
}

export function oublierEchecsConnexion(nom) {
  tentatives.delete(nom);
}

setInterval(() => {
  const maintenant = Date.now();
  for (const [nom, suivi] of tentatives) {
    if (maintenant - suivi.debut > FENETRE_MS && suivi.bloqueJusqua <= maintenant) tentatives.delete(nom);
  }
}, FENETRE_MS).unref();
