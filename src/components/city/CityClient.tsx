"use client";

import dynamic from "next/dynamic";
import { Hud } from "@/components/hud/Hud";
import { InfoPanel } from "@/components/hud/InfoPanel";
import { PaintStudio } from "@/components/hud/PaintStudio";
import { StackGame } from "@/components/hud/StackGame";
import { WelcomeScreen } from "@/components/hud/WelcomeScreen";
import { useCityStore } from "@/state/useCityStore";

// WebGL and physics only run in the browser.
const CityCanvas = dynamic(() => import("./CityCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-violet-200">Building the city…</div>
  ),
});

export function CityClient() {
  const started = useCityStore((s) => s.started);
  const activity = useCityStore((s) => s.activity);
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <CityCanvas />
      {started ? (
        <>
          <Hud />
          <InfoPanel />
          {activity === "stack" && <StackGame />}
          {activity === "paint" && <PaintStudio />}
        </>
      ) : (
        <WelcomeScreen />
      )}
    </div>
  );
}
