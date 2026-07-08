"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

const DialogContext = createContext(null);

// A dialog that morphs out of its trigger card via a shared layoutId.
export function MorphingDialog({ children, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const uid = useId();

  const setOpenAndNotify = useCallback(
    (next) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  return (
    <DialogContext.Provider value={{ open, setOpen: setOpenAndNotify, uid }}>
      {children}
    </DialogContext.Provider>
  );
}

export function MorphingDialogTrigger({ children, className }) {
  const { open, setOpen, uid } = useContext(DialogContext);

  return (
    <motion.button
      type="button"
      layoutId={`dialog-${uid}`}
      onClick={() => setOpen(true)}
      className={`text-left ${className ?? ""}`}
      style={{ visibility: open ? "hidden" : "visible" }}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      {children}
    </motion.button>
  );
}

export function MorphingDialogContainer({ children }) {
  const { open, setOpen, uid } = useContext(DialogContext);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;

    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        // Simple focus trap: keep tabbing inside the dialog.
        const focusables = contentRef.current?.querySelectorAll(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    contentRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <motion.div
            className="absolute inset-0 bg-white/80 backdrop-blur-sm dark:bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            ref={contentRef}
            layoutId={`dialog-${uid}`}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function MorphingDialogClose({ className }) {
  const { setOpen } = useContext(DialogContext);
  return (
    <button
      type="button"
      onClick={() => setOpen(false)}
      aria-label="Close dialog"
      className={`rounded-lg border border-neutral-200 p-2 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600 ${className ?? ""}`}
    >
      <X size={14} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}
