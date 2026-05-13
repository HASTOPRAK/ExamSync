import { useCallback, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Drop-in replacement for window.confirm().
 *
 * Usage:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   // Render <ConfirmDialog /> somewhere in the JSX tree.
 *   // Then call:
 *   const ok = await confirm({ title: "...", description: "..." });
 *   if (!ok) return;
 */
export function useConfirm() {
  const [pending, setPending] = useState(null);

  const confirm = useCallback(
    ({ title, description, confirmLabel = "Confirm", destructive = false }) =>
      new Promise((resolve) => {
        setPending({ title, description, confirmLabel, destructive, resolve });
      }),
    [],
  );

  const handleConfirm = () => {
    pending?.resolve(true);
    setPending(null);
  };

  const handleCancel = () => {
    pending?.resolve(false);
    setPending(null);
  };

  const ConfirmDialog = (
    <AlertDialog
      open={!!pending}
      onOpenChange={(open) => { if (!open) handleCancel(); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          {pending?.description && (
            <AlertDialogDescription>{pending.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn(
              pending?.destructive &&
                buttonVariants({ variant: "destructive" }),
            )}
          >
            {pending?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}
