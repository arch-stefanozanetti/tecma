import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

type PortalOverview = Awaited<ReturnType<typeof followupApi.portalGetOverview>>;

export const CustomerPortalPage = () => {
  const [params] = useSearchParams();
  const magicToken = params.get("token") ?? "";
  const [portalAccessToken, setPortalAccessToken] = useState<string>("");
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const accessToken =
          portalAccessToken ||
          (await followupApi.portalExchangeMagicLink(magicToken)).accessToken;
        if (!mounted) return;
        setPortalAccessToken(accessToken);
        const data = await followupApi.portalGetOverview(accessToken);
        if (!mounted) return;
        setOverview(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Impossibile accedere al portale cliente");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (!magicToken && !portalAccessToken) {
      setLoading(false);
      setError("Token mancante");
      return;
    }
    void run();
    return () => {
      mounted = false;
    };
  }, [magicToken, portalAccessToken]);

  const lastDeal = useMemo(() => overview?.deals[0], [overview]);

  if (loading) {
    return <div className="min-h-screen bg-app px-6 py-10 text-sm text-muted-foreground">Caricamento portale cliente...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-app px-6 py-10">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Accesso non disponibile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app px-6 py-8 md:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Area Cliente</h1>
          <p className="text-sm text-muted-foreground">
            {overview?.client.fullName ?? "Cliente"} - stato pratica e documenti
          </p>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!portalAccessToken || loggingOut}
              onClick={async () => {
                if (!portalAccessToken) return;
                setLoggingOut(true);
                try {
                  await followupApi.portalLogout(portalAccessToken);
                } finally {
                  setPortalAccessToken("");
                  setOverview(null);
                  setLoggingOut(false);
                  window.location.assign("/");
                }
              }}
            >
              Esci dal portale
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Trattative</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{overview?.deals.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Documenti</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{overview?.documents.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ultimo stato</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{lastDeal?.status ?? "N/D"}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Stato pratiche</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(overview?.deals ?? []).map((deal) => (
                <li key={deal.id} className="rounded border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{deal.type.toUpperCase()} - {deal.status}</span>
                    <span className="text-xs text-muted-foreground">{new Date(deal.updatedAt).toLocaleDateString("it-IT")}</span>
                  </div>
                  {deal.quoteNumber && (
                    <p className="mt-1 text-xs text-muted-foreground">Preventivo: {deal.quoteNumber}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documenti</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(overview?.documents ?? []).map((doc) => (
                <li key={doc.id} className="rounded border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{doc.title}</span>
                    <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString("it-IT")}</span>
                  </div>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">
                      Apri documento
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
