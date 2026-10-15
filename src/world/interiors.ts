import type { DistrictId } from "./districts";

/**
 * Buildings you can walk into. A room is its own scene, `room:<district>:<building id>`,
 * built from that building's content (a job's office, a project's studio).
 */
export type RoomScene = `room:${DistrictId}:${string}`;

/** Districts whose content buildings have interiors. */
export const ROOM_DISTRICTS: DistrictId[] = ["business", "projects"];

export const roomScene = (district: DistrictId, id: string): RoomScene => `room:${district}:${id}`;

export function parseRoom(scene: string): { district: DistrictId; id: string } | null {
  if (!scene.startsWith("room:")) return null;
  const [, district, ...rest] = scene.split(":");
  return { district: district as DistrictId, id: rest.join(":") };
}

/** The district a scene belongs to (a room's district), or null for the hub. */
export function sceneDistrict(scene: string): DistrictId | null {
  if (scene === "hub") return null;
  return parseRoom(scene)?.district ?? (scene as DistrictId);
}

/** Room size: x across, z from the back wall to the entrance. */
export type RoomSize = { width: number; depth: number; height: number };

export const ROOM: RoomSize = { width: 24, depth: 18, height: 5.2 };

/** Sahme Trading is a whole headquarters floor: departments around a trading floor. */
export const HQ_ROOM: RoomSize = { width: 44, depth: 32, height: 5.6 };

/** The size of a building's room. */
export const roomSize = (id: string): RoomSize => (id === "sahme" ? HQ_ROOM : ROOM);
