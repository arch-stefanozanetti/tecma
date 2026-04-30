import { useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { AiActionDraft } from "../../types/domain";
import { Button } from "../../components/ui/button";

interface ApprovalsPageProps {
  workspaceId: string;
  projectIds: string[];
}

export const ApprovalsPage = ({ workspaceId, projectIds }: ApprovalsPageProps) => {
  const [rows, setRows] = useState<AiActionDraft[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const response = await followupApi.queryAiActionDrafts({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 200,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      });
      setRows(response.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore caricamento approvals");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [workspaceId, projectIds]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    try {
      await followupApi.decideAiActionDraft(id, decision, "ui@followup.local");
      setRows((current) => current.map((row) => (row._id === id ? { ...row, status: decision } : row)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore decisione draft");
    }
  };

  return (
    <section className="hc-shell">
      <div className="hc-card">
        <div className="hc-head">
          <h3>AI Approval Queue</h3>
          <p>Azioni suggerite dall'AI in attesa di approvazione umana.</p>
        </div>

        {isLoading && (
          <div className="hc-processing">
            <div className="hc-dot-loader" />
            <p>Caricamento queue approvazioni...</p>
          </div>
        )}

        {!isLoading && (
          <div className="table-clients hc-table">
            <div className="clients-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5}>Nessun draft in queue.</td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row._id}>
                      <td>
                        <strong>{row.title}</strong>
                        <p className="generic-table-feedback">{row.message}</p>
                      </td>
                      <td>{row.actionType}</td>
                      <td>{row.status}</td>
                      <td>{row.createdAt}</td>
                      <td>
                        {row.status === "pending_approval" ? (
                          <div className="association-actions">
                            <Button variant="outline" className="min-h-11" onClick={() => void decide(row._id, "rejected")} type="button">
                              Reject
                            </Button>
                            <Button className="min-h-11" onClick={() => void decide(row._id, "approved")} type="button">
                              Approve
                            </Button>
                          </div>
                        ) : (
                          <span className="chip">{row.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {message && <p className="error">{message}</p>}
      </div>
    </section>
  );
};

