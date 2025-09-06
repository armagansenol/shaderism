"use client"

import { Environment, View } from "@react-three/drei"
import { useRef } from "react"
import { useMedia } from "react-use"
import * as THREE from "three"
import { TeethModel } from "./teeth-model"

function ScrollAnimatedGroup() {
  const scale = 1
  const group = useRef<THREE.Group>(null)

  return (
    <group scale={[scale, scale, scale]} position={[0, 150, 1100]} ref={group}>
      <TeethModel />
    </group>
  )
}

export function Teeth() {
  const isTabletUp = useMedia("(min-width: 1200px)", false)

  if (!isTabletUp) return null

  return (
    <View className='block w-full h-full pointer-events-auto'>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[60, 220, 1220]}
        intensity={3.5}
        castShadow
        shadow-bias={-0.0005}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={1}
        shadow-camera-far={4000}
        shadow-camera-left={-400}
        shadow-camera-right={400}
        shadow-camera-top={400}
        shadow-camera-bottom={-400}
      />
      <hemisphereLight color={0xffffff} groundColor={0x444444} intensity={0.6} />
      <Environment preset='studio' background={false} environmentIntensity={1.5} />
      {/* Ground plane to receive shadows beneath the tooth group at [0,150,1100] */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 120, 1100]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color={"#0e0e0e"} roughness={1} metalness={0} />
      </mesh>
      <ScrollAnimatedGroup />
    </View>
  )
}
