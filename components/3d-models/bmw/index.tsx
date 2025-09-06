"use client"

import { colors } from "@/styles/config.mjs"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { GLTF } from "three-stdlib"
import { useEffect, useState } from "react"
import { useThree } from "@react-three/fiber"
import { screens } from "@/styles/config.mjs"

type GLTFResult = GLTF & {
  nodes: {
    Curve002: THREE.Mesh
  }
}

export function ModelBytemywork(props: JSX.IntrinsicElements["group"]) {
  const { nodes } = useGLTF("/glb/bmw.glb") as unknown as GLTFResult
  const { viewport } = useThree()
  const [modelScale, setModelScale] = useState(230)
  const [modelPosition, setModelPosition] = useState<[number, number, number]>([-50, 0, 0])

  useEffect(() => {
    // Calculate scale relative to viewport width, similar to desktop-vw calculation
    const baseScale = 235
    const scaleVw = (baseScale * 100) / screens.desktop.width
    const scale = (scaleVw * viewport.width) / 100
    setModelScale(scale)

    // Calculate position using the same vw-based approach
    const basePosition = -50
    const positionVw = (basePosition * 100) / screens.desktop.width
    const position: [number, number, number] = [(positionVw * viewport.width) / 100, 0, 0]
    setModelPosition(position)
  }, [viewport.width])

  return (
    <group {...props} dispose={null} scale={modelScale} position={modelPosition}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Curve002.geometry}
        rotation={[-Math.PI / 2, 0, -Math.PI]}
        scale={[-14.492, -0.165, -14.492]}
      >
        <meshStandardMaterial color={colors["deep-daigi-white"]} metalness={0.2} roughness={0.75} />
      </mesh>
    </group>
  )
}

useGLTF.preload("/bmw.glb")
