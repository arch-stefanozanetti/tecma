import { Check, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";

export type AgentToolLogEntry = { name: string; ok: boolean; error?: string };

export interface AgentExecutionResult {
  summary: string;
  toolLog: AgentToolLogEntry[];
  steps: number;
}

export interface AgentExecutionResultSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AgentExecutionResult | null;
}

export function AgentExecutionResultSheet({ open, onOpenChange, result }: AgentExecutionResultSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg" data-testid="agent-execution-sheet">
        <div className="flex min-h-0 flex-1 flex-col gap-0 p-6 pt-10">
          <SheetHeader className="shrink-0 space-y-1 pr-8 text-left">
            <SheetTitle>Esecuzione completata</SheetTitle>
            <SheetDescription>
              Riepilogo dell&apos;agente AI e delle attività eseguite sul workspace.
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="mt-4 min-h-0 flex-1 space-y-4">
            {result && (
              <>
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Sintesi
                  </h4>
                  <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed text-foreground">
                    {result.summary || "—"}
                  </div>
                </div>
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Attività eseguite
                  </h4>
                  <p className="mb-2 text-xs text-muted-foreground">Passi agente: {result.steps}</p>
                  <ul className="space-y-2">
                    {result.toolLog.length === 0 ? (
                      <li className="text-sm text-muted-foreground">Nessun tool registrato.</li>
                    ) : (
                      result.toolLog.map((t, i) => (
                        <li
                          key={`${i}-${t.name}`}
                          className="flex gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                        >
                          <span className="mt-0.5 shrink-0" aria-hidden>
                            {t.ok ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="font-mono text-xs font-medium text-foreground">{t.name}</span>
                            {t.error && (
                              <span className="mt-0.5 block text-xs text-destructive">{t.error}</span>
                            )}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            )}
          </SheetBody>
          <SheetFooter className="mt-4 shrink-0 border-t border-border pt-4">
            <Button type="button" className="min-h-11 w-full rounded-lg sm:w-auto" onClick={() => onOpenChange(false)}>
              Chiudi
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
