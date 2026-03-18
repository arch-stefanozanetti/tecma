import { Sheet, SheetContent } from "../../../../src/components/ui/sheet";

export function BadOperational({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">nope</SheetContent>
    </Sheet>
  );
}
