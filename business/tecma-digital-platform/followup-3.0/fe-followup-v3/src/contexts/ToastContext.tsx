import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { Snackbar } from "../components/ui/snackbar";
import type { AlertVariant } from "../components/ui/alert";

export interface ToastOptions {
  title: string;
  description?: ReactNode;
  variant?: AlertVariant;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  toastError: (message: string, description?: ReactNode) => void;
  toastSuccess: (message: string, description?: ReactNode) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (opts) => {
        if (typeof window !== "undefined") window.alert(opts.title);
      },
      toastError: (msg) => {
        if (typeof window !== "undefined") window.alert(msg);
      },
      toastSuccess: (msg) => {
        if (typeof window !== "undefined") window.alert(msg);
      },
    };
  }
  return ctx;
}

interface ToastState {
  open: boolean;
  title: string;
  description?: ReactNode;
  variant: AlertVariant;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>({
    open: false,
    title: "",
    variant: "neutral",
  });

  const hide = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    setState({
      open: true,
      title: options.title,
      description: options.description,
      variant: options.variant ?? "neutral",
    });
  }, []);

  const toastError = useCallback((message: string, description?: ReactNode) => {
    toast({ title: message, description, variant: "error" });
  }, [toast]);

  const toastSuccess = useCallback((message: string, description?: ReactNode) => {
    toast({ title: message, description, variant: "success" });
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, toastError, toastSuccess }}>
      {children}
      <Snackbar
        open={state.open}
        onClose={hide}
        title={state.title}
        description={state.description}
        variant={state.variant}
        autoHideDuration={6000}
      />
    </ToastContext.Provider>
  );
}
