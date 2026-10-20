// Genera api/config.php con la contraseña del panel de administración.
// Uso: npm run clave -- "tu contraseña"
// La contraseña no se guarda: solo su huella (sha256 con sal) y un secreto para firmar sesiones.
import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const clave = process.argv[2];
if (!clave || clave.length < 8) {
  console.error('Escribe una contraseña de al menos 8 caracteres:  npm run clave -- "mi contraseña"');
  process.exit(1);
}
const sal = randomBytes(16).toString('hex');
const secreto = randomBytes(32).toString('hex');
const hash = createHash('sha256').update(sal + clave).digest('hex');

const php = `<?php
// Generado por scripts/crear-config.mjs. No lo compartas ni lo subas a un repositorio público.
const CLAVE_SAL = '${sal}';
const CLAVE_HASH = '${hash}';
const SECRETO = '${secreto}';
`;
writeFileSync(resolve(import.meta.dirname, '../api/config.php'), php);
console.log('Listo: api/config.php creado. Esa es la contraseña para entrar al panel.');
