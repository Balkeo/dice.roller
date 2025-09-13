// src/FaceNumbers.tsx
import React from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { FaceGroup } from "./convex";

export function FaceNumbers({
  groups,
  labelForGroup,
  color = "white",
  size = 0.28,
  lift = 0.06, // more lift to avoid z-fighting
}: {
  groups: FaceGroup[];
  labelForGroup: (g: FaceGroup, all: FaceGroup[]) => string;
  color?: string;
  size?: number;
  lift?: number;
}) {
  return (
    <>
      {groups.map((g, i) => {
        const normal = g.normal.clone().normalize();
        const pos = g.center.clone().add(normal.clone().multiplyScalar(lift));
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          normal,
        );
        const label = labelForGroup(g, groups);
        return (
          <group key={i} position={pos} quaternion={q}>
            <Text
              fontSize={size}
              color={color}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.012}
              outlineColor="black"
              renderOrder={1000} // draw late
              depthTest={false} // don't let the die hide text
              depthWrite={false}
              toneMapped={false}
            >
              {label}
            </Text>
          </group>
        );
      })}
    </>
  );
}
