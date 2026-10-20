// Convierte datos/menu-casa-napoles.md en api/semilla.json, los datos iniciales del menú.
// Uso: node scripts/md-a-json.mjs [ruta-del-md]
// Los textos y precios se copian tal cual; no se corrige nada.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const rutaMd = resolve(process.argv[2] ?? `${raiz}/datos/menu-casa-napoles.md`);
const lineas = readFileSync(rutaMd, 'utf8').split('\n');

const GRUPOS = {
  comida: ['LAS ALITAS (10PZAS)', 'LAS HAMBURGUESAS', 'LOS CORTES', 'LAS PIZZAS', 'LAS PASTAS', 'LAS ENTRADAS', 'LAS ENSALADAS', 'LOS POSTRES'],
  bebidas: ['LOS TÉS', 'LOS CAFEINOSOS', 'LOS TRANQUILOS'],
  barra: ['LICORES Y CREMAS', 'LOS VINOS', 'LA TENDENCIA', 'LOS CLÁSICOS', 'LAS CERVEZAS', 'LOS TARROS', 'LAS MICHELADAS', 'LOS TRAGOS', 'LAS BOTELLAS'],
};
const grupoDe = (nombre) => Object.entries(GRUPOS).find(([, l]) => l.includes(nombre))?.[0] ?? 'comida';

const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const categorias = [];
const productos = [];
const usados = new Set();
const idUnico = (base) => {
  let id = base, n = 2;
  while (usados.has(id)) id = `${base}-${n++}`;
  usados.add(id);
  return id;
};

let cat = null;
let sub = null;
let tabla = null; // { cols: string[] }
const info = { lema: '', historia: '', horario: [], contacto: [], notaPago: '' };
let enContraportada = false;
let modoLista = null; // 'horario' | 'contacto' | 'notasBotellas'

const celdas = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const nuevaCategoria = (nombre) => {
  cat = { id: idUnico(slug(nombre)), nombre, grupo: grupoDe(nombre), notas: [], orden: categorias.length };
  categorias.push(cat);
  sub = null;
};
const ultimo = () => productos.at(-1);

for (const linea of lineas) {
  const l = linea.trim();

  if (l.startsWith('## ')) {
    tabla = null; modoLista = null;
    const nombre = l.slice(3).trim();
    if (nombre === 'Textos de la contraportada') { enContraportada = true; cat = null; continue; }
    if (enContraportada || !cat && categorias.length && !GRUPOS.comida.concat(GRUPOS.bebidas, GRUPOS.barra).includes(nombre)) {
      enContraportada = enContraportada && !['Secciones pendientes de capturar', 'Productos nuevos', 'Historial de cambios'].includes(nombre);
      cat = null;
      if (!GRUPOS.comida.concat(GRUPOS.bebidas, GRUPOS.barra).includes(nombre)) continue;
    }
    if (['Secciones pendientes de capturar', 'Productos nuevos', 'Historial de cambios'].includes(nombre)) { cat = null; enContraportada = false; continue; }
    nuevaCategoria(nombre);
    continue;
  }

  if (enContraportada) {
    if (l.startsWith('> ')) info.historia = l.slice(2);
    else if (l.startsWith('Lema:')) info.lema = l.slice(5).trim();
    else if (l === 'HORARIO DE ATENCIÓN') modoLista = 'horario';
    else if (l === 'Contacto:') modoLista = 'contacto';
    else if (l.startsWith('- ') && modoLista) info[modoLista].push(l.slice(2));
    continue;
  }
  if (!cat) continue;

  if (l.startsWith('### ')) {
    tabla = null;
    const titulo = l.slice(4).trim();
    const velvet = titulo.match(/^(.+?)\s+—\s+(\$\d+)$/);
    if (velvet) {
      sub = velvet[1];
      productos.push(nuevoProducto({ nombre: velvet[1], precios: [{ etiqueta: null, valor: velvet[2] }] }));
    } else sub = titulo;
    continue;
  }

  if (l.startsWith('|')) {
    const c = celdas(l);
    if (!tabla) { tabla = { cols: c }; continue; }
    if (c.every((x) => /^-+$/.test(x))) continue;
    productos.push(desdeFila(tabla.cols, c));
    continue;
  }
  tabla = null;
  if (!l) continue;

  // Notas y textos sueltos
  if (l.startsWith('Nota de sección:') || l.startsWith('Nota:')) {
    const texto = l.replace(/^Nota( de sección)?:\s*/, '');
    if (sub) (cat.notasSub ??= {})[sub] = [...(cat.notasSub?.[sub] ?? []), texto];
    else cat.notas.push(texto);
  } else if (l.startsWith('Nota al pie del menú:')) info.notaPago = l.replace('Nota al pie del menú:', '').trim();
  else if (l.startsWith('Presentación:')) cat.notas.push(l.replace('Presentación:', '').trim());
  else if (l.startsWith('Salsas de los boneless:')) {
    const p = productos.find((x) => x.categoriaId === cat.id && x.nombre.startsWith('Boneless'));
    p.opciones = l.split(':')[1].split('/').map((s) => s.trim()).filter(Boolean);
  } else if (l.startsWith('Sabores del capuccino')) {
    const p = productos.find((x) => x.categoriaId === cat.id && x.nombre === 'CAPUCCINO');
    p.opciones = l.split(':')[1].split(',').map((s) => s.trim());
  } else if (l.startsWith('Sabores:')) {
    ultimo().opciones = l.slice(8).split(',').map((s) => s.trim());
  } else if (l.startsWith('Soda gourmet')) {
    ultimo().descripcion = l;
  } else if (l.startsWith('Notas al pie')) {
    modoLista = 'notasCat';
  } else if (l.startsWith('- ') && modoLista === 'notasCat') {
    cat.notas.push(l.slice(2));
  }
  // Las líneas explicativas del md ("Clericot (aparece…)", "Garrafas (…)", "Cada grupo…") no son texto del menú.
}

function nuevoProducto(campos) {
  return {
    id: idUnico(slug(`${cat.id}-${campos.nombre}-${campos.detalle ?? ''}`)),
    categoriaId: cat.id,
    subcategoria: sub,
    nombre: campos.nombre,
    detalle: campos.detalle ?? null,
    descripcion: campos.descripcion ?? null,
    precios: campos.precios ?? [],
    opciones: campos.opciones ?? [],
    imagen: null,
    activo: true,
  };
}

function desdeFila(cols, c) {
  const campos = { precios: [] };
  cols.forEach((col, i) => {
    const v = c[i] ?? '';
    if (col === 'Producto') campos.nombre = v;
    else if (col === 'Sabor') { campos.nombre = sub ?? cat.nombre; campos.opciones = v.split(',').map((s) => s.trim()); }
    else if (col === 'Descripción') campos.descripcion = v || null;
    else if (['Gramaje', 'Variante', 'Presentación'].includes(col)) campos.detalle = v || null;
    else if (col === 'Opciones') campos.opciones = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (v) campos.precios.push({ etiqueta: col === 'Precio' ? null : col, valor: v });
  });
  return nuevoProducto(campos);
}

const menu = { version: 1, actualizado: new Date().toISOString(), info, categorias, productos };
writeFileSync(`${raiz}/api/semilla.json`, JSON.stringify(menu, null, 2) + '\n');
console.log(`Listo: ${categorias.length} categorías y ${productos.length} productos en api/semilla.json`);
