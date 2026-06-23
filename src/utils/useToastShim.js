// v3 compatibility shim for Chakra v2's `useToast()`.
//
// v2's `useToast()` returned a *callable* function (`toast({...})`) that also
// carried methods: `.closeAll()`, `.close(id)`, `.update(id, opts)`,
// `.isActive(id)`. v3's toaster (createToaster, from @zag-js/toast) exposes a
// different surface: `create`, `update`, `remove` (remove() with no arg clears
// all), `dismiss`, `isVisible`. This shim returns a v2-shaped callable so the
// ~40 call sites and the apiToast wrapper keep working unchanged.
//
// v2 call:  toast({ title, description, status, duration, isClosable })
//   → status ("success"|"error"|"warning"|"info") maps to v3 `type`.
import { toaster } from "@/components/ui/toaster";

export function useToast() {
  const toast = (options = {}) => {
    const { status, duration, ...rest } = options;
    return toaster.create({
      ...rest,
      type: status || "info",
      duration: duration ?? 3000,
    });
  };

  // v2 method surface → v3 toaster
  toast.closeAll = () => toaster.remove();
  toast.close = (id) => toaster.remove(id);
  toast.update = (id, options) => toaster.update(id, options);
  toast.isActive = (id) => toaster.isVisible(id);

  return toast;
}
