import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { seedContent } from "@/content/seed";

/** The picture shown when the site is shared on LinkedIn, WhatsApp, X, Slack... */
export const alt = "Wouroud's City: the 3D portfolio of Wouroud El Khaldi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const p = seedContent.profile;
  const photo = await readFile(join(process.cwd(), "public", p.photo ?? "/images/wouroud.png"));
  const src = `data:image/png;base64,${photo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 80px",
          background: "radial-gradient(circle at 20% 15%, #7c3aed 0%, #2e1065 45%, #1a103d 100%)",
          color: "#f3e8ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 26, letterSpacing: 8, color: "#f6c453", textTransform: "uppercase" }}>Welcome to</div>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, color: "#ffffff" }}>Wouroud&apos;s City</div>
          <div style={{ marginTop: 18, fontSize: 38, fontWeight: 700, color: "#5eead4" }}>{p.name}</div>
          <div style={{ fontSize: 30, color: "#e9d8fd" }}>{p.title}</div>
          <div style={{ marginTop: 28, display: "flex", gap: 14 }}>
            {["Walk a 3D city", "Skills as towers", "Play the arcade"].map((t) => (
              <div key={t} style={{ padding: "10px 20px", borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "2px solid rgba(246,196,83,0.6)", fontSize: 24 }}>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", padding: 10, borderRadius: 999, background: "linear-gradient(135deg, #f6c453, #a78bfa, #5eead4)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={330} height={330} alt="" style={{ borderRadius: 999, objectFit: "cover", objectPosition: "62% 42%", border: "8px solid #1a103d" }} />
        </div>
      </div>
    ),
    size,
  );
}
