/**
 * A signature piece: built for one skill only. Drawn in its own frame like the room modules (its
 * front, or the room's doorway, toward +z; the back wall at z = -d/2 for rooms). For the hall's
 * centerpiece (`hero`), the frame is centered on the centerpiece spot and w × d is the floor area it
 * may use (the entrance is ahead, +z). `toHouse` maps local points to world points (for prompts,
 * seats and particle bursts); `rot` is the frame's turn around y (add it to local facings).
 */
export type SigProps = {
  w: number;
  d: number;
  toHouse: (x: number, z: number) => [number, number];
  rot: number;
  label: string;
  hero?: boolean;
};

export type SigComponent = (props: SigProps) => React.ReactNode;
