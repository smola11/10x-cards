import * as React from "react";

import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastProps,
} from "@/components/ui/toast";

type ToastActionElement = React.ReactElement<typeof ToastAction>;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

interface ToastState {
  toasts: ToasterToast[];
}

const TOAST_LIMIT = 4;
const TOAST_REMOVE_DELAY = 1000;

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

type ActionType = typeof actionTypes;

type Action =
  | { type: ActionType["ADD_TOAST"]; toast: ToasterToast }
  | { type: ActionType["UPDATE_TOAST"]; toast: Partial<ToasterToast>; toastId: string }
  | { type: ActionType["DISMISS_TOAST"]; toastId?: string }
  | { type: ActionType["REMOVE_TOAST"]; toastId?: string };

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

let memoryState: ToastState = { toasts: [] };

const listeners = new Set<(state: ToastState) => void>();

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case actionTypes.ADD_TOAST: {
      const { toast } = action;

      if (state.toasts.length >= TOAST_LIMIT) {
        state.toasts.shift();
      }

      return {
        toasts: [...state.toasts, toast],
      };
    }

    case actionTypes.UPDATE_TOAST: {
      const { toastId, toast } = action;
      return {
        toasts: state.toasts.map((item) => (item.id === toastId ? { ...item, ...toast } : item)),
      };
    }

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => addToRemoveQueue(toast.id));
      }

      return {
        toasts: state.toasts.map((toast) =>
          toast.id === toastId || toastId === undefined ? { ...toast, open: false } : toast
        ),
      };
    }

    case actionTypes.REMOVE_TOAST: {
      return {
        toasts: action.toastId ? state.toasts.filter((toast) => toast.id !== action.toastId) : [],
      };
    }
  }
}

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
}

type ToastOptions = Omit<ToasterToast, "id"> & { id?: string };

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

function createToast(toast: ToastOptions): string {
  const id = toast.id ?? generateId();
  const duration = toast.duration ?? 5000;

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...toast,
      id,
      open: true,
      duration,
    },
  });

  return id;
}

function updateToast(toastId: string, toast: Partial<ToasterToast>) {
  dispatch({ type: actionTypes.UPDATE_TOAST, toastId, toast });
}

function dismissToast(toastId?: string) {
  dispatch({ type: actionTypes.DISMISS_TOAST, toastId });
}

type UseToastReturn = ToastState & {
  toast: typeof createToast;
  updateToast: typeof updateToast;
  dismiss: typeof dismissToast;
};

function useToast(): UseToastReturn {
  const [state, setState] = React.useState<ToastState>(memoryState);

  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    ...state,
    toast: createToast,
    updateToast,
    dismiss: dismissToast,
  };
}

function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((toast) => {
        const { id, title, description, action, ...rest } = toast;
        return (
          <Toast key={id} {...rest} onOpenChange={(open) => (!open ? dismissToast(id) : void 0)}>
            <div className="flex w-full flex-col gap-1 pr-6">
              {title ? <ToastTitle>{title}</ToastTitle> : null}
              {description ? <ToastDescription>{description}</ToastDescription> : null}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

export { Toaster, dismissToast as dismiss, createToast as toast, updateToast, useToast };
export type { ToastActionElement, ToasterToast };
