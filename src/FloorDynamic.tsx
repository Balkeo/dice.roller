import React from "react";
import { usePlane, useBox } from "@react-three/cannon";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const ARENA_PADDING = 0.08;
const WALL_THICKNESS = 1.2;
const WALL_HEIGHT = 6;
const CEILING_Y = 5.5;

export function FloorDynamic() {
  const { size, camera } = useThree();
  const ortho = camera as THREE.OrthographicCamera;
  const worldW = size.width / ortho.zoom;
  const worldH = size.height / ortho.zoom;
  const innerW = worldW * (1 - ARENA_PADDING);
  const innerH = worldH * (1 - ARENA_PADDING);

  const [ref] = usePlane(() => ({
    type: "Static",
    rotation: [-Math.PI / 2, 0, 0],
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[innerW, innerH]} />
      <meshStandardMaterial color="#00FF00" />
    </mesh>
  );
}

export function WallsDynamic() {
  const { size, camera } = useThree();
  const ortho = camera as THREE.OrthographicCamera;
  const worldW = size.width / ortho.zoom;
  const worldH = size.height / ortho.zoom;
  const innerW = worldW * (1 - ARENA_PADDING);
  const innerH = worldH * (1 - ARENA_PADDING);
  const halfX = innerW / 2;
  const halfZ = innerH / 2;

  useBox(() => ({
    type: "Static",
    args: [innerW, WALL_HEIGHT, WALL_THICKNESS],
    position: [0, WALL_HEIGHT / 2, -halfZ],
  }));
  useBox(() => ({
    type: "Static",
    args: [innerW, WALL_HEIGHT, WALL_THICKNESS],
    position: [0, WALL_HEIGHT / 2, halfZ],
  }));
  useBox(() => ({
    type: "Static",
    args: [WALL_THICKNESS, WALL_HEIGHT, innerH],
    position: [-halfX, WALL_HEIGHT / 2, 0],
  }));
  useBox(() => ({
    type: "Static",
    args: [WALL_THICKNESS, WALL_HEIGHT, innerH],
    position: [halfX, WALL_HEIGHT / 2, 0],
  }));
  useBox(() => ({
    type: "Static",
    args: [innerW, WALL_THICKNESS, innerH],
    position: [0, CEILING_Y, 0],
  }));
  return null;
}
