import { Trail } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useCallback, useRef } from "react"
import { Mesh } from "three"
import type { Vector3 } from "three"

type MouseSphereProps = {
  color?: string
  radius?: number
  segments?: number
  z?: number
  trailWidth?: number
  trailLength?: number
  decay?: number
  local?: boolean
  stride?: number
  interval?: number
  opacity?: number
  position?: Vector3 | [number, number, number]
}

const MouseSphere = ({
  color = "#40E0D0",
  radius = 0.1,
  segments = 16,
  z = 0,
  trailWidth = 1.2,
  trailLength = 2,
  decay = 0.1,
  local = false,
  stride = 0,
  interval = 1,
  opacity = 1,
}: MouseSphereProps) => {
  const meshRef = useRef<Mesh | null>(null)
  const { viewport } = useThree()

  const attenuation = useCallback((width: number) => width, [])

  useFrame(({ pointer }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const x = (pointer.x * viewport.width) / 2
    const y = (pointer.y * viewport.height) / 2
    mesh.position.set(x, y, z)
  })

  return (
    <Trail
      width={trailWidth}
      color={color}
      length={trailLength}
      decay={decay}
      local={local}
      stride={stride}
      interval={interval}
      attenuation={attenuation}
    >
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, segments, segments]} />
        <meshStandardMaterial color={color} opacity={opacity} transparent={opacity < 1} />
      </mesh>
    </Trail>
  )
}

export { MouseSphere }
