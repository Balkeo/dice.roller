// src/Die.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { useConvexPolyhedron } from "@react-three/cannon";
import * as THREE from "three";
import { randomThrowAngular, randomThrowVelocity } from "./physics";
import type { DieSpec } from "./die-types";
import { geometryToConvexArgs, getIndexArray, buildFaceGroups } from "./convex";
import { FaceNumbers } from "./FaceNumbers";

export type DiePlan = {
  id: string;
  spec: DieSpec;
  position: [number, number, number];
  asD100?: { groupId: string; role: "tens" | "units" };
};

export function Die({
  plan,
  onTopValue,
  tintColor,
  rollToken,
  acceptUpdates, // set false when results modal is open to freeze value
}: {
  plan: DiePlan;
  onTopValue: (id: string, value: number) => void;
  tintColor?: string;
  rollToken: number;
  acceptUpdates: boolean;
}) {
  // 1) Build visual geometry
  const baseGeom = useMemo(() => plan.spec.makeGeometry(), [plan.spec]);

  // 2) ***BAKE SCALE INTO GEOMETRY*** so physics == visuals
  const scaledGeom = useMemo(() => {
    const g = baseGeom.clone();
    const s = plan.spec.scale ?? 1;
    if (s !== 1) g.scale(s, s, s);
    // Keep it centered (just in case a generator was slightly off)
    g.computeBoundingSphere();
    return g;
  }, [baseGeom, plan.spec.scale]);

  // 3) Build convex props from the *scaled* geometry
  const convex = useMemo(() => geometryToConvexArgs(scaledGeom), [scaledGeom]);

  // 4) Group triangles into physical faces (for labels & value mapping)
  const { groups, triToGroup } = useMemo(
    () =>
      plan.spec.groupsBuilder
        ? plan.spec.groupsBuilder(scaledGeom)
        : buildFaceGroups(scaledGeom),
    [scaledGeom, plan.spec],
  );

  // Material
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: tintColor ?? plan.spec.color ?? "#ffffff",
        roughness: 0.45,
        metalness: 0.1,
        side: THREE.DoubleSide, // avoid culling artifacts on shallow angles
      }),
    [tintColor, plan.spec.color],
  );

  // Physics body — uses the *scaled* convex hull
  const [ref, api] = useConvexPolyhedron<THREE.Mesh>(() => ({
    mass: 1,
    position: plan.position,
    args: [convex.vertices, convex.faces],
    angularDamping: 0.06,
    linearDamping: 0.015,
  }));

  // Keep still on mount until the first roll
  useEffect(() => {
    api.velocity.set(0, 0, 0);
    api.angularVelocity.set(0, 0, 0);
  }, [api]);

  // Throw when rollToken increments
  useEffect(() => {
    if (!rollToken) return;
    const v = randomThrowVelocity();
    const w = randomThrowAngular();
    api.velocity.set(v[0], v[1], v[2]);
    api.angularVelocity.set(w[0], w[1], w[2]);

    // a couple of small upward impulses to mimic a hand toss
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        api.applyImpulse(
          [0, 1.2 + Math.random() * 0.5, 0],
          [Math.random() * 0.15, 0, Math.random() * 0.15],
        );
      }, 50 + i * 55);
    }
  }, [api, rollToken]);

  // ------ Top/bottom-face detection (stabilized) ------
  const velRef = useRef<[number, number, number]>([0, 0, 0]);
  const lastGroup = useRef<number | null>(null);
  const stableCount = useRef(0);

  useEffect(
    () => api.velocity.subscribe((v) => (velRef.current = v)),
    [api.velocity],
  );

  useEffect(() => {
    const posAttr = scaledGeom.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const idxArr = getIndexArray(scaledGeom);
    const triCount = Math.floor(idxArr.length / 3);

    // D4 reads the bottom (-Y); others read top (+Y)
    const desired =
      plan.spec.readMode === "bottom"
        ? new THREE.Vector3(0, -1, 0)
        : new THREE.Vector3(0, 1, 0);

    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const C = new THREE.Vector3();
    const N = new THREE.Vector3();

    const interval = setInterval(() => {
      if (!acceptUpdates || !ref.current) return;

      const speed = Math.hypot(...velRef.current);
      if (speed > 0.12) {
        stableCount.current = 0;
        return;
      }

      let bestTri = 0;
      let bestDot = -Infinity;

      for (let f = 0; f < triCount; f++) {
        const i0 = idxArr[f * 3 + 0];
        const i1 = idxArr[f * 3 + 1];
        const i2 = idxArr[f * 3 + 2];

        A.set(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
        B.set(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
        C.set(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));

        A.applyMatrix4(ref.current.matrixWorld);
        B.applyMatrix4(ref.current.matrixWorld);
        C.applyMatrix4(ref.current.matrixWorld);

        N.copy(C).sub(B).cross(A.clone().sub(B)).normalize();

        const d = N.dot(desired);
        if (d > bestDot) {
          bestDot = d;
          bestTri = f;
        }
      }

      const gIdx = triToGroup[bestTri];
      if (lastGroup.current === gIdx) {
        stableCount.current++;
      } else {
        lastGroup.current = gIdx;
        stableCount.current = 1;
      }

      if (stableCount.current >= 3) {
        const value = plan.spec.valueForGroup(groups[gIdx], groups);
        onTopValue(plan.id, value);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [
    scaledGeom,
    onTopValue,
    plan.id,
    ref,
    acceptUpdates,
    groups,
    triToGroup,
    plan.spec.readMode,
  ]);

  // ----- Render (no mesh scale here — already baked into geometry) -----
  return (
    <mesh
      ref={ref}
      geometry={scaledGeom}
      material={mat}
      castShadow
      receiveShadow
    >
      <FaceNumbers
        groups={groups}
        labelForGroup={plan.spec.labelForGroup}
        color="white"
        size={plan.spec.labelSize ?? 0.28}
        lift={0.06}
      />
    </mesh>
  );
}
