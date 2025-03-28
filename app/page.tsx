"use client"

import { Center, OrbitControls } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { useRef, useMemo, useState } from "react"
import * as THREE from "three"
import { fragmentShader, vertexShader } from "./shaders/boxShader"

// Create a context for pattern state management
import { createContext, useContext } from "react"
const PatternContext = createContext<{
  pattern: number
  setPattern: (pattern: number) => void
}>({ pattern: 0, setPattern: () => {} })

function Box() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { mouse } = useThree()
  const { pattern } = useContext(PatternContext)

  // Add refs for smooth mouse movement
  const currentMouse = useRef({ x: 0, y: 0 })
  const targetMouse = useRef({ x: 0, y: 0 })

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_mouse: { value: [0, 0] },
      u_resolution: { value: [window.innerWidth, window.innerHeight] },
      u_pattern: { value: pattern },
    }),
    [pattern]
  )

  useFrame((state) => {
    if (materialRef.current) {
      // Update target position from Three.js mouse
      targetMouse.current.x = mouse.x
      targetMouse.current.y = mouse.y

      // Smooth interpolation
      const smoothFactor = 0.01 // Adjust this value (0-1) for different smoothing amounts
      currentMouse.current.x += (targetMouse.current.x - currentMouse.current.x) * smoothFactor
      currentMouse.current.y += (targetMouse.current.y - currentMouse.current.y) * smoothFactor

      // Update uniforms with smoothed values
      materialRef.current.uniforms.u_time.value = state.clock.getElapsedTime()
      materialRef.current.uniforms.u_mouse.value = [currentMouse.current.x, currentMouse.current.y]
      materialRef.current.uniforms.u_pattern.value = pattern
    }
  })

  return (
    <ScaledModel>
      <mesh ref={meshRef}>
        <planeGeometry args={[2, 1, 1]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </mesh>
    </ScaledModel>
  )
}

// Pattern control buttons component (outside Canvas)
function PatternControls() {
  const { setPattern } = useContext(PatternContext)
  const patterns = ["Original", "Dither", "Dots", "Lines", "Cells"]

  return (
    <div className="absolute top-4 left-4 flex gap-2">
      {patterns.map((pattern, index) => (
        <button
          key={pattern}
          onClick={() => setPattern(index)}
          className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-md text-white text-sm"
        >
          {pattern}
        </button>
      ))}
    </div>
  )
}

export default function Home() {
  const [pattern, setPattern] = useState(1)

  return (
    <PatternContext.Provider value={{ pattern, setPattern }}>
      <main className="w-full h-screen">
        <Canvas>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <Box />
          <OrbitControls />
          <EffectComposer>
            <Bloom luminanceThreshold={1} intensity={1.5} />
          </EffectComposer>
        </Canvas>
        <PatternControls />
      </main>
    </PatternContext.Provider>
  )
}

function ScaledModel({ children }: { children: React.ReactNode }) {
  const viewport = useThree((state) => state.viewport)
  return (
    <Center
      onCentered={({ container, width, height }) => {
        const scale = Math.min(viewport.width / width, viewport.height / height) * 0.9
        container.scale.setScalar(scale)
      }}
    >
      {children}
    </Center>
  )
}
