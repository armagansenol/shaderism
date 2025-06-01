import { useGLTF } from "@react-three/drei"
// import { useThree } from "@react-three/fiber"
import * as THREE from "three"
import { GLTF } from "three-stdlib"

type GLTFResult = GLTF & {
  nodes: {
    Curve002: THREE.Mesh
  }
}

const LogoBytemywork = (props: Record<string, unknown> & { scale?: number; position?: [number, number, number] }) => {
  const { color = "#ffffff", scale = 1, position = [0, 0, -15], ...restProps } = props
  const { nodes } = useGLTF("/glb/bmw.glb") as unknown as GLTFResult

  return (
    <group {...restProps} dispose={null} position={position}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Curve002.geometry}
        material={nodes.Curve002.material}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[200 * scale, 0.1 * scale, 200 * scale]}
      >
        <meshStandardMaterial color={color as THREE.ColorRepresentation} metalness={0.2} roughness={0.75} />
      </mesh>
    </group>
  )
}

export { LogoBytemywork }

useGLTF.preload("/glb/bmw.glb")
