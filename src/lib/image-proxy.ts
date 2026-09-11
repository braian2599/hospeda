// ==================== Proxy de imágenes de R2 para pantallas internas ====================
// R2 no manda Access-Control-Allow-Origin para el dominio de la app, y
// además algunas redes (filtros de contenido de bibliotecas/escuelas,
// bloqueadores de anuncios en equipos compartidos) bloquean el acceso
// directo del navegador a dominios genéricos de almacenamiento en la nube
// (p.ej. *.r2.dev) — la app carga bien porque viene de nuestro dominio,
// pero una imagen suelta que apunta a otro dominio queda bloqueada. Por eso
// una imagen que se ve perfecto en una red puede no aparecer en otra.
//
// Esta función arma la URL del proxy propio (/api/uploads/imagen-remota):
// el navegador del visitante solo necesita hablar con nuestro dominio, y es
// el servidor el que va a buscar la imagen a R2. Usar SOLO en pantallas
// internas de la app (Configuración, Comprobantes) — en la landing pública
// conviene seguir sirviendo directo desde R2/CDN por velocidad, ahí no vale
// la pena el viaje extra por nuestro servidor en cada carga de página.
export function proxiedImageUrl(url: string): string {
  return `/api/uploads/imagen-remota?url=${encodeURIComponent(url)}`;
}
