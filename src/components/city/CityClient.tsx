"use client";

import dynamic from "next/dynamic";
import { Hud } from "@/components/hud/Hud";
import { Ambience } from "@/components/hud/Ambience";
import { InfoPanel } from "@/components/hud/InfoPanel";
import { PaintStudio } from "@/components/hud/PaintStudio";
import { StackGame } from "@/components/hud/StackGame";
import { WelcomeScreen } from "@/components/hud/WelcomeScreen";
import type { Content } from "@/content/schema";
import { setLiveContent } from "@/content/live";
import { FlappyGame } from "@/components/hud/FlappyGame";
import { MenuCard } from "@/components/hud/MenuCard";
import { RaceHud } from "@/components/hud/RaceHud";
import { XoGame } from "@/components/hud/XoGame";
import { useCityStore } from "@/state/useCityStore";

// WebGL and physics only run in the browser.
const CityCanvas = dynamic(() => import("./CityCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-violet-200">Building the city…</div>
  ),
});

export function CityClient({ content }: { content: Content }) {
  // Everything below reads the published content through liveContent.
  setLiveContent(content);
  const started = useCityStore((s) => s.started);
  const activity = useCityStore((s) => s.activity);
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="sr-only">
        <h1>Wouroud&apos;s City, the 3D portfolio of Wouroud El Khaldi</h1>
        <p>
          A walkable 3D city where every building comes from her portfolio: work experience, skills, projects, studies,
          certificates, languages and hobbies. The same content is available as a regular page.
        </p>
        <a href="/resume">Read the résumé as a regular page</a>
      </div>
      <CityCanvas />
      {started ? (
        <>
          <Hud />
          <Ambience />
          <InfoPanel />
          {activity === "stack" && <StackGame />}
          {activity === "paint" && <PaintStudio />}
          {activity === "xo" && <XoGame />}
          {activity === "flappy" && <FlappyGame />}
          <RaceHud />
          <MenuCard />
        </>
      ) : (
        <WelcomeScreen />
      )}
    </div>
  );
}
