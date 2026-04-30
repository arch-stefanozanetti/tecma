import { SidePanel, SidePanelContent } from "../../../../src/components/ui/side-panel";

export function OperationalPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SidePanel variant="operational" open={open} onOpenChange={onOpenChange}>
      <SidePanelContent side="right" size="md">
        <div>Ok</div>
      </SidePanelContent>
    </SidePanel>
  );
}
