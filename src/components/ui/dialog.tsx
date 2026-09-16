"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-[#00000080] dialog-overlay-animated",
        className
      )}
      {...props}
    />
  )
}

// ==================== TAMAÑOS DE DIALOG ====================
// Los cuatro anchos que usa TODO el sistema. No agregar medidas sueltas:
// si algo no entra en ninguno, se discute y se cambia la escala acá, no en
// la pantalla que lo necesita.
//
//   chico   448px — confirmaciones, avisos, borrar algo
//   medio   512px — formularios simples de una columna
//   grande  768px — formularios con secciones o pestañas
//   trabajo 1024px — pantallas de trabajo (Nueva Reserva, editor de Tarifas)
export const ANCHOS_DIALOG = {
  chico: 'sm:max-w-md',
  medio: 'sm:max-w-lg',
  grande: 'sm:max-w-3xl',
  trabajo: 'sm:max-w-5xl',
} as const;

export type TamanoDialog = keyof typeof ANCHOS_DIALOG;

/** Alto máximo único. Los dialogs cortos igual se achican a su contenido. */
export const ALTO_DIALOG = 'max-h-[90vh]';

function DialogContent({
  className,
  children,
  showCloseButton = true,
  scrollBody = true,
  bodyClassName,
  size = 'medio',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /**
   * Ancho del dialog. SIEMPRE usar esta prop en vez de escribir un
   * `sm:max-w-*` suelto en className — el ancho a mano fue lo que dejó 8
   * medidas distintas conviviendo en el sistema.
   */
  size?: TamanoDialog
  showCloseButton?: boolean
  /**
   * Cuando el contenido no entra en el alto disponible, el scroll debe pasar
   * a un contenedor INTERNO — nunca al elemento que también posiciona la "X"
   * de cerrar, porque si no la "X" se va con el scroll. Poné scrollBody={false}
   * solo cuando el dialog arma su propio layout con header fijo + body con
   * scroll (ver CheckoutDialog/SmsVerificationDialog).
   */
  scrollBody?: boolean
  /** Clases para el contenedor interno con scroll (con scrollBody=true). Por defecto "p-6". */
  bodyClassName?: string
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex flex-col w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-lg border shadow-lg duration-200 dialog-content-animated overflow-hidden",
          ANCHOS_DIALOG[size],
          ALTO_DIALOG,
          scrollBody ? undefined : "grid gap-4 p-6",
          className
        )}
        {...props}
      >
        {scrollBody ? (
          <div data-slot="dialog-scroll-area" className={cn("overflow-y-auto p-6", bodyClassName)}>
            <div className="grid gap-4">{children}</div>
          </div>
        ) : (
          children
        )}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-3 right-3 z-10 rounded-full bg-background/90 backdrop-blur-sm p-1.5 opacity-80 shadow-sm transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
