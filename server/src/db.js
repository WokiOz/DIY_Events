import pg from 'pg';
import { readFile } from 'node:fs/promises';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

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
  console.log('Schéma à jour.');
}
