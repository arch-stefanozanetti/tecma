import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { buildGitDocUrl, getFollowupDocsBaseUrl, resolvePathFromExecutiveHref } from "./executiveDocLinks";
import { MermaidBlock } from "./MermaidBlock";
import { cn } from "../../lib/utils";

const linkClass = "text-primary underline underline-offset-2 hover:text-primary/90";

function ExecutiveMarkdownLink({
  className,
  href,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"a">) {
  const h = href ?? "";
  const isHttp = h.startsWith("http://") || h.startsWith("https://");
  if (isHttp) {
    return (
      <a href={h} className={cn(linkClass, className)} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }
  if (h.startsWith("#")) {
    return (
      <a href={h} className={cn(linkClass, className)} {...props}>
        {children}
      </a>
    );
  }
  const resolved = resolvePathFromExecutiveHref(h);
  const base = getFollowupDocsBaseUrl();
  if (resolved && base) {
    return (
      <a
        href={buildGitDocUrl(base, resolved)}
        className={cn(linkClass, className)}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  }
  if (resolved && !base) {
    return (
      <span
        className={cn(
          "cursor-help border-b border-dotted border-muted-foreground text-muted-foreground",
          className
        )}
        title={`Percorso nel repository: ${resolved}. Imposta VITE_FOLLOWUP_DOCS_BASE_URL (URL senza slash finale fino alla root followup-3.0 su Git) per aprire il file.`}
        {...props}
      >
        {children}
      </span>
    );
  }
  return (
    <a href={h} className={cn(linkClass, className)} {...props}>
      {children}
    </a>
  );
}

function textFromChildren(children: ReactNode): string {
  if (children == null) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).join("");
  if (isValidElement(children) && children.props && typeof children.props === "object" && "children" in children.props) {
    return textFromChildren((children.props as { children?: ReactNode }).children);
  }
  return "";
}

function PreWithMermaid({ children, className, ...props }: React.ComponentPropsWithoutRef<"pre">) {
  const childArr = Children.toArray(children);
  // react-markdown passa qui l'output del componente `code` custom: non è più un elemento
  // intrinseco con type === "code" — va cercato language-mermaid sulla className.
  const mermaidEl = childArr.find(
    (c): c is ReactElement<{ className?: string; children?: ReactNode }> => {
      if (!isValidElement(c)) return false;
      const cls = (c.props as { className?: string }).className ?? "";
      return cls.includes("language-mermaid");
    }
  );
  if (mermaidEl) {
    const chart = textFromChildren(mermaidEl.props.children).replace(/\n$/, "");
    return <MermaidBlock chart={chart} />;
  }
  return (
    <pre
      className={cn("mb-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-xs leading-relaxed", className)}
      {...props}
    >
      {children}
    </pre>
  );
}

const markdownComponents: Components = {
  pre: PreWithMermaid,
  h1: ({ className, ...props }) => <h1 className={cn("mb-3 mt-6 text-2xl font-bold tracking-tight first:mt-0", className)} {...props} />,
  h2: ({ className, ...props }) => <h2 className={cn("mb-2 mt-5 border-b border-border pb-1 text-xl font-semibold", className)} {...props} />,
  h3: ({ className, ...props }) => <h3 className={cn("mb-2 mt-4 text-lg font-semibold", className)} {...props} />,
  p: ({ className, ...props }) => <p className={cn("mb-3 text-sm leading-relaxed text-foreground", className)} {...props} />,
  ul: ({ className, ...props }) => <ul className={cn("mb-3 list-disc space-y-1 pl-6 text-sm", className)} {...props} />,
  ol: ({ className, ...props }) => <ol className={cn("mb-3 list-decimal space-y-1 pl-6 text-sm", className)} {...props} />,
  li: ({ className, ...props }) => <li className={cn("leading-relaxed", className)} {...props} />,
  a: ExecutiveMarkdownLink,
  table: ({ className, ...props }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-border">
      <table className={cn("w-full min-w-[32rem] border-collapse text-left text-xs", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => <thead className={cn("bg-muted/80", className)} {...props} />,
  th: ({ className, ...props }) => (
    <th className={cn("border-b border-border px-3 py-2 font-semibold text-foreground", className)} {...props} />
  ),
  td: ({ className, ...props }) => <td className={cn("border-b border-border px-3 py-2 align-top text-foreground", className)} {...props} />,
  tr: ({ className, ...props }) => <tr className={cn("border-border", className)} {...props} />,
  hr: ({ className, ...props }) => <hr className={cn("my-6 border-border", className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote className={cn("mb-3 border-l-4 border-primary/40 pl-4 text-sm italic text-muted-foreground", className)} {...props} />
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={cn("font-mono text-xs", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground" {...props}>
        {children}
      </code>
    );
  },
};

export function ExecutiveMarkdown({ source }: { source: string }) {
  return (
    <article className="max-w-none text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {source}
      </ReactMarkdown>
    </article>
  );
}
