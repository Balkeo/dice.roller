// src/die-types.ts
import * as THREE from "three";
import {
  ConvexArgs,
  geometryToConvexArgs,
  FaceGroup,
  getIndexArray,
} from "./convex";

export type DieKind = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";
export type InternalKind = DieKind | "d10_tens" | "d10_units";

export type GroupsBuilder = (geom: THREE.BufferGeometry) => {
  groups: FaceGroup[];
  triToGroup: Uint16Array;
};

export type DieSpec = {
  kind: InternalKind;
  makeGeometry: () => THREE.BufferGeometry;
  convex: () => ConvexArgs;
  // one label/value per PHYSICAL face
  labelForGroup: (g: FaceGroup, all: FaceGroup[]) => string;
  valueForGroup: (g: FaceGroup, all: FaceGroup[]) => number;
  maxValue: number;
  scale?: number;
  color?: string;
  labelSize?: number;
  /** Optional: custom face grouping */
  groupsBuilder?: GroupsBuilder;
  /** Which face determines the result (D4 uses the *bottom* face) */
  readMode?: "top" | "bottom";
};

/* ---------- Regular solids ---------- */
const geomD4 = () => new THREE.TetrahedronGeometry(0.75);
const geomD6 = () => new THREE.BoxGeometry(1, 1, 1);
const geomD8 = () => new THREE.OctahedronGeometry(0.9);
const geomD12 = () => new THREE.DodecahedronGeometry(0.95);
const geomD20 = () => new THREE.IcosahedronGeometry(1.1);

/* ---------- Helper: force all triangles to face outward ---------- */
function orientTrianglesOutward(g: THREE.BufferGeometry) {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;

  // Use existing index or synthesize one for non-indexed
  const idx =
    g.getIndex() ??
    new THREE.BufferAttribute(
      Uint32Array.from({ length: pos.count }, (_, i) => i),
      1,
    );

  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  const n = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (let t = 0; t < idx.count; t += 3) {
    const ia = idx.getX(t),
      ib = idx.getX(t + 1),
      ic = idx.getX(t + 2);

    A.set(pos.getX(ia), pos.getY(ia), pos.getZ(ia));
    B.set(pos.getX(ib), pos.getY(ib), pos.getZ(ib));
    C.set(pos.getX(ic), pos.getY(ic), pos.getZ(ic));

    // normal = (B - A) x (C - A)
    n.copy(B).sub(A).cross(C.clone().sub(A));
    // centroid of the triangle
    centroid
      .copy(A)
      .add(B)
      .add(C)
      .multiplyScalar(1 / 3);

    // For a convex, origin-centered solid, outward ≈ dot(normal, centroid) > 0
    if (n.dot(centroid) < 0) {
      // flip winding: swap B <-> C
      idx.setX(t + 1, ic);
      idx.setX(t + 2, ib);
    }
  }

  if (!g.getIndex()) {
    // If we synthesized an index, write it back so the flips persist
    g.setIndex(idx);
    g.toNonIndexed(); // keep it non-indexed afterwards
  }
}

/* -----------------------------------------------------------------------------
   D10 (pentagonal trapezohedron) — Teal-compatible, complete 20-triangle surface
   -----------------------------------------------------------------------------
   Matches the original algorithm:
   - Build 10 ring points with alternating small Z offset (±h), normalized.
   - Add two poles (bottom = z=-1, top = z=+1).
   - First 10 triangles are the *numbered faces* (each is an apex triangle).
   - Last 10 triangles are the waist/belt (no labels).
   We then group triangles into 10 physical faces (kites): two apex tris plus
   the adjacent belt tri that shares the same ring diagonal.
----------------------------------------------------------------------------- */

/** Returns all 20 triangles for Teal-style D10. */
function geomD10_TealFull(): THREE.BufferGeometry {
  const h = 0.105; // original offset
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10;
    const p = new THREE.Vector3(Math.cos(a), Math.sin(a), i % 2 ? +h : -h);
    p.normalize(); // normalize to unit radius like the original
    ring.push(p);
  }
  // 10 = bottom apex, 11 = top apex
  const V = [...ring, new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, +1)];

  // Triangles in the same order as Teal's "faces" (first 10 apex faces -> labels)
  const tris: [number, number, number][] = [
    // apex (numbered) faces
    [5, 7, 11],
    [4, 2, 10],
    [1, 3, 11],
    [0, 8, 10],
    [7, 9, 11],
    [8, 6, 10],
    [9, 1, 11],
    [2, 0, 10],
    [3, 5, 11],
    [6, 4, 10],
    // belt faces (no labels)
    [1, 0, 2],
    [1, 2, 3],
    [3, 2, 4],
    [3, 4, 5],
    [5, 4, 6],
    [5, 6, 7],
    [7, 6, 8],
    [7, 8, 9],
    [9, 8, 0],
    [9, 0, 1],
  ];

  const pos: number[] = [];
  for (const [i0, i1, i2] of tris) {
    const A = V[i0],
      B = V[i1],
      C = V[i2];
    pos.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));

  // Make sure all windings face outward to avoid culling/“missing triangle”
  orientTrianglesOutward(g);
  g.computeVertexNormals();
  return g;
}

/**
 * Group triangles into the 10 *numbered* faces.
 * A face is the pair of apex triangles that share the same ring diagonal.
 * Belt triangles are mapped to that group to keep picking stable.
 */
const buildD10Groups_Teal: GroupsBuilder = (geom) => {
  const pos = geom.getAttribute("position") as THREE.BufferAttribute;
  const index = getIndexArray(geom);
  const triCount = Math.floor(index.length / 3);
  if (triCount !== 20)
    throw new Error("D10 should have 20 triangles (10 apex + 10 belt).");

  const ringN = 10;
  const apexBot = 10;
  const apexTop = 11;

  const keyForPair = (a: number, b: number) => {
    const i = (a + ringN) % ringN,
      j = (b + ringN) % ringN;
    const [x, y] = i < j ? [i, j] : [j, i];
    return `${x}_${y}`;
  };

  const groups: FaceGroup[] = [];
  const triToGroup = new Uint16Array(triCount).fill(0xffff);
  const keyToIndex = new Map<string, number>();

  const addTriToGroup = (t: number, key: string) => {
    let gi = keyToIndex.get(key);
    if (gi === undefined) {
      gi = groups.length;
      keyToIndex.set(key, gi);
      groups.push({
        center: new THREE.Vector3(),
        normal: new THREE.Vector3(),
        triIndices: [],
      });
    }
    triToGroup[t] = gi;
    groups[gi].triIndices!.push(t);
  };

  // First pass: apex triangles define the 10 numbered faces
  for (let t = 0; t < triCount; t++) {
    const i0 = index[t * 3 + 0],
      i1 = index[t * 3 + 1],
      i2 = index[t * 3 + 2];
    const tri = [i0, i1, i2];

    const hasApex = tri.includes(apexTop) || tri.includes(apexBot);
    if (hasApex) {
      const ringVerts = tri.filter((v) => v < ringN); // two ring indices
      const key = keyForPair(ringVerts[0], ringVerts[1]);
      addTriToGroup(t, key);
    }
  }

  // Second pass: map belt triangles to the group of the ring diagonal they belong to
  for (let t = 0; t < triCount; t++) {
    if (triToGroup[t] !== 0xffff) continue; // already grouped (apex)
    const i0 = index[t * 3 + 0],
      i1 = index[t * 3 + 1],
      i2 = index[t * 3 + 2];
    // choose the ring pair that are 2 apart mod 10 → the diagonal of a kite
    const pairs: [number, number][] = [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ].filter(
      ([a, b]) =>
        Math.abs(a - b) % ringN === 2 || Math.abs(a - b) % ringN === 8,
    );
    const [a, b] = pairs[0]; // exactly one such pair
    const key = keyForPair(a, b);
    addTriToGroup(t, key);
  }

  // Compute center & normal per group
  const A = new THREE.Vector3(),
    B = new THREE.Vector3(),
    C = new THREE.Vector3();
  const V = (vi: number) =>
    new THREE.Vector3(pos.getX(vi), pos.getY(vi), pos.getZ(vi));

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const n = new THREE.Vector3();
    const c = new THREE.Vector3();
    let vcount = 0;

    for (const t of g.triIndices!) {
      const i0 = index[t * 3 + 0],
        i1 = index[t * 3 + 1],
        i2 = index[t * 3 + 2];
      A.copy(V(i0));
      B.copy(V(i1));
      C.copy(V(i2));
      const nt = C.clone().sub(B).cross(A.clone().sub(B));
      if (nt.lengthSq() > 1e-10) nt.normalize();
      n.add(nt);
      c.add(A).add(B).add(C);
      vcount += 3;
    }

    if (vcount > 0) c.multiplyScalar(1 / vcount);
    if (n.lengthSq() > 0) n.normalize();
    if (n.dot(c) < 0) n.negate(); // ensure outwardish
    g.center = c;
    g.normal = n;
  }

  return { groups, triToGroup };
};

/* ---------- Helpers for labels/values ---------- */
function byIndex(color: string, labelSize: number) {
  return {
    labelForGroup: (_g: FaceGroup, all: FaceGroup[]) =>
      String(all.indexOf(_g) + 1),
    valueForGroup: (_g: FaceGroup, all: FaceGroup[]) => all.indexOf(_g) + 1,
    color,
    labelSize,
  };
}

/* ---------- Dice specs ---------- */
export const D4: DieSpec = {
  kind: "d4",
  makeGeometry: geomD4,
  convex: () => geometryToConvexArgs(geomD4()),
  ...byIndex("#d04f4f", 0.33),
  maxValue: 4,
  scale: 0.85,
  readMode: "bottom", // D4 uses bottom face for result
};

export const D6: DieSpec = {
  kind: "d6",
  makeGeometry: geomD6,
  convex: () => geometryToConvexArgs(geomD6()),
  ...byIndex("#c61732", 0.36),
  maxValue: 6,
  scale: 0.85,
};

export const D8: DieSpec = {
  kind: "d8",
  makeGeometry: geomD8,
  convex: () => geometryToConvexArgs(geomD8()),
  ...byIndex("#3a86ff", 0.3),
  maxValue: 8,
  scale: 0.85,
};

export const D12: DieSpec = {
  kind: "d12",
  makeGeometry: geomD12,
  convex: () => geometryToConvexArgs(geomD12()),
  ...byIndex("#ff9f1c", 0.28),
  maxValue: 12,
  scale: 0.85,
};

export const D20: DieSpec = {
  kind: "d20",
  makeGeometry: geomD20,
  convex: () => geometryToConvexArgs(geomD20()),
  ...byIndex("#2ec4b6", 0.26),
  maxValue: 20,
  scale: 0.85,
};

export const D10: DieSpec = {
  kind: "d10",
  makeGeometry: () => geomD10_TealFull(),
  convex: () => geometryToConvexArgs(geomD10_TealFull()),
  ...byIndex("#7c3aed", 0.3),
  maxValue: 10,
  scale: 0.85,
  groupsBuilder: buildD10Groups_Teal,
};

/* ---------- D100 via percentile (tens + units) using the SAME D10 geom ---------- */
export const D10_TENS: DieSpec = {
  kind: "d10_tens",
  makeGeometry: () => geomD10_TealFull(),
  convex: () => geometryToConvexArgs(geomD10_TealFull()),
  labelForGroup: (_g, all) =>
    String((all.indexOf(_g) % 10) * 10).padStart(2, "0"),
  valueForGroup: (_g, all) => (all.indexOf(_g) % 10) * 10, // 0..90
  color: "#0ea5e9",
  labelSize: 0.28,
  maxValue: 100,
  scale: 0.82,
  groupsBuilder: buildD10Groups_Teal,
};

export const D10_UNITS: DieSpec = {
  kind: "d10_units",
  makeGeometry: () => geomD10_TealFull(),
  convex: () => geometryToConvexArgs(geomD10_TealFull()),
  labelForGroup: (_g, all) => String(all.indexOf(_g) % 10),
  valueForGroup: (_g, all) => all.indexOf(_g) % 10, // 0..9
  color: "#0369a1",
  labelSize: 0.28,
  maxValue: 10,
  scale: 0.82,
  groupsBuilder: buildD10Groups_Teal,
};
