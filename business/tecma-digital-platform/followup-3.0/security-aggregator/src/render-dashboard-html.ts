import type { UnifiedReport } from "./schema.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Pagina HTML singola (nessuna dipendenza esterna): metriche, tabella filtrabile, stampabile.
 * Condivisibile: scarica l’artifact `security-dashboard.html` dalla run GitHub Actions o genera in locale.
 */
export function renderSecurityDashboardHtml(report: UnifiedReport): string {
  const { generatedAt, summary, issues } = report;
  const rows = issues
    .map((i, idx) => {
      const sev = escapeHtml(i.severity);
      const ref = escapeHtml(i.cveId ?? i.ruleId ?? "—");
      const msg = escapeHtml(i.message);
      const file = escapeHtml(i.file);
      const tool = escapeHtml(i.tool);
      const type = escapeHtml(i.type);
      const fix = i.fix ? escapeHtml(i.fix) : "—";
      return `<tr data-severity="${sev}" data-tool="${tool}" data-type="${type}" data-idx="${idx}">
        <td><span class="sev sev-${sev}">${sev}</span></td>
        <td>${type}</td>
        <td>${tool}</td>
        <td class="mono">${ref}</td>
        <td class="path" title="${file}">${file}</td>
        <td>${msg}</td>
        <td class="fix">${fix}</td>
      </tr>`;
    })
    .join("\n");

  const chip = (label: string, n: number, cls: string) =>
    `<div class="chip ${cls}"><span class="n">${n}</span><span class="lbl">${escapeHtml(label)}</span></div>`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>FollowUp 3.0 — Security dashboard</title>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --text:#e7ecf3; --muted:#8b9cb3; --border:#2d3a4d;
      --crit:#f85149; --high:#db6d28; --med:#d29922; --low:#3fb950; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 1.25rem; line-height: 1.45; }
    h1 { font-size: 1.35rem; margin: 0 0 0.25rem; font-weight: 650; }
    .sub { color: var(--muted); font-size: 0.85rem; margin-bottom: 1.25rem; }
    .share { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; font-size: 0.88rem; color: var(--muted); }
    .share strong { color: var(--text); }
    .chips { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1rem; }
    .chip { display: flex; align-items: baseline; gap: 0.35rem; padding: 0.45rem 0.75rem; border-radius: 8px; background: var(--card); border: 1px solid var(--border); }
    .chip .n { font-weight: 700; font-size: 1.15rem; }
    .chip .lbl { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
    .chip.tot .n { color: var(--text); }
    .chip.critical .n { color: var(--crit); }
    .chip.high .n { color: var(--high); }
    .chip.medium .n { color: var(--med); }
    .chip.low .n { color: var(--low); }
    .filters { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem; }
    .filters label { font-size: 0.8rem; color: var(--muted); margin-right: 0.25rem; }
    .filters button, .filters select, .filters input { background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem 0.6rem; font-size: 0.85rem; cursor: pointer; }
    .filters button.on { border-color: #58a6ff; background: #1f3a5f; }
    .filters input[type="search"] { min-width: 12rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; background: var(--card); border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
    th, td { text-align: left; padding: 0.5rem 0.65rem; border-bottom: 1px solid var(--border); vertical-align: top; }
    th { background: #131d2e; color: var(--muted); font-weight: 600; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
    tr:last-child td { border-bottom: none; }
    tr.hidden { display: none; }
    .sev { font-weight: 700; font-size: 0.72rem; text-transform: uppercase; padding: 0.15rem 0.4rem; border-radius: 4px; }
    .sev-critical { background: #3d1f1f; color: var(--crit); }
    .sev-high { background: #3d2818; color: var(--high); }
    .sev-medium { background: #3d3518; color: var(--med); }
    .sev-low { background: #1f3d28; color: var(--low); }
    .mono { font-family: ui-monospace, monospace; font-size: 0.78rem; word-break: break-all; }
    .path { max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fix { max-width: 12rem; font-size: 0.78rem; color: var(--muted); }
    @media print {
      body { background: #fff; color: #111; }
      .share, .filters { border: 1px solid #ccc; }
      .chip, table { border-color: #ccc; }
      th { background: #eee; color: #333; }
    }
  </style>
</head>
<body>
  <h1>FollowUp 3.0 — Security dashboard</h1>
  <p class="sub">Generato: <strong>${escapeHtml(generatedAt)}</strong> · Issue deduplicate: <strong>${summary.total}</strong></p>
  <div class="share">
    <strong>Come condividere:</strong> questo file è autonomo (apri in browser). Dalla CI GitHub: Actions → run <em>FollowUp 3.0 Security</em> → artifact <em>security-unified-followup3</em> include anche <code>security-dashboard.html</code>. Puoi allegarlo a Confluence/Jira o inviarlo via email. Per link permanente servirebbe GitHub Pages o un bucket — vedi runbook.
  </div>
  <div class="chips">
    ${chip("Totale", summary.total, "tot")}
    ${chip("Critical", summary.bySeverity.critical, "critical")}
    ${chip("High", summary.bySeverity.high, "high")}
    ${chip("Medium", summary.bySeverity.medium, "medium")}
    ${chip("Low", summary.bySeverity.low, "low")}
  </div>
  <div class="chips" style="margin-top:-0.5rem">
    ${chip("SAST", summary.byType.SAST, "tot")}
    ${chip("SCA", summary.byType.SCA, "tot")}
    ${chip("CONTAINER", summary.byType.CONTAINER, "tot")}
    ${chip("IAC", summary.byType.IAC, "tot")}
  </div>
  <div class="filters">
    <span><label>Severità</label></span>
    <button type="button" class="f-sev on" data-sev="">Tutte</button>
    <button type="button" class="f-sev" data-sev="critical">Critical</button>
    <button type="button" class="f-sev" data-sev="high">High</button>
    <button type="button" class="f-sev" data-sev="medium">Medium</button>
    <button type="button" class="f-sev" data-sev="low">Low</button>
    <span style="margin-left:0.75rem"><label>Tool</label></span>
    <select id="f-tool">
      <option value="">Tutti</option>
      <option value="semgrep">semgrep</option>
      <option value="osv">osv</option>
      <option value="trivy">trivy</option>
    </select>
    <span style="margin-left:0.75rem"><label>Cerca</label></span>
    <input type="search" id="f-q" placeholder="file, messaggio, CVE…" autocomplete="off"/>
  </div>
  <table>
    <thead><tr><th>Severità</th><th>Tipo</th><th>Tool</th><th>Regola / CVE</th><th>File</th><th>Messaggio</th><th>Fix / hint</th></tr></thead>
    <tbody id="tbody">${rows || "<tr><td colspan=\"7\">Nessun issue.</td></tr>"}</tbody>
  </table>
  <script>
(function(){
  var curSev = "";
  var tbody = document.getElementById("tbody");
  var rows = tbody ? tbody.querySelectorAll("tr[data-severity]") : [];
  function apply(){
    var tool = (document.getElementById("f-tool")||{}).value || "";
    var q = (((document.getElementById("f-q")||{}).value)||"").toLowerCase();
    rows.forEach(function(tr){
      var ok = true;
      if(curSev && tr.getAttribute("data-severity") !== curSev) ok = false;
      if(tool && tr.getAttribute("data-tool") !== tool) ok = false;
      if(q && tr.innerText.toLowerCase().indexOf(q) < 0) ok = false;
      tr.classList.toggle("hidden", !ok);
    });
  }
  document.querySelectorAll(".f-sev").forEach(function(btn){
    btn.addEventListener("click", function(){
      document.querySelectorAll(".f-sev").forEach(function(b){ b.classList.remove("on"); });
      btn.classList.add("on");
      curSev = btn.getAttribute("data-sev") || "";
      apply();
    });
  });
  var st = document.getElementById("f-tool");
  if(st) st.addEventListener("change", apply);
  var sq = document.getElementById("f-q");
  if(sq) sq.addEventListener("input", apply);
})();
  </script>
</body>
</html>`;
}
