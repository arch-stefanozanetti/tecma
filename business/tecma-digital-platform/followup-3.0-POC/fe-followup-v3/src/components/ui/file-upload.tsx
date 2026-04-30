/**
 * File Upload — DS Tecma Software Suite (Figma).
 * Drag & drop zone or button trigger. Optional subtitle, error message, list of uploaded files.
 */
import * as React from "react";
import { Upload, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export interface FileUploadFile {
  id: string;
  name: string;
  file?: File;
}

export interface FileUploadProps {
  /** Zone title (e.g. "Title") */
  title?: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Show "Upload" button inside zone (otherwise drag & drop only) */
  showButton?: boolean;
  /** Error message below zone */
  errorMessage?: string;
  /** Uploaded files to display with remove */
  files?: FileUploadFile[];
  onRemoveFile?: (id: string) => void;
  onFilesSelected?: (files: FileList | null) => void;
  /** Accept attribute for input */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  title = "Title",
  subtitle,
  showButton = false,
  errorMessage,
  files = [],
  onRemoveFile,
  onFilesSelected,
  accept,
  multiple,
  disabled,
  className,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    onFilesSelected?.(e.dataTransfer.files);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(true);
  };
  const handleDragLeave = () => setDrag(false);
  const handleClick = () => inputRef.current?.click();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected?.(e.target.files ?? null);
    e.target.value = "";
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={!showButton ? handleClick : undefined}
        role={!showButton ? "button" : undefined}
        tabIndex={!showButton ? 0 : undefined}
        onKeyDown={
          !showButton
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick();
                }
              }
            : undefined
        }
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background p-8 transition-colors",
          !showButton && "cursor-pointer",
          drag && !disabled && "border-primary bg-primary/5",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className={cn(
            showButton ? "hidden" : "absolute inset-0 cursor-pointer opacity-0",
          )}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleChange}
          aria-label="Carica file"
        />
        <Upload className="h-6 w-6 shrink-0 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && (
          <p className="text-center text-xs text-muted-foreground">{subtitle}</p>
        )}
        {showButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={disabled}
          >
            Upload
          </Button>
        )}
      </div>
      {errorMessage && (
        <p className="text-xs font-medium text-destructive">{errorMessage}</p>
      )}
      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {f.name}
              </span>
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(f.id)}
                  aria-label={`Rimuovi ${f.name}`}
                  className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
