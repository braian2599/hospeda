import Image from 'next/image';

/**
 * Browser-style frame for screenshots.
 * Renders 3 colored dots + a fake `hospeda.app` URL bar above the image.
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
      className={`overflow-hidden rounded-xl border border-border bg-card shadow-lg ${className}`}
    >
      {/* Browser bar */}
      <div className="flex items-center gap-1.5 border-b border-border bg-secondary/50 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400" />
        <span className="h-3 w-3 rounded-full bg-yellow-400" />
        <span className="h-3 w-3 rounded-full bg-green-400" />
        <div className="ml-3 hidden h-5 flex-1 items-center rounded-md bg-background px-3 text-[11px] text-muted-foreground sm:flex">
          hospeda.app
        </div>
      </div>
      {/* Screenshot */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover object-top"
          priority={priority}
        />
      </div>
    </div>
  );
}
