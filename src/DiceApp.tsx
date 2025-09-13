// src/DiceApp.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/cannon";
import { FloorDynamic, WallsDynamic } from "./FloorDynamic";
import { Die, DiePlan } from "./Die";
import { D4, D6, D8, D10, D12, D20, D10_TENS, D10_UNITS, type DieSpec, type DieKind } from "./die-types";
import type { UserConfig } from "./types";

/** Top-down, no-move camera */
function TopDownCamera() {
  const { camera } = useThree();
  useEffect(()=>{ camera.position.set(0,26,0); camera.lookAt(0,0,0); },[camera]);
  return null;
}

/** Pre-roll stacked/grid placement */
function preRollPosition(index:number): [number,number,number] {
  const cols=4, spacing=1.25;
  const row=Math.floor(index/cols), col=index%cols;
  const startX=-4, startZ=-2.5;
  const x=startX + col*spacing, z=startZ + row*spacing, y=1.5 + (row%3)*0.05;
  return [x,y,z];
}

type Phase = "select"|"rolling"|"results";
type Selection =
  | { type: "single"; id: string }
  | { type: "d100"; tensId: string; unitsId: string; gid: string };

function useDiceTray() {
  const [plans,setPlans]=useState<DiePlan[]>([]);
  const [values,setValues]=useState<Record<string,number>>({});
  const [key,setKey]=useState(0);
  const [rollToken,setRollToken]=useState(0);
  const [phase,setPhase]=useState<Phase>("select");
  const [order,setOrder]=useState<Selection[]>([]);

  useEffect(()=>{ const onResize=()=>setKey(k=>k+1); window.addEventListener("resize",onResize); return()=>window.removeEventListener("resize",onResize); },[]);

  const addDie = useCallback((spec: DieSpec)=>{
    if (phase!=="select") return;

    if (spec.kind==="d100"){
      const gid = crypto.randomUUID();
      const base = plans.length;
      const tens: DiePlan = { id:`d100t-${gid}`, spec:D10_TENS, position:preRollPosition(base),   asD100:{groupId:gid,role:"tens"} };
      const units:DiePlan = { id:`d100u-${gid}`, spec:D10_UNITS, position:preRollPosition(base+1), asD100:{groupId:gid,role:"units"} };
      setPlans(p=>[...p, tens, units]);
      setOrder(o=>[...o, { type:"d100", tensId:tens.id, unitsId:units.id, gid }]);
      return;
    }

    const pos = preRollPosition(plans.length);
    const plan: DiePlan = { id:`${spec.kind}-${crypto.randomUUID()}`, spec, position:pos };
    setPlans(p=>[...p, plan]);
    setOrder(o=>[...o, { type:"single", id:plan.id }]);
  },[phase, plans.length]);

  const resetAll = useCallback(()=>{
    setPlans([]); setOrder([]); setValues({}); setRollToken(0); setPhase("select");
  },[]);

  const roll = useCallback(()=>{
    if (phase!=="select" || plans.length===0) return;
    setValues({});
    setPhase("rolling");
    setRollToken(t=>t+1);
  },[phase, plans.length]);

  const onTopValue = useCallback((id:string, value:number)=>{
    setValues(v => (v[id]===value ? v : {...v, [id]:value}));
  },[]);

  const resultsReady = useMemo(()=>{
    if (plans.length===0) return false;
    for (const sel of order){
      if (sel.type==="single"){
        if (typeof values[sel.id]!=="number") return false;
      } else {
        if (typeof values[sel.tensId]!=="number" || typeof values[sel.unitsId]!=="number") return false;
      }
    }
    return true;
  },[plans.length, order, values]);

  useEffect(()=>{ if (phase==="rolling" && resultsReady) setPhase("results"); },[phase, resultsReady]);

  const resultsList:number[] = useMemo(()=>{
    const out:number[]=[];
    for (const sel of order){
      if (sel.type==="single"){ out.push(values[sel.id]); }
      else {
        const tens=values[sel.tensId]??0; const units=values[sel.unitsId]??0;
        let v=tens+units; if (tens===0 && units===0) v=100;
        out.push(v);
      }
    }
    return out;
  },[order, values]);

  const total = useMemo(()=>resultsList.reduce((a,b)=>a+b,0),[resultsList]);

  return { plans,key, addDie, resetAll, roll, onTopValue, rollToken, phase, resultsReady, resultsList, total };
}

export default function DiceApp({ user }: { user: UserConfig }) {
  const { plans,key, addDie, resetAll, roll, onTopValue, rollToken, phase, resultsReady, resultsList, total } = useDiceTray();
  const tint = user?.color ?? "#ffffff";

  const canAdd   = phase==="select";
  const canRoll  = phase==="select" && plans.length>0;
  const canReset = phase!=="select";

  const modalMessage = `${user?.name ?? "Player"} rolled ${resultsList.join(" + ")} = ${total}`;

  return (
    <div style={{ width:"100vw", height:"100vh", position:"relative" }}>
      <div style={{
        position:"absolute", zIndex:2, top:12, left:12, display:"flex", gap:8, alignItems:"center",
        flexWrap:"wrap", background:"rgba(255,255,255,0.65)", padding:"8px 10px", borderRadius:8 }}>
        {[D4,D6,D8,D10,D12,D20,{...D10, kind:"d100" as DieKind}].map((spec)=>(
          <button key={spec.kind} onClick={()=>addDie(spec)} disabled={!canAdd}
            style={{
              fontSize:16, padding:"6px 10px", borderRadius:6,
              border:"1px solid rgba(0,0,0,0.15)", background:canAdd?"#fff":"#f1f1f1",
              color:canAdd?"#111":"#888", cursor:canAdd?"pointer":"not-allowed"
            }}>
            {spec.kind.toUpperCase()}
          </button>
        ))}
        <div style={{ width:12 }}/>
        <button onClick={roll} disabled={!canRoll}
          style={{ fontSize:16, padding:"6px 12px", borderRadius:6, background:canRoll?"#111":"#999",
                   color:"#fff", cursor:canRoll?"pointer":"not-allowed", border:"none" }}>
          Roll
        </button>
        <button onClick={resetAll} disabled={!canReset}
          style={{ fontSize:16, padding:"6px 12px", borderRadius:6, background:canReset?"#eee":"#f1f1f1",
                   color:"#222", cursor:canReset?"pointer":"not-allowed", border:"1px solid rgba(0,0,0,0.15)" }}>
          Reset
        </button>
        <span style={{ marginLeft:12, fontSize:12, opacity:0.65 }}>
          {phase==="select"  && "1) Choose dice → 2) Roll"}
          {phase==="rolling" && "Rolling…"}
          {phase==="results" && "3) Modal shows result → 4) Reset"}
        </span>
      </div>

      {resultsReady && phase==="results" && (
        <div role="dialog" aria-label="Roll results"
          style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.35)", zIndex:4,
                   display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"rgba(255,255,255,0.95)", padding:"16px 18px", borderRadius:10,
                        minWidth:320, textAlign:"center", boxShadow:"0 12px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize:18, opacity:0.8, marginBottom:8 }}>Result</div>
            <div style={{ fontSize:22, fontWeight:700, marginBottom:14 }}>{modalMessage}</div>
            <button onClick={resetAll}
              style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #ccc", background:"#fff", cursor:"pointer" }}>
              Reset
            </button>
          </div>
        </div>
      )}

      <Canvas orthographic camera={{ position:[0,26,0], zoom:70 }} style={{ background:"#00FF00" }}>
        <TopDownCamera />
        <ambientLight intensity={0.55} />
        <directionalLight position={[10,22,8]} intensity={1.2} />
        <Physics gravity={[0,-9.82,0]} broadphase="SAP"
          defaultContactMaterial={{ friction:0.4, restitution:0.05 }} allowSleep={false} key={key}>
          <FloorDynamic />
          <WallsDynamic />
          {plans.map((plan)=>(
            <Die key={plan.id} plan={plan} onTopValue={onTopValue} tintColor={tint}
                 rollToken={rollToken} acceptUpdates={phase!=="results"} />
          ))}
        </Physics>
      </Canvas>
    </div>
  );
}
