// La cara de Hospi. Se usa en tres lugares con el mismo marcado: la esquina,
// el encabezado del chat y la copia que vuela entre los dos. Que sean el mismo
// dibujo es lo que hace que el vuelo se vea continuo y no como un cambio.

import estilos from './hospi.module.css';

export default function HospiCara({ className }: { className?: string }) {
  return (
    <div className={`${estilos.hospi} ${estilos.cara} ${className || ''}`} aria-hidden="true">
      <div className={estilos.gorro} />
      <div className={`${estilos.oreja} ${estilos.orejaIzq}`} />
      <div className={`${estilos.oreja} ${estilos.orejaDer}`} />
      <div className={estilos.cabeza} />
      <div className={`${estilos.ojo} ${estilos.ojoIzq}`} />
      <div className={`${estilos.ojo} ${estilos.ojoDer}`} />
      <div className={estilos.sonrisa} />
    </div>
  );
}
