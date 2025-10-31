import React, { useMemo, useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Text, Line, Billboard, Stars, Environment } from "@react-three/drei";

/**
 * Flappy Fire: 3D Robot Unicorn Runner
 * - Flappy Bird–style tap/space to flap
 * - You are a robot unicorn with a rainbow trail
 * - Everything is (stylishly) on fire
 * - Avoid burning pillars, rack up points
 *
 * Controls: Click / Tap / Space to flap. R to restart.
 */

const GAME = {
  gravity: -18,
  flap: 9.5,
  speed: 8,
  spawnGap: 14,
  holeSize: 5.2,
  pillarWidth: 2.2,
  maxOffset: 4.5,
  unicornRadius: 0.8,
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function useInput(onFlap, onRestart) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space") { e.preventDefault(); onFlap(); }
      if (e.code === "KeyR") { onRestart(); }
    };
    const onPointer = () => onFlap();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [onFlap, onRestart]);
}

function useGameLogic(state, setState, pillars, setPillars) {
  const vel = useRef(0);
  const t = useRef(0);

  useFrame((_, dt) => {
    if (!state.running) return;
    t.current += dt;

    // Physics
    vel.current += GAME.gravity * dt;
    state.y += vel.current * dt;

    // Boundaries (lava floor / ceiling)
    if (state.y < -6 || state.y > 8) {
      setState(s => ({ ...s, running: false, dead: true }));
      return;
    }

    // Move pillars and recycle
    for (let p of pillars.current) {
      p.x -= GAME.speed * dt;
    }

    // Spawn new pillars when needed
    const last = pillars.current[pillars.current.length - 1];
    if (!last || last.x < 18 - GAME.spawnGap) {
      const offset = (Math.random() * 2 - 1) * GAME.maxOffset;
      pillars.current.push({ x: 18, offset, passed: false, id: Math.random().toString(36).slice(2) });
      // keep only a handful
      if (pillars.current.length > 10) pillars.current.shift();
    }

    // Scoring & collisions
    for (let p of pillars.current) {
      // score when passed
      if (!p.passed && p.x + GAME.pillarWidth * 0.5 < -2) {
        p.passed = true;
        setState(s => ({ ...s, score: s.score + 1 }));
      }
      // Collision check (simple AABB vs sphere)
      const ux = -2, uy = state.y;
      const half = GAME.pillarWidth * 0.5;
      const holeTop = p.offset + GAME.holeSize * 0.5;
      const holeBot = p.offset - GAME.holeSize * 0.5;

      // top pillar box
      const topBox = { min: [p.x - half, holeTop + 100, -2], max: [p.x + half, 12, 2] };
      // bottom pillar box
      const botBox = { min: [p.x - half, -12, -2], max: [p.x + half, holeBot - 100, 2] };

      const hitTop = intersectsSphereAABB([ux, uy, 0], GAME.unicornRadius, topBox);
      const hitBot = intersectsSphereAABB([ux, uy, 0], GAME.unicornRadius, botBox);
      if (hitTop || hitBot) {
        setState(s => ({ ...s, running: false, dead: true }));
        return;
      }
    }
  });

  return {
    flap: () => {
      if (!state.started) setState(s => ({ ...s, started: true, running: true }));
      if (state.dead) return; // no flaps when dead
      vel.current = GAME.flap;
    },
    restart: () => {
      vel.current = 0;
      t.current = 0;
      setPillars({ type: "reset" });
      setState(s => ({ ...s, y: 1.5, score: 0, dead: false, running: false, started: false }));
    }
  };
}

function intersectsSphereAABB([sx, sy, sz], r, { min, max }) {
  const cx = clamp(sx, min[0], max[0]);
  const cy = clamp(sy, min[1], max[1]);
  const cz = clamp(sz, min[2], max[2]);
  const dx = sx - cx, dy = sy - cy, dz = sz - cz;
  return dx*dx + dy*dy + dz*dz <= r*r;
}

function RainbowTrail({ points = 32 }) {
  const ref = useRef();
  const positions = useMemo(() => new Array(points).fill(0).map((_, i) => [ -2.2 - i * 0.25, 0, 0 ]), [points]);
  useFrame((state) => {
    if (!ref.current) return;
    // gently wobble the trail
    const t = state.clock.elapsedTime;
    const verts = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i++) {
      const baseX = -2.2 - i * 0.25;
      const y = Math.sin(t * 3 + i * 0.5) * 0.2;
      verts[i * 3 + 0] = baseX;
      verts[i * 3 + 1] = y;
      verts[i * 3 + 2] = 0;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  // gradient rainbow via vertex colors
  const colors = useMemo(() => {
    const c = [];
    const palette = [
      [1, 0, 0], [1, 0.5, 0], [1, 1, 0], [0, 1, 0], [0, 0.5, 1], [0.29, 0, 0.51], [0.93, 0.51, 0.93]
    ];
    for (let i = 0; i < points; i++) {
      const t = (i / (points - 1)) * (palette.length - 1);
      const i0 = Math.floor(t), i1 = Math.min(palette.length - 1, i0 + 1);
      const f = t - i0;
      const r = palette[i0][0] * (1 - f) + palette[i1][0] * f;
      const g = palette[i0][1] * (1 - f) + palette[i1][1] * f;
      const b = palette[i0][2] * (1 - f) + palette[i1][2] * f;
      c.push(r, g, b);
    }
    return new Float32Array(c);
  }, [points]);

  return (
    <line ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={points} array={new Float32Array(points * 3)} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={points} array={colors} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors linewidth={6} />
    </line>
  );
}

function RobotUnicorn({ y, dead }) {
  const group = useRef();
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.position.set(-2, y, 0);
    group.current.rotation.z = dead ? -Math.PI * 0.35 : 0.15 * Math.sin(performance.now() / 300);
  });
  return (
    <group ref={group}>
      {/* Body */}
      <mesh castShadow position={[0,0,0]}>
        <capsuleGeometry args={[0.6, 1.2, 6, 12]} />
        <meshStandardMaterial metalness={0.9} roughness={0.2} color="#c7d2fe" emissive="#88a" emissiveIntensity={0.2} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0.9,0.3,0]}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial metalness={0.9} roughness={0.3} color="#e5e7eb" emissive="#557" emissiveIntensity={0.25} />
      </mesh>
      {/* Horn */}
      <mesh castShadow position={[1.2,0.6,0]} rotation={[0,0,Math.PI*0.1]}>
        <coneGeometry args={[0.1, 0.6, 8]} />
        <meshStandardMaterial color="#fcd34d" emissive="#f59e0b" emissiveIntensity={1.2} metalness={1} roughness={0.15} />
      </mesh>
      {/* Legs */}
      {[[-0.6,-0.7,0.25],[0.1,-0.7,0.25],[-0.6,-0.7,-0.25],[0.1,-0.7,-0.25]].map((p,i)=>(
        <mesh key={i} castShadow position={p}>
          <cylinderGeometry args={[0.09,0.09,0.8,8]} />
          <meshStandardMaterial color="#a5b4fc" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {/* Rainbow trail */}
      <RainbowTrail />
    </group>
  );
}

function FireParticle({ position }) {
  // Simple billboarded fire sprite using emissive gradient in material
  return (
    <Billboard position={position} follow={true}>
      <mesh>
        <planeGeometry args={[0.9, 1.4]} />
        <meshBasicMaterial color="#ffae00" transparent opacity={0.9} />
      </mesh>
    </Billboard>
  );
}

function InfernoBackdrop() {
  const flames = useMemo(() => new Array(200).fill(0).map(() => [
    (Math.random()*50-10), (Math.random()*8-6), (Math.random()*-10)
  ]), []);
  return (
    <group>
      {/* Distant stars embers */}
      <Stars radius={80} depth={8} count={2000} factor={2} fade />
      {/* Lava plane */}
      <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-6.5,0]}>
        <planeGeometry args={[200, 60]} />
        <meshStandardMaterial color="#7f1d1d" emissive="#b91c1c" emissiveIntensity={0.6} />
      </mesh>
      {/* Ambient flame billboards */}
      {flames.map((p,i)=>(<FireParticle key={i} position={p} />))}
    </group>
  );
}

function Pillar({ x, offset }) {
  const gap = GAME.holeSize;
  const w = GAME.pillarWidth;
  return (
    <group position={[x, 0, 0]}>
      {/* Bottom pillar */}
      <mesh castShadow position={[0, -6 + (offset - gap*0.5 - -12)/2, 0]}>
        <boxGeometry args={[w, (offset - gap*0.5) - -12, 2]} />
        <meshStandardMaterial color="#1f2937" emissive="#ef4444" emissiveIntensity={0.8} />
      </mesh>
      {/* Top pillar */}
      <mesh castShadow position={[0, 6 + (12 - (offset + gap*0.5))/2, 0]}>
        <boxGeometry args={[w, 12 - (offset + gap*0.5), 2]} />
        <meshStandardMaterial color="#111827" emissive="#ef4444" emissiveIntensity={0.8} />
      </mesh>
      {/* Flame caps */}
      <Billboard position={[0, offset + gap*0.5 + 0.6, 0]}>
        <mesh>
          <planeGeometry args={[w*1.2, 1.4]} />
          <meshBasicMaterial color="#ff7b00" transparent opacity={0.95} />
        </mesh>
      </Billboard>
      <Billboard position={[0, offset - gap*0.5 - 0.6, 0]}>
        <mesh>
          <planeGeometry args={[w*1.2, 1.4]} />
          <meshBasicMaterial color="#ff7b00" transparent opacity={0.95} />
        </mesh>
      </Billboard>
    </group>
  );
}

function Pillars({ dataRef }) {
  const [, setTick] = useState(0);
  // Re-render when pillars change via reducer-like dispatch
  useEffect(() => {
    const unsub = dataRef.subscribe(() => setTick(t => t + 1));
    return () => unsub();
  }, [dataRef]);
  return (
    <group>
      {dataRef.current.map(p => (
        <Pillar key={p.id} x={p.x} offset={p.offset} />
      ))}
    </group>
  );
}

// Simple event-bus-ish container so we can force updates
function usePillarStore() {
  const listeners = useRef(new Set());
  const store = useRef([]);
  const api = useMemo(() => ({
    current: store.current,
    subscribe: (fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); }
  }), []);
  const dispatch = (action) => {
    if (action?.type === "reset") store.current = [];
    listeners.current.forEach((l) => l());
  };
  return [api, dispatch];
}

function HUD({ state, onRestart }) {
  return (
    <Html prepend center style={{ pointerEvents: 'none' }}>
      <div className="flex flex-col items-center gap-3 select-none">
        <div className="px-4 py-1 rounded-2xl shadow bg-white/80 text-gray-800 text-xl font-semibold">
          Score: {state.score}
        </div>
        {!state.started && (
          <div className="px-4 py-2 rounded-2xl shadow bg-black/60 text-white text-sm">
            Click / Tap / Space to FLAP! (R to restart)
          </div>
        )}
        {state.dead && (
          <div className="px-4 py-2 rounded-2xl shadow bg-rose-600/90 text-white text-sm font-semibold" style={{pointerEvents:'auto'}}>
            You became extra crispy. <button onClick={onRestart} className="ml-2 px-3 py-1 rounded-xl bg-white/20 border border-white/30">Restart</button>
          </div>
        )}
      </div>
    </Html>
  );
}

function CameraRig({ y }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    // Subtle follow for vertical movement
    camera.position.lerp({ x: 0, y: clamp(y + 1.5, -1.5, 3), z: 10 }, clamp(1.0 * dt, 0, 1));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function GameScene({ state, setState, pillarsRef, dispatchPillars, onFlap, onRestart }) {
  const { flap, restart } = useGameLogic(state, setState, pillarsRef, dispatchPillars);
  
  // Expose methods to parent via refs passed as callbacks
  useEffect(() => {
    onFlap.current = flap;
    onRestart.current = restart;
  }, [flap, restart, onFlap, onRestart]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight castShadow intensity={1.2} position={[4,6,4]} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <Suspense fallback={null}>
        <Environment preset="sunset" />
      </Suspense>

      <InfernoBackdrop />
      <RobotUnicorn y={state.y} dead={state.dead} />
      <Pillars dataRef={pillarsRef} />
      <HUD state={state} onRestart={restart} />
      <CameraRig y={state.y} />

      {/* Foreground heat haze (subtle lines) */}
      <Line points={[[-10,7,-1],[10,7,-1]]} color="#ffedd5" lineWidth={1} transparent opacity={0.15} />
    </>
  );
}

export default function FlamingUnicornRunner() {
  const [state, setState] = useState({ y: 1.5, score: 0, dead: false, running: false, started: false });
  const [pillarsRef, dispatchPillars] = usePillarStore();
  const flapRef = useRef(() => {});
  const restartRef = useRef(() => {});
  
  useInput(() => flapRef.current(), () => restartRef.current());

  return (
    <div className="w-full h-[70vh] bg-gradient-to-b from-rose-900 via-orange-900 to-yellow-900 rounded-2xl shadow-xl overflow-hidden">
      <Canvas shadows camera={{ fov: 55, position: [0, 1.2, 10] }}>
        <GameScene 
          state={state} 
          setState={setState} 
          pillarsRef={pillarsRef} 
          dispatchPillars={dispatchPillars}
          onFlap={flapRef}
          onRestart={restartRef}
        />
      </Canvas>

      {/* Top-bar UI */}
      <div className="pointer-events-none absolute inset-0 p-4 flex justify-between items-start">
        <div className="pointer-events-auto px-3 py-1 rounded-xl bg-black/30 text-white text-xs">Flappy Fire: Robot Unicorn</div>
        <div className="pointer-events-auto flex gap-2">
          <button onClick={() => flapRef.current()} className="px-3 py-1 rounded-xl bg-white/20 border border-white/30 text-white text-xs">Flap</button>
          <button onClick={() => restartRef.current()} className="px-3 py-1 rounded-xl bg-white/20 border border-white/30 text-white text-xs">Restart</button>
        </div>
      </div>
    </div>
  );
}
