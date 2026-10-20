// Imita api/index.php en tu Mac (no tienes PHP instalado) para probar con `npm start`.
// Lee la misma api/config.php y guarda todo en .local/, nunca en api/datos.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { extname, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const dirLocal = `${raiz}/.local`;
const archivoMenu = `${dirLocal}/menu.json`;
const dirImagenes = `${dirLocal}/uploads`;
mkdirSync(dirImagenes, { recursive: true });

const configPhp = existsSync(`${raiz}/api/config.php`) ? readFileSync(`${raiz}/api/config.php`, 'utf8') : '';
const constante = (n) => configPhp.match(new RegExp(`const ${n} = '([^']+)'`))?.[1];
const SAL = constante('CLAVE_SAL'), HASH = constante('CLAVE_HASH'), SECRETO = constante('SECRETO');
if (!HASH) {
  console.error('Falta api/config.php. Créala con:  npm run clave -- "tu contraseña"');
  process.exit(1);
}

const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const iguales = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const firma = (v) => createHmac('sha256', SECRETO).update(v).digest('hex');

function responder(res, codigo, datos) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(datos));
}
async function cuerpo(req) {
  const partes = [];
  for await (const p of req) partes.push(p);
  return Buffer.concat(partes);
}
function tokenValido(req) {
  const cab = req.headers['authorization'] ?? '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : (req.headers['x-token'] ?? '');
  const [vence, f = ''] = token.split('.');
  return /^\d+$/.test(vence ?? '') && Number(vence) > Date.now() / 1000 && iguales(firma(vence), f);
}
function leerMenu() {
  if (!existsSync(archivoMenu)) copyFileSync(`${raiz}/api/semilla.json`, archivoMenu);
  return JSON.parse(readFileSync(archivoMenu, 'utf8'));
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  if (url.pathname.startsWith('/uploads/')) {
    const ruta = resolve(dirImagenes, url.pathname.slice(9));
    if (!ruta.startsWith(dirImagenes) || !existsSync(ruta)) return responder(res, 404, { error: 'No existe' });
    res.writeHead(200, { 'Content-Type': { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[extname(ruta)] });
    return createReadStream(ruta).pipe(res);
  }
  if (url.pathname !== '/api/index.php') return responder(res, 404, { error: 'Ruta no encontrada' });
  const accion = url.searchParams.get('accion');

  if (accion === 'menu' && req.method === 'GET') return responder(res, 200, leerMenu());

  if (accion === 'login' && req.method === 'POST') {
    const { password = '' } = JSON.parse((await cuerpo(req)).toString() || '{}');
    await new Promise((r) => setTimeout(r, 400));
    const hash = createHash('sha256').update(SAL + password).digest('hex');
    if (!password || !iguales(hash, HASH)) return responder(res, 401, { error: 'Contraseña incorrecta' });
    const vence = String(Math.floor(Date.now() / 1000) + 60 * 60 * 12);
    return responder(res, 200, { token: `${vence}.${firma(vence)}`, vence: Number(vence) });
  }

  if ((accion === 'guardar' || accion === 'subir') && req.method === 'POST' && !tokenValido(req)) {
    return responder(res, 401, { error: 'Tu sesión venció. Vuelve a entrar.' });
  }

  if (accion === 'guardar' && req.method === 'POST') {
    const menu = JSON.parse((await cuerpo(req)).toString());
    if (!menu?.categorias || !Array.isArray(menu.productos)) return responder(res, 400, { error: 'El menú recibido no tiene categorías y productos.' });
    menu.actualizado = new Date().toISOString();
    writeFileSync(archivoMenu, JSON.stringify(menu, null, 2));
    return responder(res, 200, { ok: true, actualizado: menu.actualizado });
  }

  if (accion === 'subir' && req.method === 'POST') {
    // Lector mínimo de multipart: toma el primer archivo del campo "imagen".
    const tipoCab = req.headers['content-type'] ?? '';
    const limite = tipoCab.match(/boundary=(.+)$/)?.[1];
    const datos = await cuerpo(req);
    if (!limite) return responder(res, 400, { error: 'No llegó ninguna imagen.' });
    const sep = Buffer.from(`--${limite}`);
    let inicio = datos.indexOf(sep);
    while (inicio !== -1) {
      const fin = datos.indexOf(sep, inicio + sep.length);
      if (fin === -1) break;
      const parte = datos.subarray(inicio + sep.length + 2, fin - 2);
      const corte = parte.indexOf('\r\n\r\n');
      const cabeceras = parte.subarray(0, corte).toString();
      if (/name="imagen"/.test(cabeceras)) {
        const archivo = parte.subarray(corte + 4);
        const tipo = cabeceras.match(/Content-Type:\s*(\S+)/i)?.[1];
        if (!TIPOS[tipo]) return responder(res, 400, { error: 'Solo se aceptan imágenes JPG, PNG o WEBP.' });
        if (archivo.length > 6 * 1024 * 1024) return responder(res, 400, { error: 'La imagen pesa más de 6 MB.' });
        const nombre = `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(8).toString('hex')}.${TIPOS[tipo]}`;
        writeFileSync(`${dirImagenes}/${nombre}`, archivo);
        return responder(res, 200, { url: `uploads/${nombre}` });
      }
      inicio = fin;
    }
    return responder(res, 400, { error: 'No llegó ninguna imagen.' });
  }

  responder(res, 404, { error: 'Acción no encontrada' });
}).listen(8787, () => console.log('API local lista en http://localhost:8787 (datos en .local/)'));
