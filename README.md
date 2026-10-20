# Casa Nápoles · Menú en línea

Menú público con filtros y panel para editar productos y subir fotos.
Angular 22 en el navegador y un archivo PHP pequeño en cPanel que guarda el menú y las imágenes.

- Menú público: `https://einsteinmx.com/restaurante/`
- Panel: `https://einsteinmx.com/restaurante/#/admin`

## Cómo está armado

| Carpeta | Qué hay |
|---|---|
| `src/` | La app de Angular (menú público en `publico/`, panel en `admin/`). |
| `api/index.php` | La API que corre en cPanel: leer menú, entrar, guardar y subir fotos. |
| `api/semilla.json` | El menú inicial, generado desde `datos/menu-casa-napoles.md`. |
| `servidor/uploads/.htaccess` | Protección de la carpeta de fotos en el hosting. |
| `scripts/` | Utilidades: pasar el md a JSON, crear la contraseña, servidor de prueba y empaquetado. |

En el hosting el menú se guarda en `api/datos/menu.json` y las fotos en `uploads/`.
Cada vez que guardas, se deja un respaldo en `api/datos/respaldo-*.json` (los últimos 20).

## Primera vez en cPanel

1. Elige tu contraseña del panel (mínimo 8 caracteres). Reemplaza la de prueba:
   ```bash
   npm run clave -- "tu contraseña"
   ```
2. Genera el paquete:
   ```bash
   npm run build
   ```
3. En el Administrador de archivos de cPanel crea la carpeta `restaurante` dentro de la carpeta de **einsteinmx.com**
   (la que sirve `https://einsteinmx.com/`; normalmente `public_html` o `einsteinmx.com`).
4. Sube **todo el contenido** de `dist/para-cpanel/` a esa carpeta `restaurante`.
   Lo más fácil: comprime `dist/para-cpanel` en un .zip, súbelo con **Cargar** y usa **Extraer**.
   Revisa que quedaron los archivos ocultos `.htaccess` (en Configuración de cPanel activa «Mostrar archivos ocultos»).
5. Abre `https://einsteinmx.com/restaurante/` y luego `#/admin` para entrar.

## Actualizar la app más adelante

Repite `npm run build` y sube de nuevo `dist/para-cpanel/`. El paquete **no** lleva `api/datos/` ni fotos,
así que subirlo nunca borra el menú ni las imágenes que ya editaste en línea.

## Probar en tu Mac

Tu Mac no tiene PHP, así que hay un servidor de prueba en Node que hace lo mismo que `api/index.php`.
Abre dos terminales en esta carpeta:

```bash
npm run api
```

```bash
npm start
```

Luego abre `http://localhost:4200`. Lo que guardes en prueba queda en `.local/` y no toca el hosting.

## Volver a cargar el menú desde el md

Si cambias `datos/menu-casa-napoles.md` antes de publicar:

```bash
npm run datos
```

Ojo: una vez publicado, el menú se edita desde el panel. Regenerar la semilla solo afecta a una instalación nueva.
