"use client";

import { useEffect, useState } from "react";

/**
 * Screenshots, photos and short videos for a project or hobby (its `media` list: paths under
 * /public or full URLs). Thumbnails in a grid; click one to see it large, arrows or ← → to flip
 * through. Shows nothing when the list is empty.
 */

const isVideo = (src: string) => /\.(mp4|webm)$/i.test(src);
const isImage = (src: string) => /\.(png|jpe?g|webp|gif|avif)$/i.test(src);

export function MediaGallery({ media, title }: { media: string[]; title: string }) {
  const items = media.filter((m) => isImage(m) || isVideo(m));
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % items.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + items.length) % items.length));
      if (e.key === "Escape") {
        // Close the big view only, not the whole panel (its Escape listener is on window too).
        e.stopImmediatePropagation();
        setOpen(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, items.length]);

  if (!items.length) return null;
  const current = open === null ? null : items[open];
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-white">Gallery</p>
      {current ? (
        <figure className="mt-2">
          <div className="relative overflow-hidden rounded-xl bg-black/40">
            {isVideo(current) ? (
              <video src={current} controls autoPlay muted playsInline className="max-h-[50vh] w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current} alt={`${title}, ${open! + 1} of ${items.length}`} className="max-h-[50vh] w-full object-contain" />
            )}
          </div>
          <figcaption className="mt-2 flex items-center justify-between gap-2 text-sm text-violet-200">
            <button type="button" className="hud-chip text-white" onClick={() => setOpen((open! - 1 + items.length) % items.length)} aria-label="Previous">
              ←
            </button>
            <span>
              {open! + 1} / {items.length}
            </span>
            <span className="flex gap-2">
              <button type="button" className="hud-chip text-white" onClick={() => setOpen((open! + 1) % items.length)} aria-label="Next">
                →
              </button>
              <button type="button" className="hud-chip text-white" onClick={() => setOpen(null)}>
                Close
              </button>
            </span>
          </figcaption>
        </figure>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {items.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setOpen(i)}
              className="relative aspect-video overflow-hidden rounded-lg bg-white/5 ring-violet-300 hover:ring-2"
              aria-label={`Open ${title} media ${i + 1}`}
            >
              {isVideo(src) ? (
                <>
                  <video src={src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center text-2xl text-white">▶</span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
