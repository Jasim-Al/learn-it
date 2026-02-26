import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const glassCardVariants = cva(
  "rounded-2xl border bg-white/10 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:bg-black/20 dark:border-white/10 border-white/20",
  {
    variants: {
      variant: {
        default: "",
        highlight: "bg-white/30 dark:bg-white/5 border-white/40 dark:border-white/20",
        dark: "bg-black/10 dark:bg-black/40 border-black/10 dark:border-white/5 shadow-2xl backdrop-blur-3xl",
      },
      padding: {
        none: "",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      }
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
)

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  asChild?: boolean
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant, padding, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div"
    return (
      <Comp
        className={cn(glassCardVariants({ variant, padding, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
GlassCard.displayName = "GlassCard"

export { GlassCard, glassCardVariants }
