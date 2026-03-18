/**
 * Editor WYSIWYG (TipTap) per blocchi email: grassetto, titoli, sottolineato, elenchi.
 */
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Strikethrough,
  RemoveFormatting
} from "lucide-react";
import { useRef } from "react";
import type { Editor } from "@tiptap/core";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

function ToolbarButton({
  onClick,
  active,
  children,
  title
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-8 w-8 shrink-0 p-0", active && "bg-muted")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

function EditorToolbar({ editor, variant }: { editor: Editor | null; variant: "heading" | "body" }) {
  if (!editor) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1 py-1"
      onMouseDown={(e) => e.preventDefault()}
    >
      <ToolbarButton
        title="Grassetto"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Corsivo"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Sottolineato"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Barrato"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolbarButton
        title="Titolo 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Titolo 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Titolo 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Paragrafo"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <span className="text-xs font-medium">¶</span>
      </ToolbarButton>
      {variant === "body" ? (
        <>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <ToolbarButton
            title="Elenco puntato"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Elenco numerato"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Citazione"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <span className="text-xs font-serif">&quot;</span>
          </ToolbarButton>
        </>
      ) : null}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolbarButton
        title="Pulisci formattazione"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      >
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function EmailRichEditor({
  editorKey,
  variant,
  html,
  onChange
}: {
  editorKey: string;
  variant: "heading" | "body";
  html: string;
  onChange: (html: string) => void;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const starter =
    variant === "body"
      ? StarterKit.configure({
          code: false,
          codeBlock: false,
          heading: { levels: [1, 2, 3] },
          horizontalRule: false
        })
      : StarterKit.configure({
          code: false,
          codeBlock: false,
          heading: { levels: [1, 2, 3] },
          bulletList: false,
          orderedList: false,
          blockquote: false,
          horizontalRule: false
        });

  const editor = useEditor(
    {
      extensions: [
        starter,
        Underline,
        Placeholder.configure({
          placeholder:
            variant === "heading"
              ? "Titolo (H1, H2, grassetto, sottolineato…)"
              : "Testo: elenchi, grassetto, corsivo… Trascina qui le variabili."
        })
      ],
      content: html || (variant === "heading" ? "<h2>Titolo</h2>" : "<p></p>"),
      editorProps: {
        attributes: {
          class:
            "email-rich-editor min-h-[96px] max-w-none px-3 py-2 text-sm text-foreground outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-3 [&_blockquote]:italic"
        },
        handleDrop: (view, event) => {
          const e = event as DragEvent;
          const dt = e.dataTransfer?.getData("text/plain");
          if (dt?.startsWith("{{") && dt.includes("}}")) {
            e.preventDefault();
            const coords = view.posAtCoords({ left: e.clientX, top: e.clientY });
            if (coords != null) {
              const { tr } = view.state;
              tr.insertText(dt, coords.pos);
              view.dispatch(tr);
            }
            return true;
          }
          return false;
        }
      },
      onUpdate: ({ editor: ed }) => onChangeRef.current(ed.getHTML())
    },
    [editorKey, variant]
  );

  return (
    <div
      className="overflow-hidden rounded-lg border border-input bg-background shadow-sm"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
    >
      <EditorToolbar editor={editor} variant={variant} />
      <EditorContent editor={editor} className="[&_.ProseMirror]:min-h-[96px]" />
    </div>
  );
}
