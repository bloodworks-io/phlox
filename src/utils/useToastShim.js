// v3 compatibility shim for Chakra v2's `useToast()`.
//
// CRITICAL: returns a STABLE (module-level) reference. The underlying `toaster`
// is a singleton, so the toast function captures no per-render state. A stable
// ref is required because many call sites put `toast` in useEffect/useCallback
// dependency arrays — an unstable function (new each render) makes those effects
// re-run every render and loop (flicker / inputs won't accept typing).
//
// v2 shape: a *callable* (`toast({...})`) carrying `.closeAll/.close/.update/.isActive`.
// v3 toaster (createToaster, @zag-js/toast): `create`, `update`, `remove` (no-arg
// = clear all), `dismiss`, `isVisible`. Map `status` → v3 `type`.
import { toaster } from "@/components/ui/toaster";

const toast = (options = {}) => {
  const { status, duration, ...rest } = options;
  return toaster.create({
    ...rest,
    type: status || "info",
    duration: duration ?? 3000,
  });
};

toast.closeAll = () => toaster.remove();
toast.close = (id) => toaster.remove(id);
toast.update = (id, options) => toaster.update(id, options);
toast.isActive = (id) => toaster.isVisible(id);

export function useToast() {
  return toast;
}
