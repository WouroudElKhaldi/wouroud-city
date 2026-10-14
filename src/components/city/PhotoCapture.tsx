"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";

/**
 * Photo mode: when the store asks for a photo, render the current view, add a
 * caption strip in the city's colors and save it as a PNG. A white flash and a
 * shutter sound make it feel like a camera.
 */
export function PhotoCapture() {
  const photoAt = useCityStore((s) => s.photoAt);
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    if (!photoAt) return;
    // Wait two frames so the info panel is gone from the screen.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        gl.render(scene, camera);
        const shot = gl.domElement;
        const out = document.createElement("canvas");
        const strip = Math.round(shot.height * 0.09);
        out.width = shot.width;
        out.height = shot.height + strip;
        const g = out.getContext("2d");
        if (!g) return;
        g.drawImage(shot, 0, 0);
        const grad = g.createLinearGradient(0, 0, out.width, 0);
        grad.addColorStop(0, "#1a103d");
        grad.addColorStop(1, "#4c1d95");
        g.fillStyle = grad;
        g.fillRect(0, shot.height, out.width, strip);
        g.fillStyle = "#fde68a";
        g.font = `700 ${Math.round(strip * 0.42)}px system-ui, sans-serif`;
        g.textBaseline = "middle";
        g.fillText("Wouroud's City", strip * 0.5, shot.height + strip / 2);
        g.fillStyle = "#e9d8fd";
        g.textAlign = "right";
        g.font = `500 ${Math.round(strip * 0.3)}px system-ui, sans-serif`;
        g.fillText(new Date(photoAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }), out.width - strip * 0.5, shot.height + strip / 2);
        const a = document.createElement("a");
        a.href = out.toDataURL("image/png");
        a.download = "wouroud-city-photo.png";
        a.click();
        sfx.click();
        const flash = document.createElement("div");
        flash.style.cssText = "position:fixed;inset:0;background:#fff;opacity:.85;pointer-events:none;transition:opacity 500ms;z-index:60";
        document.body.appendChild(flash);
        requestAnimationFrame(() => (flash.style.opacity = "0"));
        window.setTimeout(() => flash.remove(), 600);
        useCityStore.getState().toast("Saved to your downloads.", "📸 Photo taken");
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [photoAt, gl, scene, camera]);

  return null;
}
