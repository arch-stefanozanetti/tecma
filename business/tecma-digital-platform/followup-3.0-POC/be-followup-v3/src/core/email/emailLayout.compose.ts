import sanitizeHtml from "sanitize-html";
import type { EmailFlowKey } from "./emailFlows.meta.js";
import { EMAIL_FLOW_METADATA } from "./emailFlows.meta.js";
import type { EmailBlock, EmailLayoutV1 } from "./emailLayout.schema.js";

const PH_HOST = "https://tz-email-ph.invalid";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mixWithAllowedPlaceholders(raw: string, allowed: Set<string>): string {
  const parts: string[] = [];
  let last = 0;
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    parts.push(escapeHtml(raw.slice(last, m.index)));
    parts.push(allowed.has(m[1]) ? `{{${m[1]}}}` : "");
    last = m.index + m[0].length;
  }
  parts.push(escapeHtml(raw.slice(last)));
  return parts.join("");
}

export function parseAllowedPlaceholdersInString(s: string): Set<string> {
  const out = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.add(m[1]);
  return out;
}

export function assertOnlyAllowedPlaceholders(
  s: string,
  allowed: Set<string>
): { ok: true } | { ok: false; unknown: string[] } {
  const found = parseAllowedPlaceholdersInString(s);
  const unknown = [...found].filter((k) => !allowed.has(k));
  if (unknown.length) return { ok: false, unknown };
  return { ok: true };
}

function shieldPlaceholdersForSanitize(html: string): { html: string; tokens: string[] } {
  const tokens: string[] = [];
  const out = html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const i = tokens.length;
    tokens.push(`{{${key}}}`);
    return `${PH_HOST}/p${i}`;
  });
  return { html: out, tokens };
}

function unshieldAfterSanitize(html: string, tokens: string[]): string {
  let s = html;
  for (let i = 0; i < tokens.length; i++) {
    s = s.split(`${PH_HOST}/p${i}`).join(tokens[i]);
  }
  return s;
}

/** Frammento HTML da editor ricco (titolo/corpo): placeholder ammessi, tag limitati. */
export function sanitizeRichEmailFragment(html: string, allowed: Set<string>): string {
  const stripped = html.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    allowed.has(k) ? `{{${k}}}` : ""
  );
  const { html: shielded, tokens } = shieldPlaceholdersForSanitize(stripped);
  const clean = sanitizeHtml(shielded, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "del",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "span",
      "div"
    ],
    allowedAttributes: {
      span: ["style"],
      p: ["style"],
      div: ["style"],
      li: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      blockquote: ["style"]
    },
    allowedStyles: {
      "*": {
        "text-decoration": [/^underline$/i, /^none$/i, /^line-through$/i],
        "text-align": [/^(left|center|right|justify)$/i]
      }
    },
    allowVulnerableTags: false
  });
  return unshieldAfterSanitize(clean, tokens);
}

export function sanitizeTransactionalEmailHtml(html: string): string {
  const { html: shielded, tokens } = shieldPlaceholdersForSanitize(html);
  const clean = sanitizeHtml(shielded, {
    allowedTags: [
      "html",
      "head",
      "body",
      "meta",
      "title",
      "table",
      "tbody",
      "thead",
      "tr",
      "td",
      "th",
      "div",
      "span",
      "p",
      "br",
      "h1",
      "h2",
      "h3",
      "h4",
      "strong",
      "em",
      "a",
      "img"
    ],
    allowedAttributes: {
      a: ["href", "style", "target"],
      img: ["src", "alt", "style"],
      td: ["align", "style", "valign", "colspan", "rowspan"],
      th: ["align", "style"],
      tr: ["style"],
      table: ["role", "width", "cellspacing", "cellpadding", "style", "align"],
      tbody: ["style"],
      div: ["style"],
      span: ["style"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      body: ["style"],
      html: ["lang"]
    },
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      img: ["http", "https"]
    },
    allowVulnerableTags: false
  });
  return unshieldAfterSanitize(clean, tokens);
}

export function isAssetUrlAllowed(url: string): boolean {
  const t = url.trim();
  if (!t) return true;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const raw = process.env.EMAIL_ASSET_URL_HOSTS?.trim();
  const hosts = raw
    ? raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  if (hosts.includes("*")) return true;
  if (hosts.length === 0) return false;
  const h = u.hostname.toLowerCase();
  return hosts.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
}

export function composeLayoutToHtml(flowKey: EmailFlowKey, layout: EmailLayoutV1): string {
  const meta = EMAIL_FLOW_METADATA[flowKey];
  const allowed = new Set(meta.placeholders);

  if (layout.logoUrl.trim() && !isAssetUrlAllowed(layout.logoUrl.trim())) {
    throw new Error("URL logo non consentito: configurare EMAIL_ASSET_URL_HOSTS");
  }

  const color = layout.primaryColor;
  const rows: string[] = [];

  if (layout.logoUrl.trim()) {
    const logoEsc = escapeHtml(layout.logoUrl.trim());
    rows.push(
      `<tr><td style="padding:24px 24px 8px;text-align:center;"><img src="${logoEsc}" alt="" style="max-height:52px;max-width:240px;"/></td></tr>`
    );
  }

  for (const block of layout.blocks as EmailBlock[]) {
    switch (block.type) {
      case "heading": {
        const b = block as { html?: string; text?: string };
        if (b.html?.trim()) {
          const frag = sanitizeRichEmailFragment(b.html, allowed);
          rows.push(
            `<tr><td style="padding:16px 24px 8px;color:${escapeHtml(color)};">${frag}</td></tr>`
          );
        } else if (b.text?.trim()) {
          const inner = mixWithAllowedPlaceholders(b.text, allowed);
          rows.push(
            `<tr><td style="padding:16px 24px 8px;"><h2 style="margin:0;font-size:22px;color:${escapeHtml(color)};">${inner}</h2></td></tr>`
          );
        } else {
          rows.push(`<tr><td style="padding:16px 24px 8px;"></td></tr>`);
        }
        break;
      }
      case "text": {
        const b = block as { html?: string; text?: string };
        if (b.html?.trim()) {
          const frag = sanitizeRichEmailFragment(b.html, allowed);
          rows.push(
            `<tr><td style="padding:8px 24px;color:#374151;font-size:15px;line-height:1.55;">${frag}</td></tr>`
          );
        } else if (b.text?.trim()) {
          const inner = mixWithAllowedPlaceholders(b.text, allowed);
          const paras = inner
            .split(/\n{2,}/)
            .map(
              (p) =>
                `<p style="margin:0 0 12px;line-height:1.5;color:#374151;">${p.replace(/\n/g, "<br/>")}</p>`
            );
          rows.push(`<tr><td style="padding:8px 24px;">${paras.join("")}</td></tr>`);
        } else {
          rows.push(`<tr><td style="padding:8px 24px;"></td></tr>`);
        }
        break;
      }
      case "button": {
        const label = mixWithAllowedPlaceholders(block.label, allowed);
        const hrefRaw = block.href.trim();
        const hrefMixed = mixWithAllowedPlaceholders(hrefRaw, allowed);
        if (!/\{\{\w+\}\}/.test(hrefRaw) && hrefRaw) {
          try {
            const u = new URL(hrefRaw);
            if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad");
          } catch {
            throw new Error("URL pulsante non valido");
          }
        }
        rows.push(
          `<tr><td style="padding:16px 24px;"><a href="${hrefMixed}" style="display:inline-block;padding:12px 24px;background:${escapeHtml(color)};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${label}</a></td></tr>`
        );
        break;
      }
      case "image": {
        if (!block.src.trim()) break;
        if (!isAssetUrlAllowed(block.src.trim())) {
          throw new Error("URL immagine non in whitelist");
        }
        const src = escapeHtml(block.src.trim());
        const alt = escapeHtml(block.alt || "");
        rows.push(
          `<tr><td style="padding:8px 24px;"><img src="${src}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px;"/></td></tr>`
        );
        break;
      }
      default:
        break;
    }
  }

  const innerTable = rows.join("\n");
  const html = `<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"/></head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f4f4f5;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
${innerTable}
<tr><td style="padding:20px 24px 28px;"><p style="margin:0;font-size:13px;color:#9ca3af;">Messaggio inviato da Followup.</p></td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return sanitizeTransactionalEmailHtml(html);
}
