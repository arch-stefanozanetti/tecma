/**
 * Logo Tecma — simbolo usato in login, sidebar e in giro per l'app.
 * SVG inline per ridimensionamento via className (es. h-12 w-12, h-24 w-24).
 */
import { cn } from "../lib/utils";

export interface LogoTecmaProps {
  className?: string;
  /** Dimensione in pixel (default 48). Ignorata se usi className per size. */
  size?: number;
  /** Colore fill (default #1E2020). Passa "currentColor" per adattarsi al testo. */
  fill?: string;
}

export function LogoTecma({ className, size = 48, fill = "#1E2020" }: LogoTecmaProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d="M25.7243 9.50735V33.5937C25.7243 35.4094 25.9437 36.5101 26.3905 36.9691C27.2131 37.6297 28.2604 37.9444 29.3109 37.8464H30.4766V38.6588H16.2076V37.8464H17.4261C18.8355 37.8464 19.8429 37.4768 20.4399 36.7254C20.7974 36.2948 20.9802 35.2631 20.9802 33.5856V11.193H16.9224C15.8115 11.1515 14.6997 11.247 13.6121 11.4773C12.7352 11.7689 11.9703 12.3252 11.4228 13.0695C10.759 13.9976 10.3922 15.1051 10.3708 16.2459H9.37158V9.34082H25.7568"
        fill={fill}
      />
      <path
        d="M30.5334 9.34082H38.6286V16.2459H38.0721C37.9632 15.4233 37.7375 14.6204 37.4019 13.8616C37.1335 13.2475 36.7228 12.7062 36.2036 12.2824C35.6845 11.8586 35.0719 11.5645 34.4165 11.4245C33.5973 11.2374 32.7587 11.1488 31.9185 11.1605H30.4766"
        fill={fill}
      />
    </svg>
  );
}
