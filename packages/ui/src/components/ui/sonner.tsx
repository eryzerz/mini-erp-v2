"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          // Solid white toasts in every theme; the icon carries the
          // semantic color.
          "--normal-bg": "#ffffff",
          "--normal-text": "#09090b",
          "--normal-border": "hsl(var(--border))",
          "--success-bg": "#ffffff",
          "--success-text": "#09090b",
          "--error-bg": "#ffffff",
          "--error-text": "#09090b",
          "--info-bg": "#ffffff",
          "--info-text": "#09090b",
          "--warning-bg": "#ffffff",
          "--warning-text": "#09090b",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
