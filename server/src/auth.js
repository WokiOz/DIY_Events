import crypto from 'node:crypto';
import { pool } from './db.js';

const SECRET = process.env.SESSION_SECRET || 'changez-cette-cle-en-production';
const DUREE_SESSION_MS = 180 * 24 * 60 * 60 * 1000; // 180 jours

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
    return [morceau.slice(0, i).trim(), decodeURIComponent(morceau.slice(i + 1))];
  }));
}

function lireJeton(valeurCookie) {
  const charge = verifierSignature(valeurCookie);
  if (!charge) return null;
  const [id, version, expiration] = charge.split(':');
  if (Number(expiration) < Date.now()) return null;
  return { id: Number(id), version: Number(version) };
}

export function definirCookieSession(res, utilisateur) {
  const expiration = Date.now() + DUREE_SESSION_MS;
  const jeton = signer(`${utilisateur.id}:${utilisateur.token_version}:${expiration}`);
  res.setHeader('Set-Cookie', `session=${jeton}; HttpOnly; Path=/; Max-Age=${Math.floor(DUREE_SESSION_MS / 1000)}; SameSite=Lax`);
}

export function effacerCookieSession(res) {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
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
