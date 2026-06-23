// v3 compatibility shim for Chakra v2's `useToast()`.
//
// v2 call shape:  toast({ title, description, status, duration, isClosable })
// v3 equivalent:  toaster.create({ title, description, type, duration })
//
// Map `status` ("success"|"error"|"warning"|"info") → v3 `type`. Call sites
// keep using `const toast = useToast(); toast({...})` unchanged; only their
// import specifier changes (see the repoint script). Native v3 toaster usage
// is a later cleanup.
import { toaster } from "@/components/ui/toaster";

export function useToast() {
  return (options = {}) => {
    const { status, duration, ...rest } = options;
    toaster.create({
      ...rest,
      type: status || "info",
      duration: duration ?? 3000,
    });
  };
}
