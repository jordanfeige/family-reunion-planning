"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addGalleryItemAction } from "@/app/actions/trips";

export function GalleryUploader({ slug }: { slug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        const file = fd.get("file");
        if (!(file instanceof File) || file.size === 0) {
          setStatus("Pick a photo or short clip first.");
          return;
        }
        setBusy(true);
        try {
          const up = new FormData();
          up.append("file", file);
          const res = await fetch("/api/upload", {
            method: "POST",
            body: up,
          });
          if (!res.ok) {
            const err = await res.text();
            throw new Error(err || "Upload failed");
          }
          const { url } = (await res.json()) as { url: string };
          const isVideo = file.type.startsWith("video/");
          const save = new FormData();
          save.set("slug", slug);
          save.set("url", url);
          save.set("media_type", isVideo ? "video" : "image");
          save.set("caption", String(fd.get("caption") ?? ""));
          await addGalleryItemAction(save);
          form.reset();
          setStatus("Saved to the gallery.");
          router.refresh();
        } catch (err) {
          setStatus(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="file">Photo or video</label>
        <input id="file" name="file" type="file" accept="image/*,video/*" />
      </div>
      <div className="field">
        <label htmlFor="caption">Caption (optional)</label>
        <input id="caption" name="caption" placeholder="Cousin race to the dock" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Uploading…" : "Upload to gallery"}
      </button>
      {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
    </form>
  );
}
