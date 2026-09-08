import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { hacherMotDePasse } from './mots-de-passe.js';

// pg lit PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE dans l'environnement.
export const pool = new pg.Pool();

const COMPTES_ADMIN_INITIAUX = ['helena', 'elyan'];

export async function initDatabase() {
  for (let essai = 1; ; essai++) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (erreur) {
      if (essai >= 30) throw erreur;
      console.log(`Base indisponible (tentative ${essai}), nouvel essai dans 2 s…`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n === 0) {
    for (const nom of COMPTES_ADMIN_INITIAUX) {
      await pool.query(
        `INSERT INTO users (username, password_hash, role, must_change_password) VALUES ($1, $2, 'admin', true)`,
        [nom, hacherMotDePasse(nom)]
      );
    }
    console.log(
      `Comptes admin créés (${COMPTES_ADMIN_INITIAUX.join(', ')}), mot de passe temporaire = identifiant, à changer à la première connexion.`
    );
  }

  console.log('Schéma à jour.');
}
