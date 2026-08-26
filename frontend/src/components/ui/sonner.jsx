import { useTheme } from "../../contexts/ThemeContext"
import { Toaster as Sonner, toast } from "sonner"

const Toaster = ({
  ...props
}) => {
  const { isDark } = useTheme()

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--bg)] group-[.toaster]:text-[var(--text)] group-[.toaster]:border-[var(--rule)] group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-[var(--text-muted)]",
          actionButton:
            "group-[.toast]:bg-[var(--accent-burgundy)] group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-[var(--surface)] group-[.toast]:text-[var(--text-muted)]",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
