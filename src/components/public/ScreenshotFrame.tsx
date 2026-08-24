import Image from 'next/image';

/**
 * Muestra una captura del sistema sin marco de navegador.
 * La imagen se muestra completa (sin recortar) con bordes redondeados y sombra.
 */
export default function ScreenshotFrame({
  src,
  alt,
  className = '',
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border shadow-lg ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={1280}
        height={720}
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="h-auto w-full"
        priority={priority}
      />
    </div>
  );
}
