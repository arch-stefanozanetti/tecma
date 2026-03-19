import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

export const NetworkStatusBanner = () => {
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [recentlyOnline, setRecentlyOnline] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setRecentlyOnline(true);
      setTimeout(() => setRecentlyOnline(false), 2500);
    };
    const goOffline = () => {
      setOnline(false);
      setRecentlyOnline(false);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && !recentlyOnline) return null;

  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium ${
        online ? "bg-emerald-600 text-white" : "bg-amber-500 text-amber-950"
      }`}
    >
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span>{online ? "Connessione ripristinata. Sincronizzazione in corso." : "Sei offline. Operazioni limitate finché la rete non torna disponibile."}</span>
    </div>
  );
};

