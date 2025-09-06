"use client"

import { Center, OrbitControls } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { useControls } from "leva"
import { useRef } from "react"
import * as THREE from "three"
import { fragmentShader, vertexShader } from "../shaders/boxShader"

function Box() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { mouse } = useThree()

  // Add refs for smooth mouse movement
  const currentMouse = useRef({ x: 0, y: 0 })
  const targetMouse = useRef({ x: 0, y: 0 })

  // Use Leva for controls
  const { ditherScale, ditherThreshold, bayerLevel } = useControls({
    ditherScale: {
      value: 4.0,
      min: 1,
      max: 8,
      step: 1,
      label: "Dither Size",
    },
    ditherThreshold: {
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Contrast",
    },
    bayerLevel: {
      value: 4,
      min: 2,
      max: 8,
      step: 2,
      label: "Pattern Detail",
    },
  })

  // Create uniforms with useRef
  const uniforms = useRef({
    u_time: { value: 0 },
    u_mouse: { value: [0, 0] },
    u_resolution: { value: [window.innerWidth, window.innerHeight] },
    u_ditherScale: { value: ditherScale },
    u_ditherThreshold: { value: ditherThreshold },
    u_bayerLevel: { value: bayerLevel },
  })

  useFrame((state) => {
    if (materialRef.current) {
      // Update target position from Three.js mouse
      targetMouse.current.x = mouse.x
      targetMouse.current.y = mouse.y

      // Smooth interpolation
      const smoothFactor = 0.01
      currentMouse.current.x += (targetMouse.current.x - currentMouse.current.x) * smoothFactor
      currentMouse.current.y += (targetMouse.current.y - currentMouse.current.y) * smoothFactor

      // Update uniforms directly through the ref
      uniforms.current.u_time.value = state.clock.getElapsedTime()
      uniforms.current.u_mouse.value = [currentMouse.current.x, currentMouse.current.y]
      uniforms.current.u_ditherScale.value = ditherScale
      uniforms.current.u_ditherThreshold.value = ditherThreshold
      uniforms.current.u_bayerLevel.value = bayerLevel
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
          uniforms={uniforms.current}
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
