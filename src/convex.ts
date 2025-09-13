// src/convex.ts
import * as THREE from "three";

/** Convex args for @react-three/cannon */
export type ConvexArgs = { vertices: number[][]; faces: number[][] };

export function getIndexArray(geom: THREE.BufferGeometry): Uint32Array {
  const idx = geom.getIndex();
  if (idx) return idx.array as Uint32Array;
  const pos = geom.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) throw new Error("Geometry has no position attribute.");
  const arr = new Uint32Array(pos.count);
  for (let i = 0; i < pos.count; i++) arr[i] = i;
  return arr;
}

export function geometryToConvexArgs(geom: THREE.BufferGeometry): ConvexArgs {
  const pos = geom.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) throw new Error("Geometry has no position attribute.");

  const indexArray = getIndexArray(geom);
  if (indexArray.length % 3 !== 0) throw new Error("Geometry index/position not divisible by triangles.");

  const eps = 1e-6;
  const vertices: number[][] = [];
  const faces: number[][] = [];
  const vertMap = new Map<string, number>();

  const keyFor = (x:number,y:number,z:number)=>`${Math.round(x/eps)},${Math.round(y/eps)},${Math.round(z/eps)}`;
  const addVert = (x:number,y:number,z:number)=>{
    const k = keyFor(x,y,z); let i = vertMap.get(k);
    if (i===undefined){ i=vertices.length; vertMap.set(k,i); vertices.push([x,y,z]); }
    return i;
  };

  const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
  for (let f=0; f<indexArray.length; f+=3){
    const i0=indexArray[f+0], i1=indexArray[f+1], i2=indexArray[f+2];
    const va=addVert(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
    const vb=addVert(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
    const vc=addVert(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));
    faces.push([va,vb,vc]);
  }
  return { vertices, faces };
}

/** A physical face may be made of multiple triangles: group by normal. */
export type FaceGroup = { normal: THREE.Vector3; center: THREE.Vector3; triIndices: number[] };

export function buildFaceGroups(geom: THREE.BufferGeometry): {
  groups: FaceGroup[]; triToGroup: Uint16Array;
} {
  const pos = geom.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) throw new Error("Geometry has no position attribute.");
  const index = getIndexArray(geom);
  const triCount = Math.floor(index.length/3);

  const eps = 1e-3;
  const keyFor = (n: THREE.Vector3)=>`${Math.round(n.x/eps)},${Math.round(n.y/eps)},${Math.round(n.z/eps)}`;

  const A=new THREE.Vector3(), B=new THREE.Vector3(), C=new THREE.Vector3(), N=new THREE.Vector3();

  const map = new Map<string, FaceGroup>();
  const triToGroup = new Uint16Array(triCount);

  for (let t=0;t<triCount;t++){
    const i0=index[t*3+0], i1=index[t*3+1], i2=index[t*3+2];
    A.set(pos.getX(i0),pos.getY(i0),pos.getZ(i0));
    B.set(pos.getX(i1),pos.getY(i1),pos.getZ(i1));
    C.set(pos.getX(i2),pos.getY(i2),pos.getZ(i2));
    N.copy(C).sub(B).cross(A.clone().sub(B)).normalize(); // *** no sign flipping ***
    const k = keyFor(N);
    let g = map.get(k);
    if(!g){ g={ normal:N.clone(), center:new THREE.Vector3(), triIndices:[] }; map.set(k,g); }
    g.triIndices.push(t);
  }

  const groups = Array.from(map.values());
  // centers
  for (const g of groups){
    const c = new THREE.Vector3();
    for(const t of g.triIndices){
      const i0=index[t*3+0], i1=index[t*3+1], i2=index[t*3+2];
      A.set(pos.getX(i0),pos.getY(i0),pos.getZ(i0));
      B.set(pos.getX(i1),pos.getY(i1),pos.getZ(i1));
      C.set(pos.getX(i2),pos.getY(i2),pos.getZ(i2));
      c.add(A).add(B).add(C);
    }
    c.multiplyScalar(1/(g.triIndices.length*3));
    g.center.copy(c);
  }
  groups.forEach((g,gi)=>g.triIndices.forEach(t=>triToGroup[t]=gi));
  return { groups, triToGroup };
}
