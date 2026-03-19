import { useCallback, useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, FileText, Users, Pencil, History, Settings2 } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import type { ApartmentRow, RequestRow, RequestStatus } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { MatchingCandidatesList } from "../../components/MatchingCandidatesList";
import { useWorkflowConfig } from "../../hooks/useWorkflowConfig";
import { STATUS_LABEL, MODE_LABEL } from "./apartmentDetailConstants";
import { ApartmentHeaderSection } from "./ApartmentHeaderSection";
import { ApartmentDetailPanoramicaTab } from "./ApartmentDetailPanoramicaTab";
import { ApartmentDetailTimelineTab } from "./ApartmentDetailTimelineTab";
import { ApartmentDetailEditDrawer } from "./ApartmentDetailEditDrawer";
import { ApartmentDetailTrattativeTab } from "./ApartmentDetailTrattativeTab";
import { ApartmentDetailDettagliTab } from "./ApartmentDetailDettagliTab";
import { useApartmentDetailData } from "./useApartmentDetailData";
import { useApartmentDetailPriceCalendar } from "./useApartmentDetailPriceCalendar";
import { useToast } from "../../contexts/ToastContext";

export const ApartmentDetailPage = () => {
  const { apartmentId } = useParams<{ apartmentId: string }>();
  const navigate = useNavigate();
  const { workspaceId, selectedProjectIds, isAdmin } = useWorkspace();
  const { toastError } = useToast();
  const workflowConfigRent = useWorkflowConfig(workspaceId, "rent");
  const workflowConfigSell = useWorkflowConfig(workspaceId, "sell");
  const getWorkflowConfig = (type: "rent" | "sell") => (type === "rent" ? workflowConfigRent : workflowConfigSell);
  const {
    apartment,
    setApartment,
    loading,
    error,
    requests,
    setRequests,
    requestsLoading,
    reloadRequests,
  } = useApartmentDetailData(apartmentId, workspaceId, selectedProjectIds);
  const [auditEvents, setAuditEvents] = useState<Array<{ _id: string; at: string; action: string; actor?: { email?: string } }>>([]);
  const [assignments, setAssignments] = useState<Array<{ userId: string }>>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<Array<{ userId: string }>>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [matchCandidates, setMatchCandidates] = useState<Array<{ item: { _id: string; fullName: string; email?: string; status: string }; score: number; reasons: string[] }>>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [editApartmentOpen, setEditApartmentOpen] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<ApartmentRow["status"]>("AVAILABLE");
  const [editSurfaceMq, setEditSurfaceMq] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [prices, setPrices] = useState<{
    current: { source: string; amount: number; currency: string; mode: string; validFrom?: string; validTo?: string; deposit?: number } | null;
    salePrices: Array<{ _id: string; price: number; currency: string; validFrom: string; validTo?: string }>;
    monthlyRents: Array<{ _id: string; pricePerMonth: number; deposit?: number; currency: string; validFrom: string; validTo?: string }>;
  } | null>(null);
  const [inventory, setInventory] = useState<{
    effectiveStatus: string;
    lock: { requestId: string; type: string } | null;
  } | null>(null);
  const [addSalePriceOpen, setAddSalePriceOpen] = useState(false);
  const [addMonthlyRentOpen, setAddMonthlyRentOpen] = useState(false);
  const [addSalePriceForm, setAddSalePriceForm] = useState({ price: "", currency: "EUR", validFrom: "", validTo: "" });
  const [addMonthlyRentForm, setAddMonthlyRentForm] = useState({
    pricePerMonth: "",
    deposit: "",
    currency: "EUR",
    validFrom: "",
    validTo: "",
  });
  const [addPriceSaving, setAddPriceSaving] = useState(false);
  const [addPriceError, setAddPriceError] = useState<string | null>(null);
  const [editSalePriceOpen, setEditSalePriceOpen] = useState(false);
  const [editSalePriceId, setEditSalePriceId] = useState<string | null>(null);
  const [editSalePriceForm, setEditSalePriceForm] = useState({ price: "", validTo: "" });
  const [editMonthlyRentOpen, setEditMonthlyRentOpen] = useState(false);
  const [editMonthlyRentId, setEditMonthlyRentId] = useState<string | null>(null);
  const [editMonthlyRentForm, setEditMonthlyRentForm] = useState({ pricePerMonth: "", deposit: "", validTo: "" });
  const [editPriceSaving, setEditPriceSaving] = useState(false);
  const [editPriceError, setEditPriceError] = useState<string | null>(null);

  const priceCalendar = useApartmentDetailPriceCalendar(
    apartmentId,
    workspaceId,
    apartment?.projectId,
    apartment?.mode
  );

  const refetchPrices = useCallback(() => {
    if (!apartmentId || !workspaceId) return;
    followupApi.apartments
      .getApartmentPrices(apartmentId, workspaceId)
      .then(setPrices)
      .catch(() => setPrices(null));
  }, [apartmentId, workspaceId]);

  useEffect(() => {
    if (!apartmentId || !workspaceId) return;
    followupApi.apartments
      .getApartmentPrices(apartmentId, workspaceId)
      .then((r) => setPrices(r))
      .catch(() => setPrices(null));
  }, [apartmentId, workspaceId]);

  useEffect(() => {
    if (!apartmentId || !workspaceId) return;
    followupApi.apartments
      .getApartmentInventory(apartmentId, workspaceId)
      .then((r) => setInventory({ effectiveStatus: r.effectiveStatus, lock: r.lock }))
      .catch(() => setInventory(null));
  }, [apartmentId, workspaceId]);

  const requestsSorted = useMemo(
    () =>
      [...requests].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [requests]
  );

  useEffect(() => {
    if (!apartmentId || !workspaceId) return;
    followupApi
      .getAuditForEntity("apartment", apartmentId, workspaceId, 25)
      .then((r) => setAuditEvents(r.data ?? []))
      .catch(() => setAuditEvents([]));
  }, [apartmentId, workspaceId]);

  useEffect(() => {
    if (!apartmentId || !workspaceId) return;
    followupApi
      .listEntityAssignments(workspaceId, "apartment", apartmentId)
      .then((r) => setAssignments(r.data ?? []))
      .catch(() => setAssignments([]));
  }, [apartmentId, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isAdmin) return;
    followupApi
      .listWorkspaceUsers(workspaceId)
      .then((r) => setWorkspaceUsers(r.data ?? []))
      .catch(() => setWorkspaceUsers([]));
  }, [workspaceId, isAdmin]);

  useEffect(() => {
    if (!apartmentId || !apartment || !workspaceId || selectedProjectIds.length === 0) return;
    setMatchLoading(true);
    followupApi
      .getApartmentCandidates(apartmentId, workspaceId, [apartment.projectId])
      .then((r) => setMatchCandidates((r.data ?? []) as unknown as typeof matchCandidates))
      .catch(() => setMatchCandidates([]))
      .finally(() => setMatchLoading(false));
  }, [apartmentId, apartment?.projectId, workspaceId, selectedProjectIds.length]);

  const handleAssign = async () => {
    if (!apartmentId || !workspaceId || !assignUserId.trim()) return;
    try {
      await followupApi.assignEntity(workspaceId, "apartment", apartmentId, assignUserId.trim());
      setAssignments((prev) => [...prev, { userId: assignUserId.trim() }]);
      setAssignUserId("");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore assegnazione");
    }
  };

  const handleUnassign = async (userId: string) => {
    if (!apartmentId || !workspaceId) return;
    if (!window.confirm(`Rimuovere assegnazione a ${userId}?`)) return;
    try {
      await followupApi.unassignEntity(workspaceId, "apartment", apartmentId, userId);
      setAssignments((prev) => prev.filter((a) => a.userId !== userId));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore rimozione");
    }
  };

  const goBack = () => navigate("/?section=apartments");

  const goToEditApartmentHC = () => {
    navigate("/?section=editApartmentHC", { state: { editApartmentId: apartmentId } });
  };

  useEffect(() => {
    if (editApartmentOpen && apartment) {
      setEditCode(apartment.code);
      setEditName(apartment.name ?? "");
      setEditStatus(apartment.status);
      setEditSurfaceMq(String(apartment.surfaceMq ?? ""));
      setEditError(null);
    }
  }, [editApartmentOpen, apartment]);

  const handleEditApartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apartment) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const surfaceMq = Number(editSurfaceMq);
      if (Number.isNaN(surfaceMq) || surfaceMq < 0) {
        setEditError("Superficie non valida.");
        return;
      }
      const updated = await followupApi.apartments.updateApartment(apartment._id, {
        code: editCode.trim(),
        name: editName.trim() || editCode.trim(),
        status: editStatus,
        surfaceMq,
      });
      setApartment(updated.apartment);
      setEditApartmentOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Errore durante il salvataggio.");
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Button variant="ghost" size="sm" className="min-h-11 w-fit gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Appartamenti
        </Button>
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (error && !apartment) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Button variant="ghost" size="sm" className="min-h-11 w-fit gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Appartamenti
        </Button>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!apartment) return null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <ApartmentHeaderSection
        apartment={apartment}
        onBack={goBack}
        onEdit={() => setEditApartmentOpen(true)}
        onEditHC={goToEditApartmentHC}
      />

      <Tabs defaultValue="panoramica" className="space-y-6">
        <TabsList className="w-full flex flex-wrap border-b border-border bg-transparent p-0">
          <TabsTrigger value="panoramica" icon={<Home className="h-4 w-4" />}>
            Panoramica
          </TabsTrigger>
          <TabsTrigger value="trattative" icon={<Users className="h-4 w-4" />}>
            Trattative
          </TabsTrigger>
          <TabsTrigger value="matching" icon={<Users className="h-4 w-4" />}>
            Clienti papabili
          </TabsTrigger>
          <TabsTrigger value="dettagli" icon={<FileText className="h-4 w-4" />}>
            Dettagli
          </TabsTrigger>
          <TabsTrigger value="timeline" icon={<History className="h-4 w-4" />}>
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="panoramica" className="space-y-6 mt-4">
          <ApartmentDetailPanoramicaTab
            apartment={apartment}
            prices={prices}
            inventory={inventory}
            apartmentId={apartmentId}
            workspaceId={workspaceId}
            onEditApartment={() => setEditApartmentOpen(true)}
            refetchPrices={refetchPrices}
            priceCalendar={priceCalendar}
            addSalePriceOpen={addSalePriceOpen}
            setAddSalePriceOpen={setAddSalePriceOpen}
            addSalePriceForm={addSalePriceForm}
            setAddSalePriceForm={setAddSalePriceForm}
            addMonthlyRentOpen={addMonthlyRentOpen}
            setAddMonthlyRentOpen={setAddMonthlyRentOpen}
            addMonthlyRentForm={addMonthlyRentForm}
            setAddMonthlyRentForm={setAddMonthlyRentForm}
            addPriceSaving={addPriceSaving}
            setAddPriceSaving={setAddPriceSaving}
            addPriceError={addPriceError}
            setAddPriceError={setAddPriceError}
            editSalePriceOpen={editSalePriceOpen}
            setEditSalePriceOpen={setEditSalePriceOpen}
            editSalePriceId={editSalePriceId}
            setEditSalePriceId={setEditSalePriceId}
            editSalePriceForm={editSalePriceForm}
            setEditSalePriceForm={setEditSalePriceForm}
            editMonthlyRentOpen={editMonthlyRentOpen}
            setEditMonthlyRentOpen={setEditMonthlyRentOpen}
            editMonthlyRentId={editMonthlyRentId}
            setEditMonthlyRentId={setEditMonthlyRentId}
            editMonthlyRentForm={editMonthlyRentForm}
            setEditMonthlyRentForm={setEditMonthlyRentForm}
            editPriceSaving={editPriceSaving}
            setEditPriceSaving={setEditPriceSaving}
            editPriceError={editPriceError}
            setEditPriceError={setEditPriceError}
          />
        </TabsContent>

        <TabsContent value="trattative" className="space-y-4 mt-4">
          <ApartmentDetailTrattativeTab
            requestsLoading={requestsLoading}
            requestsSorted={requestsSorted}
            getWorkflowConfig={getWorkflowConfig}
          />
        </TabsContent>

        <TabsContent value="matching" className="space-y-4 mt-4">
          <MatchingCandidatesList
            title="Clienti papabili (matching)"
            introText="Clienti il cui profilo (budget, zona) è più compatibile con questo appartamento."
            emptyMessage="Nessun cliente papabile trovato. Completa i profili clienti (budget, città) per migliorare il matching."
            loading={matchLoading}
            candidates={matchCandidates}
            getItemLink={(item) => `/clients/${item._id}`}
            renderItemTitle={(item) => item.fullName}
            renderItemSubtitle={(item) => item.email ?? null}
          />
        </TabsContent>

        <TabsContent value="dettagli" className="space-y-4 mt-4">
          <ApartmentDetailDettagliTab
            apartment={apartment}
            isAdmin={isAdmin}
            assignments={assignments}
            workspaceUsers={workspaceUsers}
            assignUserId={assignUserId}
            onAssignUserIdChange={setAssignUserId}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
          />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4 mt-4">
          <ApartmentDetailTimelineTab auditEvents={auditEvents} />
        </TabsContent>
      </Tabs>

      <ApartmentDetailEditDrawer
        open={editApartmentOpen}
        onOpenChange={setEditApartmentOpen}
        code={editCode}
        onCodeChange={setEditCode}
        name={editName}
        onNameChange={setEditName}
        status={editStatus}
        onStatusChange={setEditStatus}
        surfaceMq={editSurfaceMq}
        onSurfaceMqChange={setEditSurfaceMq}
        error={editError}
        saving={editSaving}
        onSubmit={handleEditApartmentSubmit}
      />
    </div>
  );
};
