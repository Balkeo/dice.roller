/// <reference types="@react-three/fiber" />

declare global {
  interface Window {
    teal: any;
    dice_initialize?: (container: HTMLElement) => void;
  }
}

export {};
