import { Toast as BaseToast } from "@base-ui/react/toast";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastPortal,
  ToastTitle,
  ToastViewport,
} from "~/components/ui/toast";

/**
 * Renders whatever `useToastManager().add()` has queued. Must sit inside the
 * `ToastProvider` that `root.tsx` wraps the app in.
 */
export function Toaster() {
  const { toasts } = BaseToast.useToastManager();

  return (
    <ToastPortal>
      <ToastViewport>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} swipeDirection="right">
            <div className="grid gap-1">
              <ToastTitle />
              <ToastDescription />
            </div>
            <ToastClose />
          </Toast>
        ))}
      </ToastViewport>
    </ToastPortal>
  );
}
