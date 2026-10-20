import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { prepararImagen } from '../menu/imagen';
import { MenuService, mensaje } from '../menu/menu.service';
import { Categoria, GRUPOS, Menu, Producto, normalizar, textoBuscable } from '../menu/modelos';

type Pestana = 'productos' | 'categorias' | 'info';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin {
  protected readonly datos = inject(MenuService);
  protected readonly grupos = GRUPOS;

  // Sesión
  protected password = '';
  protected readonly entrando = signal(false);
  protected readonly errorLogin = signal<string | null>(null);

  // Copia de trabajo: nada llega al servidor hasta "Guardar cambios".
  protected readonly borrador = signal<Menu | null>(null);
  private readonly cambios = signal(0);
  private readonly guardadoEn = signal(0);
  protected readonly sinGuardar = computed(() => this.cambios() > this.guardadoEn());
  protected readonly guardando = signal(false);
  protected readonly aviso = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  protected readonly pestana = signal<Pestana>('productos');

  // Filtros de la lista
  protected readonly busqueda = signal('');
  protected readonly filtroCategoria = signal('');
  protected readonly filtroEstado = signal<'' | 'sin-foto' | 'con-foto' | 'ocultos'>('');

  protected readonly seleccionId = signal<string | null>(null);
  protected readonly confirmarBorrar = signal(false);
  protected readonly subiendo = signal(false);

  protected readonly categorias = computed(() => {
    this.cambios();
    return [...(this.borrador()?.categorias ?? [])].sort((a, b) => a.orden - b.orden);
  });

  protected readonly productosFiltrados = computed(() => {
    this.cambios();
    const menu = this.borrador();
    if (!menu) return [];
    const texto = normalizar(this.busqueda().trim());
    const cat = this.filtroCategoria();
    const estado = this.filtroEstado();
    const orden = new Map(this.categorias().map((c, i) => [c.id, i]));
    return menu.productos
      .filter((p) => {
        if (cat && p.categoriaId !== cat) return false;
        if (estado === 'sin-foto' && p.imagen) return false;
        if (estado === 'con-foto' && !p.imagen) return false;
        if (estado === 'ocultos' && p.activo) return false;
        return !texto || textoBuscable(p, this.categoria(p.categoriaId)).includes(texto);
      })
      .sort((a, b) => (orden.get(a.categoriaId) ?? 0) - (orden.get(b.categoriaId) ?? 0));
  });

  protected readonly seleccionado = computed(() => {
    this.cambios();
    return this.borrador()?.productos.find((p) => p.id === this.seleccionId()) ?? null;
  });

  protected readonly subcategorias = computed(() => {
    this.cambios();
    const p = this.seleccionado();
    const menu = this.borrador();
    if (!p || !menu) return [];
    return [...new Set(menu.productos.filter((x) => x.categoriaId === p.categoriaId && x.subcategoria).map((x) => x.subcategoria!))];
  });

  protected readonly resumen = computed(() => {
    this.cambios();
    const productos = this.borrador()?.productos ?? [];
    return { total: productos.length, conFoto: productos.filter((p) => p.imagen).length };
  });

  constructor() {
    void this.iniciar();
    // Avisa antes de cerrar la pestaña con cambios sin guardar.
    addEventListener('beforeunload', (e) => {
      if (this.sinGuardar()) e.preventDefault();
    });
  }

  private async iniciar(): Promise<void> {
    if (!this.datos.menu()) await this.datos.cargar();
    this.reiniciarBorrador();
  }

  private reiniciarBorrador(): void {
    const m = this.datos.menu();
    this.borrador.set(m ? structuredClone(m) : null);
    this.guardadoEn.set(this.cambios());
  }

  /** Cualquier edición en un formulario pasa por aquí para marcar cambios pendientes. */
  protected marcar(): void {
    this.cambios.update((n) => n + 1);
    this.aviso.set(null);
  }

  protected categoria(id: string): Categoria | undefined {
    return this.borrador()?.categorias.find((c) => c.id === id);
  }

  // ---------- Sesión ----------
  protected async entrar(): Promise<void> {
    this.entrando.set(true);
    this.errorLogin.set(null);
    try {
      await this.datos.entrar(this.password);
      this.password = '';
    } catch (e) {
      this.errorLogin.set(mensaje(e, 'No se pudo entrar.'));
    } finally {
      this.entrando.set(false);
    }
  }

  // ---------- Guardar ----------
  protected async guardar(): Promise<void> {
    const menu = this.borrador();
    if (!menu) return;
    this.guardando.set(true);
    try {
      const marca = this.cambios();
      await this.datos.guardar(menu);
      this.guardadoEn.set(marca);
      this.aviso.set({ tipo: 'ok', texto: 'Cambios guardados. El menú público ya los muestra.' });
    } catch (e) {
      this.aviso.set({ tipo: 'error', texto: mensaje(e, 'No se pudieron guardar los cambios. Vuelve a intentar.') });
    } finally {
      this.guardando.set(false);
    }
  }

  protected descartar(): void {
    this.reiniciarBorrador();
    this.seleccionId.set(null);
    this.aviso.set({ tipo: 'ok', texto: 'Cambios descartados.' });
  }

  // ---------- Productos ----------
  protected seleccionar(p: Producto): void {
    this.seleccionId.set(p.id);
    this.confirmarBorrar.set(false);
  }

  protected agregarProducto(): void {
    const menu = this.borrador();
    if (!menu) return;
    const categoriaId = this.filtroCategoria() || this.categorias()[0]?.id;
    const nuevo: Producto = {
      id: `p-${Date.now().toString(36)}`,
      categoriaId,
      subcategoria: null,
      nombre: 'NUEVO PRODUCTO',
      detalle: null,
      descripcion: null,
      precios: [{ etiqueta: null, valor: '$' }],
      opciones: [],
      imagen: null,
      activo: true,
    };
    menu.productos.push(nuevo);
    this.busqueda.set('');
    this.filtroEstado.set('');
    this.marcar();
    this.seleccionar(nuevo);
  }

  protected duplicar(p: Producto): void {
    const menu = this.borrador()!;
    const copia = { ...structuredClone(p), id: `p-${Date.now().toString(36)}`, nombre: `${p.nombre} (copia)` };
    menu.productos.splice(menu.productos.indexOf(p) + 1, 0, copia);
    this.marcar();
    this.seleccionar(copia);
  }

  protected borrar(p: Producto): void {
    const menu = this.borrador()!;
    menu.productos = menu.productos.filter((x) => x !== p);
    this.seleccionId.set(null);
    this.confirmarBorrar.set(false);
    this.marcar();
  }

  protected mover(p: Producto, paso: -1 | 1): void {
    // Cambia el orden dentro de la misma categoría.
    const lista = this.borrador()!.productos;
    const hermanos = lista.filter((x) => x.categoriaId === p.categoriaId);
    const otro = hermanos[hermanos.indexOf(p) + paso];
    if (!otro) return;
    const i = lista.indexOf(p), j = lista.indexOf(otro);
    [lista[i], lista[j]] = [lista[j], lista[i]];
    this.marcar();
  }

  protected agregarPrecio(p: Producto): void {
    p.precios.push({ etiqueta: p.precios.length ? '' : null, valor: '$' });
    this.marcar();
  }

  protected quitarPrecio(p: Producto, i: number): void {
    p.precios.splice(i, 1);
    this.marcar();
  }

  protected textoOpciones(p: Producto): string {
    return p.opciones.join(', ');
  }

  protected cambiarOpciones(p: Producto, texto: string): void {
    p.opciones = texto.split(',').map((s) => s.trim()).filter(Boolean);
    this.marcar();
  }

  protected vacioANull(p: Producto, campo: 'detalle' | 'descripcion' | 'subcategoria'): void {
    if (!p[campo]?.trim()) p[campo] = null;
  }

  protected async subirFoto(p: Producto, evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      this.aviso.set({ tipo: 'error', texto: 'Ese archivo no es una imagen. Elige una foto JPG, PNG o WEBP.' });
      return;
    }
    this.subiendo.set(true);
    try {
      const { blob, nombre } = await prepararImagen(archivo);
      p.imagen = await this.datos.subirImagen(blob, nombre);
      this.marcar();
      this.aviso.set({ tipo: 'ok', texto: 'Foto subida. Pulsa «Guardar cambios» para publicarla.' });
    } catch (e) {
      this.aviso.set({ tipo: 'error', texto: mensaje(e, 'No se pudo subir la foto.') });
    } finally {
      this.subiendo.set(false);
    }
  }

  protected quitarFoto(p: Producto): void {
    p.imagen = null;
    this.marcar();
  }

  // ---------- Categorías ----------
  protected agregarCategoria(): void {
    const menu = this.borrador()!;
    menu.categorias.push({
      id: `c-${Date.now().toString(36)}`,
      nombre: 'NUEVA CATEGORÍA',
      grupo: 'comida',
      notas: [],
      orden: Math.max(-1, ...menu.categorias.map((c) => c.orden)) + 1,
    });
    this.marcar();
  }

  protected moverCategoria(c: Categoria, paso: -1 | 1): void {
    const lista = this.categorias();
    const otra = lista[lista.indexOf(c) + paso];
    if (!otra) return;
    [c.orden, otra.orden] = [otra.orden, c.orden];
    this.marcar();
  }

  protected cuantos(c: Categoria): number {
    return this.borrador()?.productos.filter((p) => p.categoriaId === c.id).length ?? 0;
  }

  protected borrarCategoria(c: Categoria): void {
    if (this.cuantos(c) > 0) return;
    const menu = this.borrador()!;
    menu.categorias = menu.categorias.filter((x) => x !== c);
    this.marcar();
  }

  protected lineas(lista: string[]): string {
    return lista.join('\n');
  }

  protected cambiarNotas(c: Categoria, texto: string): void {
    c.notas = aLineas(texto);
    this.marcar();
  }

  protected cambiarInfo(campo: 'horario' | 'contacto', texto: string): void {
    this.borrador()!.info[campo] = aLineas(texto);
    this.marcar();
  }
}

function aLineas(texto: string): string[] {
  return texto.split('\n').map((s) => s.trim()).filter(Boolean);
}
