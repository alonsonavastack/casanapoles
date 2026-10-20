import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Menu } from './modelos';

const API = 'api/index.php';
const LLAVE_TOKEN = 'casa-napoles-token';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);

  readonly menu = signal<Menu | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  private readonly token = signal<string | null>(leerToken());
  readonly conSesion = computed(() => this.token() !== null);

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.menu.set(await firstValueFrom(this.http.get<Menu>(`${API}?accion=menu`)));
    } catch (e) {
      this.error.set(mensaje(e, 'No se pudo cargar el menú. Revisa tu conexión y vuelve a intentar.'));
    } finally {
      this.cargando.set(false);
    }
  }

  async entrar(password: string): Promise<void> {
    const r = await firstValueFrom(this.http.post<{ token: string }>(`${API}?accion=login`, { password }));
    try { sessionStorage.setItem(LLAVE_TOKEN, r.token); } catch { /* sin almacenamiento: la sesión dura lo que la pestaña */ }
    this.token.set(r.token);
  }

  salir(): void {
    try { sessionStorage.removeItem(LLAVE_TOKEN); } catch { /* nada que borrar */ }
    this.token.set(null);
  }

  async guardar(menu: Menu): Promise<string> {
    const r = await this.conToken(() =>
      firstValueFrom(this.http.post<{ actualizado: string }>(`${API}?accion=guardar`, menu, { headers: this.cabeceras() })),
    );
    this.menu.set({ ...structuredClone(menu), actualizado: r.actualizado });
    return r.actualizado;
  }

  async subirImagen(archivo: Blob, nombre: string): Promise<string> {
    const datos = new FormData();
    datos.append('imagen', archivo, nombre);
    const r = await this.conToken(() =>
      firstValueFrom(this.http.post<{ url: string }>(`${API}?accion=subir`, datos, { headers: this.cabeceras() })),
    );
    return r.url;
  }

  /** Cierra la sesión si el servidor responde 401, para que el panel vuelva a pedir la contraseña. */
  private async conToken<T>(peticion: () => Promise<T>): Promise<T> {
    try {
      return await peticion();
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 401) this.salir();
      throw e;
    }
  }

  private cabeceras(): HttpHeaders {
    const t = this.token() ?? '';
    // X-Token es respaldo: algunos hostings quitan la cabecera Authorization antes de llegar a PHP.
    return new HttpHeaders({ Authorization: `Bearer ${t}`, 'X-Token': t });
  }
}

function leerToken(): string | null {
  try {
    const t = sessionStorage.getItem(LLAVE_TOKEN);
    const vence = Number(t?.split('.')[0]);
    return t && vence > Date.now() / 1000 ? t : null;
  } catch {
    return null;
  }
}

export function mensaje(e: unknown, porDefecto: string): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'No hay conexión con el servidor.';
    if (typeof e.error?.error === 'string') return e.error.error;
  }
  return porDefecto;
}
