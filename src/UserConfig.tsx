// src/UserConfig.tsx
import React from "react";
import type { UserConfig } from "./types";

export function randomColor() { return "#" + Math.floor(Math.random()*0xffffff).toString(16).padStart(6,"0"); }
export function randomId(prefix="room") { return `${prefix}-${Math.random().toString(36).slice(2,8)}`; }
export function randomCode() { return Math.random().toString(36).slice(2,6).toUpperCase(); }

export default function UserConfigForm({
  initial, onSubmit,
}: { initial?: Partial<UserConfig>, onSubmit: (cfg: UserConfig)=>void }) {
  const [name,setName]=React.useState(initial?.name ?? "");
  const [color,setColor]=React.useState(initial?.color ?? randomColor());
  const [roomId,setRoomId]=React.useState(initial?.room?.id ?? randomId());
  const [roomCode,setRoomCode]=React.useState(initial?.room?.code ?? randomCode());
  const [error,setError]=React.useState<string|null>(null);

  const handleSubmit=(e:React.FormEvent)=>{
    e.preventDefault();
    if(!name.trim()) return setError("Please enter a name.");
    if(!/^#[0-9a-f]{6}$/i.test(color)) return setError("Pick a valid color.");
    if(!roomId.trim()) return setError("Room ID is required.");
    if(!/^[A-Z0-9]{4,8}$/i.test(roomCode)) return setError("Room code must be 4–8 letters/numbers.");
    setError(null);
    onSubmit({ name:name.trim(), color:color.toUpperCase(), room:{ id:roomId.trim(), code:roomCode.toUpperCase() } });
  };

  return (
    <form onSubmit={handleSubmit}
      style={{maxWidth:440, margin:"10vh auto", padding:20, background:"white",
        borderRadius:12, boxShadow:"0 8px 30px rgba(0,0,0,0.12)"}}>
      <h1 style={{margin:0, marginBottom:8}}>Set up your game</h1>
      <p style={{marginTop:0, color:"#555"}}>Configure your info before entering the 3D dice tray.</p>

      <label style={{display:"block", marginTop:12}}>
        <div style={{fontSize:13, marginBottom:6}}>Name</div>
        <input type="text" value={name} onChange={e=>setName(e.currentTarget.value)}
          placeholder="Your name" style={{width:"100%", padding:10, borderRadius:8, border:"1px solid #ddd"}}/>
      </label>

      <label style={{display:"block", marginTop:12}}>
        <div style={{fontSize:13, marginBottom:6}}>Dice Color</div>
        <div style={{display:"flex", gap:10, alignItems:"center"}}>
          <input type="color" value={color} onChange={e=>setColor(e.currentTarget.value)}
            style={{width:48, height:40, border:"none", background:"transparent", padding:0}}/>
          <input type="text" value={color} onChange={e=>setColor(e.currentTarget.value)}
            style={{flex:1, padding:10, borderRadius:8, border:"1px solid #ddd", fontFamily:"monospace"}}/>
          <button type="button" onClick={()=>setColor(randomColor())}
            style={{padding:"8px 10px", borderRadius:8, border:"1px solid #ddd", background:"#f8f8f8"}}>Random</button>
        </div>
      </label>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12}}>
        <label>
          <div style={{fontSize:13, marginBottom:6}}>Room ID</div>
          <input value={roomId} onChange={e=>setRoomId(e.currentTarget.value)} placeholder="room-ab12cd"
            style={{width:"100%", padding:10, borderRadius:8, border:"1px solid #ddd"}}/>
        </label>
        <label>
          <div style={{fontSize:13, marginBottom:6}}>Room Code</div>
          <div style={{display:"flex", gap:8}}>
            <input value={roomCode} onChange={e=>setRoomCode(e.currentTarget.value)} placeholder="ABCD"
              style={{width:"100%", padding:10, borderRadius:8, border:"1px solid #ddd"}}/>
            <button type="button" onClick={()=>setRoomCode(randomCode())}
              style={{padding:"8px 10px", borderRadius:8, border:"1px solid #ddd", background:"#f8f8f8"}}>Random</button>
          </div>
        </label>
      </div>

      {error && <div style={{marginTop:12, color:"#b00020"}}>{error}</div>}

      <div style={{display:"flex", gap:10, marginTop:16}}>
        <button type="submit"
          style={{padding:"10px 14px", borderRadius:8, background:"#111", color:"#fff", border:"none", cursor:"pointer"}}>
          Enter Dice Tray
        </button>
        <button type="button" onClick={()=>{ setName(""); setColor(randomColor()); setRoomId(randomId()); setRoomCode(randomCode()); setError(null); }}
          style={{padding:"10px 14px", borderRadius:8, background:"#f2f2f2", border:"1px solid #ddd", cursor:"pointer"}}>
          Reset
        </button>
      </div>
    </form>
  );
}
