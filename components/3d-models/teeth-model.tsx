"use client"

import { Center, Float, useAnimations, useGLTF } from "@react-three/drei"
import { useFrame, type ThreeElements } from "@react-three/fiber"
import { useControls } from "leva"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { GLTF } from "three-stdlib"

type GLTFResult = GLTF & {
  nodes: {
    mandibular: THREE.Mesh
    maxillary: THREE.Mesh
  }
  materials: Record<string, THREE.Material>
}

export function Model(props: ThreeElements["group"]) {
  const group = useRef<THREE.Group>(null)
  const { nodes, animations } = useGLTF("/glb/teeth.glb") as unknown as GLTFResult
  const { actions } = useAnimations(animations, group)
  const typedActions = actions as Record<string, THREE.AnimationAction>

  // Shared material with Leva controls
  const plasticMaterialProps = useControls("Plastic Material", {
    color: { value: "#00ff41", label: "Color" },
    metalness: { value: 0, min: 0, max: 1, step: 0.01, label: "Metalness" },
    roughness: { value: 0.9, min: 0, max: 1, step: 0.01, label: "Roughness" },
    clearcoat: { value: 1, min: 0, max: 1, step: 0.01, label: "Clearcoat" },
    clearcoatRoughness: { value: 0.3, min: 0, max: 1, step: 0.01, label: "Clearcoat Roughness" },
    transmission: { value: 0, min: 0, max: 1, step: 0.01, label: "Transmission" },
    envMapIntensity: { value: 0.2, min: 0, max: 3, step: 0.01, label: "Env Map Intensity" },
    reflectivity: { value: 0.05, min: 0, max: 1, step: 0.01, label: "Reflectivity" },
  })
  const sharedMaterial = useMemo(() => new THREE.MeshPhysicalMaterial(), [])

  // Interaction controls
  const { followStrength } = useControls("Interaction", {
    followStrength: { value: 0.7, min: 0, max: 1, step: 0.01, label: "Follow Strength" },
  })

  useEffect(() => {
    sharedMaterial.color.set(plasticMaterialProps.color as string)
    sharedMaterial.metalness = plasticMaterialProps.metalness as number
    sharedMaterial.roughness = plasticMaterialProps.roughness as number
    sharedMaterial.clearcoat = plasticMaterialProps.clearcoat as number
    sharedMaterial.clearcoatRoughness = plasticMaterialProps.clearcoatRoughness as number
    sharedMaterial.transmission = plasticMaterialProps.transmission as number
    sharedMaterial.envMapIntensity = plasticMaterialProps.envMapIntensity as number
    sharedMaterial.reflectivity = plasticMaterialProps.reflectivity as number
    sharedMaterial.needsUpdate = true
  }, [plasticMaterialProps, sharedMaterial])

  // Mouse tracking: smoothly aim the model towards the projected mouse position
  const modelRef = useRef<THREE.Group>(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const planeZ = 1100
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ), [])
  const targetPoint = useMemo(() => new THREE.Vector3(), [])
  const tempObject = useMemo(() => new THREE.Object3D(), [])
  const desiredQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const baseLocalPosition = useMemo(() => new THREE.Vector3(), [])
  const tempTargetLocal = useMemo(() => new THREE.Vector3(), [])
  const desiredLocalPosition = useMemo(() => new THREE.Vector3(), [])
  const worldPos = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (modelRef.current) {
      baseLocalPosition.copy(modelRef.current.position)
    }
  }, [baseLocalPosition])

  useFrame(({ camera, pointer }, delta) => {
    if (!modelRef.current) return
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.ray.intersectPlane(plane, targetPoint)
    if (!hit) return
    // Reuse cached vector to avoid per-frame allocations
    tempObject.position.copy(modelRef.current.getWorldPosition(worldPos))
    tempObject.lookAt(targetPoint)
    desiredQuaternion.copy(tempObject.quaternion)
    // Frame-rate independent smoothing (~0.1 @ 60fps)
    const t = 1 - Math.pow(1 - 0.1, (delta ?? 0) * 60)
    modelRef.current.quaternion.slerp(desiredQuaternion, t)

    // Smooth, slight position follow towards pointer
    if (modelRef.current.parent) {
      tempTargetLocal.copy(targetPoint)
      modelRef.current.parent.worldToLocal(tempTargetLocal)
      // Move only a fraction from base towards the target to keep it subtle
      desiredLocalPosition.copy(baseLocalPosition).lerp(tempTargetLocal, followStrength as number)
      // Smoothly interpolate current position towards desired
      modelRef.current.position.lerp(desiredLocalPosition, t)
    }
  })

  function handlePointerEnter() {
    typedActions?.["mandibular-action"]?.reset().setEffectiveTimeScale(13).play()
    typedActions?.["maxillary-action"]?.reset().setEffectiveTimeScale(13).play()
  }
  function handlePointerLeave() {
    typedActions?.["mandibular-action"]?.fadeOut(0.5)
    typedActions?.["maxillary-action"]?.fadeOut(0.5)
  }

  return (
    <group ref={group} {...props} dispose={null}>
      <group name='Scene'>
        <Float speed={4} rotationIntensity={0.5} floatIntensity={1.0} floatingRange={[-6, 6]}>
          <group
            ref={modelRef}
            name='teeth'
            userData={{ name: "teeth" }}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
          >
            <mesh
              name='mandibular'
              castShadow
              receiveShadow
              geometry={nodes.mandibular.geometry}
              material={sharedMaterial}
              position={[0.139, -2.577, -0.337]}
              rotation={[Math.PI / 2, 0, 0]}
            />
            <mesh
              name='maxillary'
              castShadow
              receiveShadow
              geometry={nodes.maxillary.geometry}
              material={sharedMaterial}
              position={[-0.139, 2.577, 0.337]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          </group>
        </Float>
      </group>
    </group>
  )
}

export function TeethModel() {
  return (
    <group>
      <group position={[0, -20, 400]}>
        <Center>
          <Model scale={10} />
        </Center>
      </group>
    </group>
  )
}

if (typeof window !== "undefined" && window.matchMedia("(min-width: 1200px)").matches) {
  useGLTF.preload("/glb/teeth.glb")
}
