import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      aria-busy="true"
      className={cn("shimmer-bg rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
