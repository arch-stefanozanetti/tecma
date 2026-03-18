/**
 * Product Discovery (solo admin): 4 viste — Customer Needs, Opportunities, Initiatives, Features.
 * UX minimal: form feedback < 30s, tabelle semplici, dettaglio in sheet.
 */
import { useCallback, useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type {
  CustomerNeedRow,
  OpportunityRow,
  InitiativeRow,
  FeatureRow,
} from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Plus, MessageSquare, Target, LayoutList, Layers, TrendingUp, AlertTriangle } from "lucide-react";
import {
  SEGMENT_OPTIONS,
  SEVERITY_OPTIONS,
  FREQUENCY_OPTIONS,
  BUSINESS_IMPACT_OPTIONS,
  SOURCE_OPTIONS,
} from "./productDiscoveryConstants";

export const ProductDiscoveryPage = () => {
  const [activeTab, setActiveTab] = useState<string>("needs");
  const [needs, setNeeds] = useState<CustomerNeedRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [initiatives, setInitiatives] = useState<InitiativeRow[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [suggestedRoadmap, setSuggestedRoadmap] = useState<InitiativeRow[]>([]);
  const [topProblems, setTopProblems] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNeed, setSelectedNeed] = useState<CustomerNeedRow | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityRow | null>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<InitiativeRow | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<FeatureRow | null>(null);

  const [initiativeEditEffort, setInitiativeEditEffort] = useState<string>("");
  const [initiativeEditImpact, setInitiativeEditImpact] = useState<string>("");
  const [initiativeSaving, setInitiativeSaving] = useState(false);

  const [newNeedOpen, setNewNeedOpen] = useState(false);
  const [newNeedSaving, setNewNeedSaving] = useState(false);
  const [newNeedForm, setNewNeedForm] = useState({
    title: "",
    problem: "",
    customer_name: "",
    customer_segment: "",
    severity: "",
    frequency: "",
    business_impact: "",
    source: "",
    workaround: "",
  });

  const [newOpportunityOpen, setNewOpportunityOpen] = useState(false);
  const [newOpportunitySaving, setNewOpportunitySaving] = useState(false);
  const [newOpportunityForm, setNewOpportunityForm] = useState({
    title: "",
    problem_statement: "",
    impact_score: "",
    initiative_id: "",
  });

  const [newInitiativeOpen, setNewInitiativeOpen] = useState(false);
  const [newInitiativeSaving, setNewInitiativeSaving] = useState(false);
  const [newInitiativeForm, setNewInitiativeForm] = useState({
    title: "",
    description: "",
    product_area: "",
    priority: "",
    status: "",
    estimated_dev_effort: "",
    estimated_business_impact: "",
  });

  const [newFeatureOpen, setNewFeatureOpen] = useState(false);
  const [newFeatureSaving, setNewFeatureSaving] = useState(false);
  const [newFeatureForm, setNewFeatureForm] = useState({
    title: "",
    description: "",
    initiative_id: "",
    status: "",
  });

  const loadNeeds = useCallback(() => {
    followupApi
      .getCustomerNeeds()
      .then(setNeeds)
      .catch(() => setNeeds([]));
  }, []);
  const loadOpportunities = useCallback(() => {
    followupApi
      .getOpportunities()
      .then(setOpportunities)
      .catch(() => setOpportunities([]));
  }, []);
  const loadInitiatives = useCallback(() => {
    followupApi
      .getInitiatives()
      .then(setInitiatives)
      .catch(() => setInitiatives([]));
  }, []);
  const loadFeatures = useCallback(() => {
    followupApi
      .getFeatures()
      .then(setFeatures)
      .catch(() => setFeatures([]));
  }, []);

  const loadAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      followupApi.getCustomerNeeds(),
      followupApi.getOpportunities(),
      followupApi.getInitiatives(),
      followupApi.getFeatures(),
      followupApi.getSuggestedRoadmap(),
      followupApi.getTopProblems(),
    ])
      .then(([n, o, i, f, roadmap, problems]) => {
        setNeeds(n);
        setOpportunities(o);
        setInitiatives(i);
        setFeatures(f);
        setSuggestedRoadmap(roadmap);
        setTopProblems(problems);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Errore caricamento"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (selectedInitiative) {
      setInitiativeEditEffort("");
      setInitiativeEditImpact("");
    }
  }, [selectedInitiative?._id]);

  const handleCreateNeed = () => {
    if (!newNeedForm.title.trim() || !newNeedForm.problem.trim()) return;
    setNewNeedSaving(true);
    followupApi
      .createCustomerNeed({
        title: newNeedForm.title.trim(),
        problem: newNeedForm.problem.trim(),
        customer_name: newNeedForm.customer_name.trim() || undefined,
        customer_segment: newNeedForm.customer_segment || undefined,
        severity: newNeedForm.severity || undefined,
        frequency: newNeedForm.frequency || undefined,
        business_impact: newNeedForm.business_impact || undefined,
        source: newNeedForm.source || undefined,
        workaround: newNeedForm.workaround.trim() || undefined,
        status: "collected",
      })
      .then(() => {
        setNewNeedOpen(false);
        setNewNeedForm({
          title: "",
          problem: "",
          customer_name: "",
          customer_segment: "",
          severity: "",
          frequency: "",
          business_impact: "",
          source: "",
          workaround: "",
        });
        loadNeeds();
      })
      .finally(() => setNewNeedSaving(false));
  };

  const handleCreateOpportunity = () => {
    if (!newOpportunityForm.title.trim()) return;
    setNewOpportunitySaving(true);
    followupApi
      .createOpportunity({
        title: newOpportunityForm.title.trim(),
        problem_statement: newOpportunityForm.problem_statement.trim() || undefined,
        impact_score: newOpportunityForm.impact_score.trim() || undefined,
        initiative_id:
          newOpportunityForm.initiative_id && newOpportunityForm.initiative_id !== "none"
            ? newOpportunityForm.initiative_id
            : undefined,
      })
      .then(() => {
        setNewOpportunityOpen(false);
        setNewOpportunityForm({ title: "", problem_statement: "", impact_score: "", initiative_id: "" });
        loadAll();
      })
      .finally(() => setNewOpportunitySaving(false));
  };

  const handleCreateInitiative = () => {
    if (!newInitiativeForm.title.trim()) return;
    setNewInitiativeSaving(true);
    const effort = newInitiativeForm.estimated_dev_effort.trim()
      ? Number(newInitiativeForm.estimated_dev_effort)
      : undefined;
    const impact = newInitiativeForm.estimated_business_impact.trim()
      ? Number(newInitiativeForm.estimated_business_impact)
      : undefined;
    followupApi
      .createInitiative({
        title: newInitiativeForm.title.trim(),
        description: newInitiativeForm.description.trim() || undefined,
        product_area: newInitiativeForm.product_area.trim() || undefined,
        priority: newInitiativeForm.priority.trim() || undefined,
        status: newInitiativeForm.status.trim() || undefined,
        ...(Number.isFinite(effort) && { estimated_dev_effort: effort }),
        ...(Number.isFinite(impact) && { estimated_business_impact: impact }),
      })
      .then(() => {
        setNewInitiativeOpen(false);
        setNewInitiativeForm({
          title: "",
          description: "",
          product_area: "",
          priority: "",
          status: "",
          estimated_dev_effort: "",
          estimated_business_impact: "",
        });
        loadAll();
      })
      .finally(() => setNewInitiativeSaving(false));
  };

  const handleCreateFeature = () => {
    if (!newFeatureForm.title.trim()) return;
    setNewFeatureSaving(true);
    followupApi
      .createFeature({
        title: newFeatureForm.title.trim(),
        description: newFeatureForm.description.trim() || undefined,
        initiative_id:
          newFeatureForm.initiative_id && newFeatureForm.initiative_id !== "none"
            ? newFeatureForm.initiative_id
            : undefined,
        status: newFeatureForm.status.trim() || undefined,
      })
      .then(() => {
        setNewFeatureOpen(false);
        setNewFeatureForm({ title: "", description: "", initiative_id: "", status: "" });
        loadAll();
      })
      .finally(() => setNewFeatureSaving(false));
  };

  const initiativeById = (id: string) => initiatives.find((i) => i._id === id);
  const opportunityById = (id: string) => opportunities.find((o) => o._id === id);

  const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Strategic"];
  const STATUS_OPTIONS = ["Discovery", "Planned", "In progress", "Released"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Caricamento…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="needs">
            <MessageSquare className="h-4 w-4" />
            Customer Needs
          </TabsTrigger>
          <TabsTrigger value="opportunities">
            <Target className="h-4 w-4" />
            Opportunities
          </TabsTrigger>
          <TabsTrigger value="initiatives">
            <LayoutList className="h-4 w-4" />
            Initiatives
          </TabsTrigger>
          <TabsTrigger value="features">
            <Layers className="h-4 w-4" />
            Feature backlog
          </TabsTrigger>
          <TabsTrigger value="roadmap">
            <TrendingUp className="h-4 w-4" />
            Suggested Roadmap
          </TabsTrigger>
          <TabsTrigger value="topProblems">
            <AlertTriangle className="h-4 w-4" />
            Top Problems
          </TabsTrigger>
        </TabsList>

        <TabsContent value="needs" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setNewNeedOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo feedback cliente
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Need</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Impatto</TableHead>
                <TableHead>Frequenza</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {needs.map((n) => (
                <TableRow
                  key={n._id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedNeed(n)}
                >
                  <TableCell className="font-medium">{n.title || n.problem}</TableCell>
                  <TableCell>{n.customer_name ?? "—"}</TableCell>
                  <TableCell>{n.customer_segment ?? "—"}</TableCell>
                  <TableCell>{n.score ?? "—"}</TableCell>
                  <TableCell>{n.severity ?? "—"}</TableCell>
                  <TableCell>{n.frequency ?? "—"}</TableCell>
                  <TableCell>{n.status ?? "collected"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {needs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessun feedback. Usa &quot;Nuovo feedback cliente&quot; per aggiungerne uno.
            </p>
          )}
        </TabsContent>

        <TabsContent value="opportunities" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setNewOpportunityOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuova opportunity
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Feedback collegati</TableHead>
                <TableHead>Impatto</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((o) => (
                <TableRow
                  key={o._id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedOpportunity(o)}
                >
                  <TableCell className="font-medium">{o.title}</TableCell>
                  <TableCell>{o.feedback_count}</TableCell>
                  <TableCell>{o.impact_score ?? "—"}</TableCell>
                  <TableCell>—</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {opportunities.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessuna opportunity. Raggruppa i feedback in Customer Needs assegnando un&apos;opportunity.
            </p>
          )}
        </TabsContent>

        <TabsContent value="initiatives" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setNewInitiativeOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuova initiative
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Initiative</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>ROI Score</TableHead>
                <TableHead>Effort</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initiatives.map((i) => (
                <TableRow
                  key={i._id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedInitiative(i)}
                >
                  <TableCell className="font-medium">{i.title}</TableCell>
                  <TableCell>{i.product_area ?? "—"}</TableCell>
                  <TableCell>{i.roi_score ?? "—"}</TableCell>
                  <TableCell>{i.estimated_dev_effort ?? "—"}</TableCell>
                  <TableCell>{i.estimated_business_impact ?? "—"}</TableCell>
                  <TableCell>{i.priority ?? "—"}</TableCell>
                  <TableCell>{i.status ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {initiatives.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessuna initiative. Creane una dalla roadmap.
            </p>
          )}
        </TabsContent>

        <TabsContent value="features" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setNewFeatureOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuova feature
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Initiative</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((f) => (
                <TableRow
                  key={f._id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedFeature(f)}
                >
                  <TableCell className="font-medium">{f.title}</TableCell>
                  <TableCell>
                    {f.initiative_id
                      ? initiativeById(f.initiative_id)?.title ?? f.initiative_id
                      : "—"}
                  </TableCell>
                  <TableCell>{f.status ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {features.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessuna feature nel backlog.
            </p>
          )}
        </TabsContent>

        <TabsContent value="roadmap" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Top 5 initiative per ROI (Impatto stimato / Sforzo dev). Inserisci Effort e Impact nelle initiative per vederle qui.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Initiative</TableHead>
                <TableHead>ROI Score</TableHead>
                <TableHead>Effort</TableHead>
                <TableHead>Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestedRoadmap.map((i, idx) => (
                <TableRow
                  key={i._id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedInitiative(i)}
                >
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">{i.title}</TableCell>
                  <TableCell>{i.roi_score ?? "—"}</TableCell>
                  <TableCell>{i.estimated_dev_effort ?? "—"}</TableCell>
                  <TableCell>{i.estimated_business_impact ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {suggestedRoadmap.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessuna initiative con Effort e Impact impostati. Modifica le initiative per calcolare il ROI.
            </p>
          )}
        </TabsContent>

        <TabsContent value="topProblems" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Top 5 opportunity per numero di feedback collegati.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Opportunity</TableHead>
                <TableHead>Feedback count</TableHead>
                <TableHead>Impatto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProblems.map((o, idx) => (
                <TableRow
                  key={o._id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedOpportunity(o)}
                >
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">{o.title}</TableCell>
                  <TableCell>{o.feedback_count}</TableCell>
                  <TableCell>{o.impact_score ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {topProblems.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessuna opportunity. Collega i feedback (Customer Needs) alle opportunity.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Sheet: Nuovo feedback cliente */}
      <Sheet open={newNeedOpen} onOpenChange={setNewNeedOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nuovo feedback cliente</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Problema osservato *</label>
              <Input
                value={newNeedForm.title}
                onChange={(e) => setNewNeedForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Una riga"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Descrizione problema *</label>
              <Input
                value={newNeedForm.problem}
                onChange={(e) => setNewNeedForm((p) => ({ ...p, problem: e.target.value }))}
                placeholder="Dettaglio"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cliente</label>
              <Input
                value={newNeedForm.customer_name}
                onChange={(e) => setNewNeedForm((p) => ({ ...p, customer_name: e.target.value }))}
                placeholder="Nome cliente"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Segmento</label>
              <Select
                value={newNeedForm.customer_segment}
                onValueChange={(v) => setNewNeedForm((p) => ({ ...p, customer_segment: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s.toLowerCase()}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Severity</label>
              <Select
                value={newNeedForm.severity}
                onValueChange={(v) => setNewNeedForm((p) => ({ ...p, severity: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Frequenza</label>
              <Select
                value={newNeedForm.frequency}
                onValueChange={(v) => setNewNeedForm((p) => ({ ...p, frequency: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Business impact</label>
              <Select
                value={newNeedForm.business_impact}
                onValueChange={(v) => setNewNeedForm((p) => ({ ...p, business_impact: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_IMPACT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fonte</label>
              <Select
                value={newNeedForm.source}
                onValueChange={(v) => setNewNeedForm((p) => ({ ...p, source: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Workaround (opzionale)</label>
              <Input
                value={newNeedForm.workaround}
                onChange={(e) => setNewNeedForm((p) => ({ ...p, workaround: e.target.value }))}
                placeholder="Come risolvono oggi"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreateNeed}
              disabled={
                newNeedSaving || !newNeedForm.title.trim() || !newNeedForm.problem.trim()
              }
            >
              {newNeedSaving ? "Salvataggio…" : "Salva feedback"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: Nuova opportunity */}
      <Sheet open={newOpportunityOpen} onOpenChange={setNewOpportunityOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nuova opportunity</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Titolo *</label>
              <Input
                value={newOpportunityForm.title}
                onChange={(e) => setNewOpportunityForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Es. Disponibilità appartamenti poco chiara"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Descrizione problema</label>
              <Input
                value={newOpportunityForm.problem_statement}
                onChange={(e) => setNewOpportunityForm((p) => ({ ...p, problem_statement: e.target.value }))}
                placeholder="Dettaglio"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Impatto</label>
              <Input
                value={newOpportunityForm.impact_score}
                onChange={(e) => setNewOpportunityForm((p) => ({ ...p, impact_score: e.target.value }))}
                placeholder="Es. Deal blocker"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Initiative</label>
              <Select
                value={newOpportunityForm.initiative_id || "none"}
                onValueChange={(v) => setNewOpportunityForm((p) => ({ ...p, initiative_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona (opzionale)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {initiatives.map((i) => (
                    <SelectItem key={i._id} value={i._id}>
                      {i.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleCreateOpportunity}
              disabled={newOpportunitySaving || !newOpportunityForm.title.trim()}
            >
              {newOpportunitySaving ? "Salvataggio…" : "Crea opportunity"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: Nuova initiative */}
      <Sheet open={newInitiativeOpen} onOpenChange={setNewInitiativeOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nuova initiative</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Titolo *</label>
              <Input
                value={newInitiativeForm.title}
                onChange={(e) => setNewInitiativeForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Es. Availability Engine"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Descrizione</label>
              <Input
                value={newInitiativeForm.description}
                onChange={(e) => setNewInitiativeForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Opzionale"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Product area</label>
              <Input
                value={newInitiativeForm.product_area}
                onChange={(e) => setNewInitiativeForm((p) => ({ ...p, product_area: e.target.value }))}
                placeholder="Es. Rent Platform"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Priority</label>
              <Select
                value={newInitiativeForm.priority}
                onValueChange={(v) => setNewInitiativeForm((p) => ({ ...p, priority: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <Select
                value={newInitiativeForm.status}
                onValueChange={(v) => setNewInitiativeForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Estimated dev effort</label>
              <Input
                type="number"
                min={0}
                value={newInitiativeForm.estimated_dev_effort}
                onChange={(e) => setNewInitiativeForm((p) => ({ ...p, estimated_dev_effort: e.target.value }))}
                placeholder="Es. 3 (sprint)"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Estimated business impact</label>
              <Input
                type="number"
                min={0}
                value={newInitiativeForm.estimated_business_impact}
                onChange={(e) => setNewInitiativeForm((p) => ({ ...p, estimated_business_impact: e.target.value }))}
                placeholder="Es. 9"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreateInitiative}
              disabled={newInitiativeSaving || !newInitiativeForm.title.trim()}
            >
              {newInitiativeSaving ? "Salvataggio…" : "Crea initiative"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: Nuova feature */}
      <Sheet open={newFeatureOpen} onOpenChange={setNewFeatureOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nuova feature</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Titolo *</label>
              <Input
                value={newFeatureForm.title}
                onChange={(e) => setNewFeatureForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Es. API disponibilità real-time"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Descrizione</label>
              <Input
                value={newFeatureForm.description}
                onChange={(e) => setNewFeatureForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Opzionale"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Initiative</label>
              <Select
                value={newFeatureForm.initiative_id || "none"}
                onValueChange={(v) => setNewFeatureForm((p) => ({ ...p, initiative_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona (opzionale)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {initiatives.map((i) => (
                    <SelectItem key={i._id} value={i._id}>
                      {i.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <Select
                value={newFeatureForm.status}
                onValueChange={(v) => setNewFeatureForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleCreateFeature}
              disabled={newFeatureSaving || !newFeatureForm.title.trim()}
            >
              {newFeatureSaving ? "Salvataggio…" : "Crea feature"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: Dettaglio Customer Need */}
      <Sheet open={!!selectedNeed} onOpenChange={(open) => !open && setSelectedNeed(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {selectedNeed && (
            <>
              <SheetHeader>
                <SheetTitle>Feedback cliente</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-3 text-sm">
                <p><span className="font-medium">Problema:</span> {selectedNeed.title || selectedNeed.problem}</p>
                <p><span className="font-medium">Cliente:</span> {selectedNeed.customer_name ?? "—"}</p>
                <p><span className="font-medium">Segmento:</span> {selectedNeed.customer_segment ?? "—"}</p>
                <p><span className="font-medium">Score:</span> {selectedNeed.score ?? "—"} (severity × frequenza × impact)</p>
                <p><span className="font-medium">Severity:</span> {selectedNeed.severity ?? "—"}</p>
                <p><span className="font-medium">Frequenza:</span> {selectedNeed.frequency ?? "—"}</p>
                <p><span className="font-medium">Business impact:</span> {selectedNeed.business_impact ?? "—"}</p>
                <p><span className="font-medium">Workaround:</span> {selectedNeed.workaround ?? "—"}</p>
                <p><span className="font-medium">Fonte:</span> {selectedNeed.source ?? "—"}</p>
                <p><span className="font-medium">Stato:</span> {selectedNeed.status}</p>
                {selectedNeed.opportunity_id && (
                  <p>
                    <span className="font-medium">Opportunity collegata:</span>{" "}
                    {opportunityById(selectedNeed.opportunity_id)?.title ?? selectedNeed.opportunity_id}
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet: Dettaglio Opportunity */}
      <Sheet
        open={!!selectedOpportunity}
        onOpenChange={(open) => !open && setSelectedOpportunity(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {selectedOpportunity && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedOpportunity.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-3 text-sm">
                <p><span className="font-medium">Problema:</span> {selectedOpportunity.problem_statement ?? "—"}</p>
                <p><span className="font-medium">Feedback collegati:</span> {selectedOpportunity.feedback_count}</p>
                <p><span className="font-medium">Impatto:</span> {selectedOpportunity.impact_score ?? "—"}</p>
                {selectedOpportunity.initiative_id && (
                  <p>
                    <span className="font-medium">Initiative:</span>{" "}
                    {initiativeById(selectedOpportunity.initiative_id)?.title ?? selectedOpportunity.initiative_id}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <p className="mb-2 font-medium">Feedback in questa opportunity</p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {needs
                    .filter((n) => n.opportunity_id === selectedOpportunity._id)
                    .map((n) => (
                      <li key={n._id}>{n.title || n.problem}</li>
                    ))}
                </ul>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet: Dettaglio Initiative */}
      <Sheet
        open={!!selectedInitiative}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInitiative(null);
            setInitiativeEditEffort("");
            setInitiativeEditImpact("");
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {selectedInitiative && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedInitiative.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-3 text-sm">
                <p><span className="font-medium">Descrizione:</span> {selectedInitiative.description ?? "—"}</p>
                <p><span className="font-medium">Area:</span> {selectedInitiative.product_area ?? "—"}</p>
                <p><span className="font-medium">ROI Score:</span> {selectedInitiative.roi_score ?? "—"} (Impact / Effort)</p>
                <p><span className="font-medium">Estimated dev effort:</span> {selectedInitiative.estimated_dev_effort ?? "—"}</p>
                <p><span className="font-medium">Estimated business impact:</span> {selectedInitiative.estimated_business_impact ?? "—"}</p>
                <p><span className="font-medium">Priority:</span> {selectedInitiative.priority ?? "—"}</p>
                <p><span className="font-medium">Status:</span> {selectedInitiative.status ?? "—"}</p>
              </div>
              <div className="mt-4 space-y-2">
                <p className="font-medium">Aggiorna Effort / Impact (per ROI)</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Effort"
                    value={initiativeEditEffort || (selectedInitiative.estimated_dev_effort ?? "")}
                    onChange={(e) => setInitiativeEditEffort(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Impact"
                    value={initiativeEditImpact || (selectedInitiative.estimated_business_impact ?? "")}
                    onChange={(e) => setInitiativeEditImpact(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={initiativeSaving}
                  onClick={() => {
                    const effortRaw = initiativeEditEffort !== "" ? Number(initiativeEditEffort) : selectedInitiative.estimated_dev_effort;
                    const impactRaw = initiativeEditImpact !== "" ? Number(initiativeEditImpact) : selectedInitiative.estimated_business_impact;
                    const effort = effortRaw !== undefined && Number.isFinite(Number(effortRaw)) ? Number(effortRaw) : undefined;
                    const impact = impactRaw !== undefined && Number.isFinite(Number(impactRaw)) ? Number(impactRaw) : undefined;
                    if (effort === undefined && impact === undefined) return;
                    setInitiativeSaving(true);
                    followupApi
                      .updateInitiative(selectedInitiative._id, {
                        ...(effort !== undefined && { estimated_dev_effort: effort }),
                        ...(impact !== undefined && { estimated_business_impact: impact }),
                      })
                      .then(() => {
                        loadInitiatives();
                        loadAll();
                        setInitiativeEditEffort("");
                        setInitiativeEditImpact("");
                      })
                      .finally(() => setInitiativeSaving(false));
                  }}
                >
                  {initiativeSaving ? "Salvataggio…" : "Salva Effort/Impact"}
                </Button>
              </div>
              <div className="mt-4">
                <p className="mb-2 font-medium">Opportunities collegate</p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {opportunities
                    .filter((o) => o.initiative_id === selectedInitiative._id)
                    .map((o) => (
                      <li key={o._id}>{o.title}</li>
                    ))}
                </ul>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet: Dettaglio Feature */}
      <Sheet
        open={!!selectedFeature}
        onOpenChange={(open) => !open && setSelectedFeature(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {selectedFeature && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedFeature.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-3 text-sm">
                <p><span className="font-medium">Descrizione:</span> {selectedFeature.description ?? "—"}</p>
                <p><span className="font-medium">Status:</span> {selectedFeature.status ?? "—"}</p>
                {selectedFeature.initiative_id && (
                  <p>
                    <span className="font-medium">Initiative:</span>{" "}
                    {initiativeById(selectedFeature.initiative_id)?.title ?? selectedFeature.initiative_id}
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
