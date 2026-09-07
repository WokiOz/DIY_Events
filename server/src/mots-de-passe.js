import crypto from 'node:crypto';

export function hacherMotDePasse(motDePasse) {
  const sel = crypto.randomBytes(16);
  const hachage = crypto.scryptSync(motDePasse, sel, 64);
  return `${sel.toString('hex')}:${hachage.toString('hex')}`;
}

export function verifierMotDePasse(motDePasse, hacheStocke) {
  const [selHex, hachageHex] = hacheStocke.split(':');
  const sel = Buffer.from(selHex, 'hex');
  const hachageAttendu = Buffer.from(hachageHex, 'hex');
  const hachageEssai = crypto.scryptSync(motDePasse, sel, 64);
  return hachageEssai.length === hachageAttendu.length && crypto.timingSafeEqual(hachageEssai, hachageAttendu);
}
