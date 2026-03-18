/** Normalizza blocchi legacy (solo `text`) in HTML iniziale per TipTap. */

export function headingBlockToHtml(b: { html?: string; text?: string }): string {
  if (b.html?.trim()) return b.html;
  if (b.text?.trim()) {
    const esc = b.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<h2>${esc}</h2>`;
  }
  return "<h2>Titolo</h2>";
}

export function textBlockToHtml(b: { html?: string; text?: string }): string {
  if (b.html?.trim()) return b.html;
  if (b.text?.trim()) {
    return b.text
      .split(/\n{2,}/)
      .map((para) => {
        const esc = para
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br/>");
        return `<p>${esc}</p>`;
      })
      .join("");
  }
  return "<p></p>";
}
