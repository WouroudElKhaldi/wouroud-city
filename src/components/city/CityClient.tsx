"use client";

import dynamic from "next/dynamic";
import { Hud } from "@/components/hud/Hud";

// WebGL and physics only run in the browser.
const CityCanvas = dynamic(() => import("./CityCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-violet-200">Building the city…</div>
  ),
});

export function CityClient() {
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <CityCanvas />
      <Hud />
    </div>
  );
}
