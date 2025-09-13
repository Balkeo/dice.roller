// src/types.ts
export type UserConfig = {
  name: string;
  color: string; // hex #RRGGBB
  room: { id: string; code: string };
};
