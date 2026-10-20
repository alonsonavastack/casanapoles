export type Grupo = 'comida' | 'bebidas' | 'barra';

export const GRUPOS: { id: Grupo; nombre: string }[] = [
  { id: 'comida', nombre: 'Comida' },
  { id: 'bebidas', nombre: 'Bebidas' },
  { id: 'barra', nombre: 'Barra' },
];

export interface Precio {
  /** Columna del menú: BOTELLA, COPA, CH, GDE, 500ml… null cuando es un solo precio. */
  etiqueta: string | null;
  /** Texto tal cual se imprime: "$105", "---", "65". */
  valor: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  grupo: Grupo;
  notas: string[];
  /** Notas que van debajo de un subtítulo, por ejemplo QUESOS FUNDIDOS. */
  notasSub?: Record<string, string[]>;
  orden: number;
}

export interface Producto {
  id: string;
  categoriaId: string;
  subcategoria: string | null;
  nombre: string;
  /** Gramaje, presentación o variante: "(350GRS)", "750ml", "CAMARONES". */
  detalle: string | null;
  descripcion: string | null;
  precios: Precio[];
  /** Sabores, salsas u opciones a elegir. */
  opciones: string[];
  /** Ruta relativa, por ejemplo "uploads/20261019-ab12.webp". */
  imagen: string | null;
  activo: boolean;
}

export interface InfoRestaurante {
  lema: string;
  historia: string;
  horario: string[];
  contacto: string[];
  notaPago: string;
}

export interface Menu {
  version: number;
  actualizado: string;
  info: InfoRestaurante;
  categorias: Categoria[];
  productos: Producto[];
}

/** Precio más bajo de un producto como número, para filtrar. null si no tiene precio numérico. */
export function precioMinimo(p: Producto): number | null {
  const numeros = p.precios
    .map((x) => Number(x.valor.replace(/[^0-9.]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  return numeros.length ? Math.min(...numeros) : null;
}

/** Texto sin acentos y en minúsculas, para buscar "cafe" y encontrar "CAFÉ". */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function textoBuscable(p: Producto, c?: Categoria): string {
  return normalizar([p.nombre, p.detalle, p.descripcion, p.subcategoria, c?.nombre, ...p.opciones].filter(Boolean).join(' '));
}
