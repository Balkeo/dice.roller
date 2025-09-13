import dynamic from "next/dynamic";
import React from "react";
import UserConfigForm from "../src/UserConfig";
import type { UserConfig } from "../src/types";
import { loadUserConfig, saveUserConfig } from "../src/storage";

const DiceApp = dynamic(() => import("../src/DiceApp"), { ssr: false });

export default function Home() {
  const [cfg, setCfg] = React.useState<UserConfig | null>(null);
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    const stored = loadUserConfig();
    if (stored) setCfg(stored);
    else setEditing(true);
  }, []);

  const handleSubmit = (next: UserConfig) => {
    saveUserConfig(next);
    setCfg(next);
    setEditing(false);
  };

  if (editing || !cfg) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f4f6f8",
          padding: "4vh 12px",
        }}
      >
        <UserConfigForm initial={cfg ?? undefined} onSubmit={handleSubmit} />
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <div
        style={{
          position: "absolute",
          zIndex: 3,
          top: 10,
          right: 10,
          background: "rgba(255,255,255,0.8)",
          borderRadius: 8,
          padding: "6px 10px",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: cfg.color,
              display: "inline-block",
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          />
          <strong>{cfg.name}</strong>
        </div>
        <span style={{ opacity: 0.7 }}>
          Room: {cfg.room.id} / {cfg.room.code}
        </span>
        <button
          onClick={() => setEditing(true)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#fff",
          }}
        >
          Edit
        </button>
      </div>

      <DiceApp user={cfg} />
    </div>
  );
}
