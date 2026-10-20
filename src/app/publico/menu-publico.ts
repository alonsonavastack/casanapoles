import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MenuService } from '../menu/menu.service';
import { Categoria, GRUPOS, Grupo, Producto, normalizar, precioMinimo, textoBuscable } from '../menu/modelos';

interface Bloque {
  subtitulo: string | null;
  notas: string[];
  productos: Producto[];
}
interface Seccion {
  categoria: Categoria;
  bloques: Bloque[];
}

const TOPES = [50, 100, 200, 500];

@Component({
  selector: 'app-menu-publico',
  imports: [FormsModule, RouterLink],
  templateUrl: './menu-publico.html',
  styleUrl: './menu-publico.scss',
})
export class MenuPublico {
  protected readonly datos = inject(MenuService);
  protected readonly grupos = GRUPOS;
  protected readonly topes = TOPES;

  protected readonly busqueda = signal('');
  protected readonly grupo = signal<Grupo | null>(null);
  protected readonly categoriaId = signal<string | null>(null);
  protected readonly precioMax = signal<number | null>(null);
  protected readonly soloFoto = signal(false);
  protected readonly ampliada = signal<Producto | null>(null);

  private readonly categorias = computed(() =>
    [...(this.datos.menu()?.categorias ?? [])].sort((a, b) => a.orden - b.orden),
  );

  protected readonly categoriasVisibles = computed(() => {
    const g = this.grupo();
    return this.categorias().filter((c) => !g || c.grupo === g);
  });

  protected readonly hayFotos = computed(() => this.datos.menu()?.productos.some((p) => p.activo && p.imagen) ?? false);

  protected readonly secciones = computed<Seccion[]>(() => {
    const menu = this.datos.menu();
    if (!menu) return [];
    const texto = normalizar(this.busqueda().trim());
    const max = this.precioMax();
    const catId = this.categoriaId();

    return this.categoriasVisibles()
      .filter((c) => !catId || c.id === catId)
      .map((categoria) => {
        const productos = menu.productos.filter((p) => {
          if (!p.activo || p.categoriaId !== categoria.id) return false;
          if (this.soloFoto() && !p.imagen) return false;
          if (max !== null) {
            const precio = precioMinimo(p);
            if (precio === null || precio > max) return false;
          }
          return !texto || textoBuscable(p, categoria).includes(texto);
        });
        return { categoria, bloques: agrupar(categoria, productos) };
      })
      .filter((s) => s.bloques.length > 0);
  });

  protected readonly total = computed(() =>
    this.secciones().reduce((n, s) => n + s.bloques.reduce((m, b) => m + b.productos.length, 0), 0),
  );

  protected readonly conFiltros = computed(
    () => !!this.busqueda() || !!this.grupo() || !!this.categoriaId() || this.precioMax() !== null || this.soloFoto(),
  );

  constructor() {
    if (!this.datos.menu()) void this.datos.cargar();
  }

  protected elegirGrupo(g: Grupo | null): void {
    this.grupo.set(this.grupo() === g ? null : g);
    this.categoriaId.set(null);
  }

  protected elegirCategoria(id: string): void {
    this.categoriaId.set(this.categoriaId() === id ? null : id);
  }

  protected elegirTope(t: number): void {
    this.precioMax.set(this.precioMax() === t ? null : t);
  }

  protected limpiar(): void {
    this.busqueda.set('');
    this.grupo.set(null);
    this.categoriaId.set(null);
    this.precioMax.set(null);
    this.soloFoto.set(false);
  }
}

function agrupar(categoria: Categoria, productos: Producto[]): Bloque[] {
  const bloques: Bloque[] = [];
  for (const p of productos) {
    let b = bloques.find((x) => x.subtitulo === p.subcategoria);
    if (!b) {
      b = { subtitulo: p.subcategoria, notas: (p.subcategoria && categoria.notasSub?.[p.subcategoria]) || [], productos: [] };
      bloques.push(b);
    }
    b.productos.push(p);
  }
  return bloques;
}
