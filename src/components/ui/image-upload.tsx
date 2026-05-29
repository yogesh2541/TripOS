"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ImageUpload({
  value,
  onChange,
  className,
  height = "h-32",
  label,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  className?: string;
  height?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Upload failed");
      }
      onChange(data.url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function pick() {
    if (isUploading) return;
    inputRef.current?.click();
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          // reset so re-picking the same file fires onChange again
          e.target.value = "";
        }}
      />

      {value ? (
        <div
          role="button"
          tabIndex={0}
          onClick={pick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick();
            }
          }}
          className={cn(
            "relative group rounded-[10px] bg-cover bg-center border border-line cursor-pointer overflow-hidden",
            height
          )}
          style={{ backgroundImage: `url(${value})` }}
        >
          <div className="absolute inset-0 bg-inkwash/0 group-hover:bg-inkwash/45 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <span className="h-9 px-3 rounded-[8px] bg-paper text-ink text-xs uppercase tracking-[0.16em] inline-flex items-center gap-1.5 shadow-soft">
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Replace
            </span>
            <button
              type="button"
              onClick={clear}
              className="h-9 w-9 rounded-[8px] bg-paper text-bad inline-flex items-center justify-center shadow-soft hover:bg-bad-soft"
              aria-label="Remove image"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) upload(f);
          }}
          disabled={isUploading}
          className={cn(
            "w-full rounded-[10px] border-2 border-dashed bg-paper-2 transition-all",
            "flex flex-col items-center justify-center gap-2 text-muted",
            "hover:border-[var(--gold-line)] hover:bg-paper",
            isDragging
              ? "border-[var(--gold-line)] bg-gold-soft/50 text-gold-deep"
              : "border-line",
            isUploading && "opacity-60 cursor-wait",
            height
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-xs uppercase tracking-[0.18em]">
                Uploading…
              </p>
            </>
          ) : (
            <>
              <ImageIcon className="h-5 w-5" />
              <p className="text-xs uppercase tracking-[0.18em]">
                {label ?? "Click or drop an image"}
              </p>
              <p className="text-[10px] tracking-wide">
                JPG · PNG · WEBP · max 8 MB
              </p>
            </>
          )}
        </button>
      )}
    </div>
  );
}
