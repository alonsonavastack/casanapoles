// Arma dist/para-cpanel: todo lo que se sube a la carpeta del sitio en cPanel.
// Se ejecuta solo después de `npm run build`.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const salida = `${raiz}/dist/para-cpanel`;
rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });

// 1. La app de Angular ya compilada.
cpSync(`${raiz}/dist/restaurante/browser`, salida, { recursive: true });

// 2. La API. No incluye api/datos/*.json: así subir una versión nueva nunca borra el menú que editaste en línea.
mkdirSync(`${salida}/api/datos`, { recursive: true });
for (const f of ['index.php', '.htaccess', 'semilla.json']) cpSync(`${raiz}/api/${f}`, `${salida}/api/${f}`);
cpSync(`${raiz}/api/datos/.htaccess`, `${salida}/api/datos/.htaccess`);
const conConfig = existsSync(`${raiz}/api/config.php`);
if (conConfig) cpSync(`${raiz}/api/config.php`, `${salida}/api/config.php`);

// 3. La carpeta de imágenes, solo con su protección (las fotos viven en el servidor).
mkdirSync(`${salida}/uploads`, { recursive: true });
cpSync(`${raiz}/servidor/uploads/.htaccess`, `${salida}/uploads/.htaccess`);

console.log(`\nListo para subir: dist/para-cpanel${conConfig ? '' : '\nAVISO: falta api/config.php. Corre  npm run clave -- "tu contraseña"  antes de subir.'}`);
