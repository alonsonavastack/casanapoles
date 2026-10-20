/**
 * Reduce la foto en el navegador antes de subirla: máximo 1600 px por lado, en WEBP.
 * Una foto de celular de 5 MB queda en unos 200–400 KB, que carga rápido en el menú.
 */
export async function prepararImagen(archivo: File, ladoMax = 1600): Promise<{ blob: Blob; nombre: string }> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext('2d')!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/webp', 0.85));
  // Safari viejo no exporta WEBP: en ese caso se manda JPG.
  if (blob && blob.type === 'image/webp') return { blob, nombre: 'foto.webp' };
  const jpg = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.85));
  return { blob: jpg ?? archivo, nombre: 'foto.jpg' };
}
