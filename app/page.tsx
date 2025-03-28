"use client"

import { Center, OrbitControls } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { useRef, useMemo } from "react"
import * as THREE from "three"
import { fragmentShader, vertexShader } from "./shaders/boxShader"

function Box() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { mouse } = useThree()

  // Add refs for smooth mouse movement
  const currentMouse = useRef({ x: 0, y: 0 })
  const targetMouse = useRef({ x: 0, y: 0 })

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_mouse: { value: [0, 0] },
      u_resolution: { value: [window.innerWidth, window.innerHeight] },
    }),
    []
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

export default function Home() {
  return (
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
    </main>
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
