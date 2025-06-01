import { Trail } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useRef } from "react"
import { Mesh } from "three"

const MouseSphere = () => {
  const meshRef = useRef<Mesh>(null!)
  const { viewport } = useThree()

  useFrame(({ pointer }) => {
    if (meshRef.current) {
      // Convert normalized device coordinates (NDC) to world coordinates
      // mouse.x and mouse.y are in range [-1, 1]
      const x = (pointer.x * viewport.width) / 2
      const y = (pointer.y * viewport.height) / 2
      meshRef.current.position.set(x, y, 0)

      // Optional: Make the sphere always face the camera if it's not a perfect sphere or has a texture
      // meshRef.current.lookAt(camera.position);
    }
  })

  return (
    <Trail
      width={1.2} // Width of the line
      color={"#40E0D0"} // Color of the line
      length={2} // Length of the line
      decay={1} // How fast the line fades away
      local={false} // Wether to use the target's world or local positions
      stride={0} // Min distance between previous and current point
      interval={1} // Number of frames to wait before next calculation
      target={undefined} // Optional target. This object will produce the trail.
      attenuation={(width) => width}
    >
      {/* If `target` is not defined, Trail will use the first `Object3D` child as the target. */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.01, 64, 64]} />
        <meshStandardMaterial color="#40E0D0" />
      </mesh>

      {/* You can optionally define a custom meshLineMaterial to use. */}
      {/* <meshLineMaterial color={"red"} /> */}
    </Trail>
  )
}

export { MouseSphere }
