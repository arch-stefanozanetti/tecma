import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { followupApi } from "../../api/followupApi";

export interface ApartmentDetailPriceDrawersProps {
  apartmentId: string | undefined;
  workspaceId: string | undefined;
  refetchPrices: () => void;
  addSalePriceOpen: boolean;
  setAddSalePriceOpen: (v: boolean) => void;
  addSalePriceForm: { price: string; currency: string; validFrom: string; validTo: string };
  setAddSalePriceForm: React.Dispatch<React.SetStateAction<{ price: string; currency: string; validFrom: string; validTo: string }>>;
  addMonthlyRentOpen: boolean;
  setAddMonthlyRentOpen: (v: boolean) => void;
  addMonthlyRentForm: { pricePerMonth: string; deposit: string; currency: string; validFrom: string; validTo: string };
  setAddMonthlyRentForm: React.Dispatch<React.SetStateAction<{ pricePerMonth: string; deposit: string; currency: string; validFrom: string; validTo: string }>>;
  addPriceSaving: boolean;
  setAddPriceSaving: (v: boolean) => void;
  addPriceError: string | null;
  setAddPriceError: (v: string | null) => void;
  editSalePriceOpen: boolean;
  setEditSalePriceOpen: (v: boolean) => void;
  editSalePriceId: string | null;
  setEditSalePriceId: (v: string | null) => void;
  editSalePriceForm: { price: string; validTo: string };
  setEditSalePriceForm: React.Dispatch<React.SetStateAction<{ price: string; validTo: string }>>;
  editMonthlyRentOpen: boolean;
  setEditMonthlyRentOpen: (v: boolean) => void;
  editMonthlyRentId: string | null;
  setEditMonthlyRentId: (v: string | null) => void;
  editMonthlyRentForm: { pricePerMonth: string; deposit: string; validTo: string };
  setEditMonthlyRentForm: React.Dispatch<React.SetStateAction<{ pricePerMonth: string; deposit: string; validTo: string }>>;
  editPriceSaving: boolean;
  setEditPriceSaving: (v: boolean) => void;
  editPriceError: string | null;
  setEditPriceError: (v: string | null) => void;
}

export function ApartmentDetailPriceDrawers(props: ApartmentDetailPriceDrawersProps) {
  const {
    apartmentId,
    workspaceId,
    refetchPrices,
    addSalePriceOpen,
    setAddSalePriceOpen,
    addSalePriceForm,
    setAddSalePriceForm,
    addMonthlyRentOpen,
    setAddMonthlyRentOpen,
    addMonthlyRentForm,
    setAddMonthlyRentForm,
    addPriceSaving,
    setAddPriceSaving,
    addPriceError,
    setAddPriceError,
    editSalePriceOpen,
    setEditSalePriceOpen,
    editSalePriceId,
    setEditSalePriceId,
    editSalePriceForm,
    setEditSalePriceForm,
    editMonthlyRentOpen,
    setEditMonthlyRentOpen,
    editMonthlyRentId,
    setEditMonthlyRentId,
    editMonthlyRentForm,
    setEditMonthlyRentForm,
    editPriceSaving,
    setEditPriceSaving,
    editPriceError,
    setEditPriceError,
  } = props;

  return (
    <>
      <Drawer open={addSalePriceOpen} onOpenChange={setAddSalePriceOpen}>
        <DrawerContent side="right" className="w-full sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Aggiungi prezzo vendita</DrawerTitle>
            <DrawerCloseButton />
          </DrawerHeader>
          <DrawerBody>
            <form
              id="add-sale-price-form"
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!apartmentId || !workspaceId) return;
                const price = Number(addSalePriceForm.price);
                if (Number.isNaN(price) || price < 0) {
                  setAddPriceError("Inserisci un prezzo valido.");
                  return;
                }
                setAddPriceSaving(true);
                setAddPriceError(null);
                try {
                  await followupApi.apartments.createApartmentSalePrice(apartmentId, {
                    workspaceId,
                    price,
                    currency: addSalePriceForm.currency,
                    validFrom: addSalePriceForm.validFrom || undefined,
                    validTo: addSalePriceForm.validTo || undefined,
                  });
                  refetchPrices();
                  setAddSalePriceOpen(false);
                } catch (err) {
                  setAddPriceError(err instanceof Error ? err.message : "Errore aggiunta prezzo");
                } finally {
                  setAddPriceSaving(false);
                }
              }}
            >
              <div>
                <label className="text-sm font-medium text-foreground">Prezzo (€)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1"
                  value={addSalePriceForm.price}
                  onChange={(e) => setAddSalePriceForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Valuta</label>
                <Input
                  className="mt-1"
                  value={addSalePriceForm.currency}
                  onChange={(e) => setAddSalePriceForm((f) => ({ ...f, currency: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Data inizio (opzionale)</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={addSalePriceForm.validFrom}
                  onChange={(e) => setAddSalePriceForm((f) => ({ ...f, validFrom: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Data fine (opzionale)</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={addSalePriceForm.validTo}
                  onChange={(e) => setAddSalePriceForm((f) => ({ ...f, validTo: e.target.value }))}
                />
              </div>
              {addPriceError && <p className="text-sm text-destructive">{addPriceError}</p>}
            </form>
          </DrawerBody>
          <DrawerFooter>
            <Button type="submit" form="add-sale-price-form" disabled={addPriceSaving}>
              {addPriceSaving ? "Salvataggio..." : "Aggiungi"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={addMonthlyRentOpen} onOpenChange={setAddMonthlyRentOpen}>
        <DrawerContent side="right" className="w-full sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Aggiungi canone mensile</DrawerTitle>
            <DrawerCloseButton />
          </DrawerHeader>
          <DrawerBody>
            <form
              id="add-monthly-rent-form"
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!apartmentId || !workspaceId) return;
                const pricePerMonth = Number(addMonthlyRentForm.pricePerMonth);
                if (Number.isNaN(pricePerMonth) || pricePerMonth < 0) {
                  setAddPriceError("Inserisci un canone valido.");
                  return;
                }
                setAddPriceSaving(true);
                setAddPriceError(null);
                try {
                  await followupApi.apartments.createApartmentMonthlyRent(apartmentId, {
                    workspaceId,
                    pricePerMonth,
                    deposit: addMonthlyRentForm.deposit ? Number(addMonthlyRentForm.deposit) : undefined,
                    currency: addMonthlyRentForm.currency,
                    validFrom: addMonthlyRentForm.validFrom || undefined,
                    validTo: addMonthlyRentForm.validTo || undefined,
                  });
                  refetchPrices();
                  setAddMonthlyRentOpen(false);
                } catch (err) {
                  setAddPriceError(err instanceof Error ? err.message : "Errore aggiunta canone");
                } finally {
                  setAddPriceSaving(false);
                }
              }}
            >
              <div>
                <label className="text-sm font-medium text-foreground">Canone mensile (€)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1"
                  value={addMonthlyRentForm.pricePerMonth}
                  onChange={(e) => setAddMonthlyRentForm((f) => ({ ...f, pricePerMonth: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Deposito (€, opzionale)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1"
                  value={addMonthlyRentForm.deposit}
                  onChange={(e) => setAddMonthlyRentForm((f) => ({ ...f, deposit: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Valuta</label>
                <Input
                  className="mt-1"
                  value={addMonthlyRentForm.currency}
                  onChange={(e) => setAddMonthlyRentForm((f) => ({ ...f, currency: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Data inizio (opzionale)</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={addMonthlyRentForm.validFrom}
                  onChange={(e) => setAddMonthlyRentForm((f) => ({ ...f, validFrom: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Data fine (opzionale)</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={addMonthlyRentForm.validTo}
                  onChange={(e) => setAddMonthlyRentForm((f) => ({ ...f, validTo: e.target.value }))}
                />
              </div>
              {addPriceError && <p className="text-sm text-destructive">{addPriceError}</p>}
            </form>
          </DrawerBody>
          <DrawerFooter>
            <Button type="submit" form="add-monthly-rent-form" disabled={addPriceSaving}>
              {addPriceSaving ? "Salvataggio..." : "Aggiungi"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={editSalePriceOpen} onOpenChange={setEditSalePriceOpen}>
        <DrawerContent side="right" className="w-full sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Modifica prezzo vendita</DrawerTitle>
            <DrawerCloseButton />
          </DrawerHeader>
          <DrawerBody>
            <form
              id="edit-sale-price-form"
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!apartmentId || !editSalePriceId) return;
                const price = Number(editSalePriceForm.price);
                if (Number.isNaN(price) || price < 0) {
                  setEditPriceError("Inserisci un prezzo valido.");
                  return;
                }
                setEditPriceSaving(true);
                setEditPriceError(null);
                try {
                  await followupApi.apartments.updateApartmentSalePrice(apartmentId, editSalePriceId, {
                    price,
                    validTo: editSalePriceForm.validTo || undefined,
                  });
                  refetchPrices();
                  setEditSalePriceOpen(false);
                  setEditSalePriceId(null);
                } catch (err) {
                  setEditPriceError(err instanceof Error ? err.message : "Errore modifica");
                } finally {
                  setEditPriceSaving(false);
                }
              }}
            >
              <div>
                <label className="text-sm font-medium text-foreground">Prezzo (€)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1"
                  value={editSalePriceForm.price}
                  onChange={(e) => setEditSalePriceForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Data fine (opzionale)</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={editSalePriceForm.validTo}
                  onChange={(e) => setEditSalePriceForm((f) => ({ ...f, validTo: e.target.value }))}
                />
              </div>
              {editPriceError && <p className="text-sm text-destructive">{editPriceError}</p>}
            </form>
          </DrawerBody>
          <DrawerFooter>
            <Button type="submit" form="edit-sale-price-form" disabled={editPriceSaving}>
              {editPriceSaving ? "Salvataggio..." : "Salva"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={editMonthlyRentOpen} onOpenChange={setEditMonthlyRentOpen}>
        <DrawerContent side="right" className="w-full sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Modifica canone mensile</DrawerTitle>
            <DrawerCloseButton />
          </DrawerHeader>
          <DrawerBody>
            <form
              id="edit-monthly-rent-form"
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!apartmentId || !editMonthlyRentId) return;
                const pricePerMonth = Number(editMonthlyRentForm.pricePerMonth);
                if (Number.isNaN(pricePerMonth) || pricePerMonth < 0) {
                  setEditPriceError("Inserisci un canone valido.");
                  return;
                }
                setEditPriceSaving(true);
                setEditPriceError(null);
                try {
                  await followupApi.apartments.updateApartmentMonthlyRent(apartmentId, editMonthlyRentId, {
                    pricePerMonth,
                    deposit: editMonthlyRentForm.deposit ? Number(editMonthlyRentForm.deposit) : undefined,
                    validTo: editMonthlyRentForm.validTo || undefined,
                  });
                  refetchPrices();
                  setEditMonthlyRentOpen(false);
                  setEditMonthlyRentId(null);
                } catch (err) {
                  setEditPriceError(err instanceof Error ? err.message : "Errore modifica");
                } finally {
                  setEditPriceSaving(false);
                }
              }}
            >
              <div>
                <label className="text-sm font-medium text-foreground">Canone mensile (€)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1"
                  value={editMonthlyRentForm.pricePerMonth}
                  onChange={(e) => setEditMonthlyRentForm((f) => ({ ...f, pricePerMonth: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Deposito (€, opzionale)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1"
                  value={editMonthlyRentForm.deposit}
                  onChange={(e) => setEditMonthlyRentForm((f) => ({ ...f, deposit: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Data fine (opzionale)</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={editMonthlyRentForm.validTo}
                  onChange={(e) => setEditMonthlyRentForm((f) => ({ ...f, validTo: e.target.value }))}
                />
              </div>
              {editPriceError && <p className="text-sm text-destructive">{editPriceError}</p>}
            </form>
          </DrawerBody>
          <DrawerFooter>
            <Button type="submit" form="edit-monthly-rent-form" disabled={editPriceSaving}>
              {editPriceSaving ? "Salvataggio..." : "Salva"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
