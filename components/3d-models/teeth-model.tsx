"use client"

import { Center, useAnimations, useGLTF } from "@react-three/drei"
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

type ActionName = "Dis AltAction" | "Dis UstAction"
// removed unused GLTFActions type

export function Model(props: ThreeElements["group"]) {
  const group = useRef<THREE.Group>(null)
  const { nodes, animations } = useGLTF("/glb/teeth.glb") as unknown as GLTFResult
  const { actions } = useAnimations(animations, group)
  const typedActions = actions as unknown as Partial<Record<ActionName, THREE.AnimationAction>>

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

  useFrame(({ camera, pointer }) => {
    if (!modelRef.current) return
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.ray.intersectPlane(plane, targetPoint)
    if (!hit) return
    tempObject.position.copy(modelRef.current.getWorldPosition(new THREE.Vector3()))
    tempObject.lookAt(targetPoint)
    desiredQuaternion.copy(tempObject.quaternion)
    modelRef.current.quaternion.slerp(desiredQuaternion, 0.2)
  })

  function handlePointerEnter() {
    typedActions?.["Dis UstAction"]?.reset().setEffectiveTimeScale(15).play()
    typedActions?.["Dis AltAction"]?.reset().setEffectiveTimeScale(15).play()
  }
  function handlePointerLeave() {
    typedActions?.["Dis UstAction"]?.fadeOut(0.5)
    typedActions?.["Dis AltAction"]?.fadeOut(0.5)
  }

  return (
    <group ref={group} {...props} dispose={null}>
      <group name='Scene' castShadow>
        <group ref={modelRef} name='teeth' userData={{ name: "teeth" }}>
          <mesh
            name='mandibular'
            castShadow
            receiveShadow
            geometry={nodes.mandibular.geometry}
            material={sharedMaterial}
            position={[0.027, -2.157, -0.046]}
            rotation={[Math.PI / 2, 0, 0]}
            userData={{ name: "mandibular" }}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
          />
          <mesh
            name='maxillary'
            castShadow
            receiveShadow
            geometry={nodes.maxillary.geometry}
            material={sharedMaterial}
            position={[-0.027, 2.157, 0.046]}
            rotation={[Math.PI / 2, 0, 0]}
            userData={{ name: "maxillary" }}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
          />
        </group>
      </group>
    </group>
  )
}

export function TeethModel() {
  return (
    <group castShadow>
      <group position={[0, -20, 1000]} castShadow>
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
