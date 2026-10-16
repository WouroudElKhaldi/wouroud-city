"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import { CenterAt, SkillCenterpiece } from "../SkillRooms";
import { Text } from "../Text3D";
import { flat } from "./finishKit";
import { useHouse } from "./SkillHouse";
import { SIGNATURES } from "./signatures/index";
import type { SigProps } from "./signatures/types";

/**
 * Places the hall's centerpiece (the house's `hero`) and the signature rooms. A hero of "demo" is the
 * skill's classic interactive centerpiece (SkillRooms.tsx). A piece not built yet shows a placeholder.
 */

export function Hero() {
  const { def, plan } = useHouse();
  const [hx, hz] = plan.hero;
  const area = useMemo(() => {
    const h = plan.hall;
    return { w: Math.min(h.w - 2.4, 9), d: Math.min(7.5, h.d - 3) };
  }, [plan.hall]);
  const toHouse = useMemo(() => (x: number, z: number): [number, number] => [hx + x, hz + z], [hx, hz]);
  if (def.hero === "demo") return <DemoAt x={hx} z={hz} />;
  return (
    <group position={[hx, 0, hz]}>
      <Signature id={def.hero} w={area.w} d={area.d} toHouse={toHouse} rot={0} label={def.concept} hero />
    </group>
  );
}

/** The skill's classic centerpiece at a world spot (it always faces +z). */
export function DemoAt({ x, z }: { x: number; z: number }) {
  const { skill, theme, accent } = useHouse();
  const at = useMemo<[number, number, number]>(() => [x, 0, z], [x, z]);
  return (
    <CenterAt at={at}>
      <SkillCenterpiece skill={skill} theme={theme} accent={accent} />
    </CenterAt>
  );
}

export function Signature(props: SigProps & { id: string }) {
  const Piece = SIGNATURES[props.id];
  if (Piece) return <Piece {...props} />;
  return <Placeholder {...props} />;
}

function Placeholder({ id, label }: SigProps & { id: string }) {
  const { palette, accent } = useHouse();
  return (
    <group>
      <mesh position={[0, 0.5, 0]} material={flat(palette.ink, 0.4, 0.3)}>
        <boxGeometry args={[1.2, 1, 1.2]} />
      </mesh>
      <mesh position={[0, 1.4, 0]} rotation-y={0.7} material={flat(accent, 0.3, 0.5)}>
        <octahedronGeometry args={[0.4, 0]} />
      </mesh>
      <Text position={[0, 0.6, 0.61]} fontSize={0.09} color={palette.paper} anchorX="center" maxWidth={1.1} textAlign="center">
        {`${label}\n(${id})`}
      </Text>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.6, 0.5, 0.6]} position={[0, 0.5, 0]} />
      </RigidBody>
    </group>
  );
}
