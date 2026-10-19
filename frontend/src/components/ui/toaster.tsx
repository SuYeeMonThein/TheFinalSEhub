import { AlertCircle, CheckCircle2, Info } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

// Radix closes a toast after 5s unless a duration is given; the progress bar
// below runs for the same time and pauses while the toast is hovered.
const DEFAULT_DURATION = 5000

const variantStyles = {
  default: { Icon: Info, icon: "bg-primary/10 text-primary", accent: "bg-primary" },
  success: { Icon: CheckCircle2, icon: "bg-emerald-50 text-emerald-600", accent: "bg-emerald-500" },
  destructive: { Icon: AlertCircle, icon: "bg-red-50 text-red-600", accent: "bg-red-500" },
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={DEFAULT_DURATION}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const style = variantStyles[props.variant ?? "default"]
        const duration = props.duration ?? DEFAULT_DURATION
        return (
          <Toast key={id} {...props}>
            <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${style.accent}`} />
            <span
              aria-hidden
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.icon}`}
            >
              <style.Icon className="h-5 w-5" />
            </span>
            <div className="grid min-w-0 flex-1 gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
            {Number.isFinite(duration) && (
              <span
                aria-hidden
                className={`toast-progress absolute bottom-0 left-0 h-0.5 w-full origin-left opacity-60 ${style.accent}`}
                style={{ animationDuration: `${duration}ms` }}
              />
            )}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
