import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-stack whitespace-nowrap rounded-control text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-150 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-control hover:bg-primary-hover active:bg-primary-active",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        outline: "border border-border bg-transparent hover:border-input hover:bg-accent hover:text-accent-foreground active:bg-accent-hover",
        ghost: "hover:bg-surface-hover hover:text-foreground active:bg-surface-active",
        destructive: "bg-destructive text-destructive-foreground shadow-control hover:bg-destructive-hover active:bg-destructive-hover",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-control-lg px-3 py-2",
        sm: "h-control rounded-control px-2.5 text-xs",
        lg: "h-control-xl rounded-control px-5",
        icon: "h-control-lg w-control-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
