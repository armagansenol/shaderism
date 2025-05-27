import { useGLTF } from "@react-three/drei"
// import { useThree } from "@react-three/fiber"
import * as THREE from "three"
import { GLTF } from "three-stdlib"

type GLTFResult = GLTF & {
  nodes: {
    Curve002: THREE.Mesh
  }
}

export function ModelBytemywork(props: Record<string, unknown>) {
  const { color = "#ffffff", ...restProps } = props
  const { nodes } = useGLTF("/glb/bmw.glb") as unknown as GLTFResult

  return (
    <group {...restProps} dispose={null} position={[0, 0, -15]}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Curve002.geometry}
        material={nodes.Curve002.material}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[200, 0.1, 200]}
      >
        <meshStandardMaterial color={color as THREE.ColorRepresentation} metalness={0.2} roughness={0.75} />
      </mesh>
    </group>
  )
}

useGLTF.preload("/glb/bmw.glb")
