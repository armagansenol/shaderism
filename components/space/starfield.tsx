import React, { useRef, useMemo, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { Instances, Instance } from "@react-three/drei"

const Starfield = () => {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null!)
  const shaderRef = useRef<THREE.ShaderMaterial>(null!)

  const count = 1000
  const minRadius = 20
  const maxRadius = 300

  const instanceData = useMemo(() => {
    const data = []
    for (let i = 0; i < count; i++) {
      let x, y, z, d
      do {
        x = (Math.random() - 0.5) * maxRadius * 2
        y = (Math.random() - 0.5) * maxRadius * 2
        z = (Math.random() - 0.5) * maxRadius * 2
        d = Math.sqrt(x * x + y * y + z * z)
      } while (d > maxRadius || d < minRadius)

      data.push({
        position: new THREE.Vector3(x, y, z),
        colorUv: Math.random(),
        brightness: Math.random() * 1.5 + 0.5,
        size: Math.random() * 1.5 + 0.5,
      })
    }
    if (data.length > 0) {
      console.log("First star instance data:", JSON.stringify(data[0]))
    }
    return data
  }, [count, minRadius, maxRadius])

  useEffect(() => {
    if (!instancedMeshRef.current || !instanceData.length) return

    const mesh = instancedMeshRef.current
    if (!mesh.geometry) {
      console.warn("InstancedMesh geometry not found during attribute setup.")
      return
    }

    const sizes = new Float32Array(count)
    const colorUvs = new Float32Array(count)
    const brightnesses = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      sizes[i] = instanceData[i].size
      colorUvs[i] = instanceData[i].colorUv
      brightnesses[i] = instanceData[i].brightness
    }

    mesh.geometry.setAttribute("instanceSize", new THREE.InstancedBufferAttribute(sizes, 1))
    mesh.geometry.setAttribute("instanceColorUv", new THREE.InstancedBufferAttribute(colorUvs, 1))
    mesh.geometry.setAttribute("instanceBrightness", new THREE.InstancedBufferAttribute(brightnesses, 1))

    // Mark attributes for update
    if (mesh.geometry.attributes.instanceSize) mesh.geometry.attributes.instanceSize.needsUpdate = true
    if (mesh.geometry.attributes.instanceColorUv) mesh.geometry.attributes.instanceColorUv.needsUpdate = true
    if (mesh.geometry.attributes.instanceBrightness) mesh.geometry.attributes.instanceBrightness.needsUpdate = true
    // Also mark the instance matrix buffer for update, as positions are handled by <Instance>
    // but ensuring its updates are processed is key.
    if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true
  }, [instanceData, count])

  useEffect(() => {
    // Log the instanced mesh object once it's available
    if (instancedMeshRef.current) {
      console.log("Starfield InstancedMesh ref:", instancedMeshRef.current)
    }
  }, []) // Empty dependency array to run once on mount

  useFrame(({ clock }) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  const vertexShader = `
      uniform float uTime;
      attribute float instanceSize;
      attribute float instanceColorUv;
      attribute float instanceBrightness;
      
      varying vec2 vUv;
      varying float vColorUv;
      varying float vBrightness;
  
      void main() {
        vUv = uv;
        vColorUv = instanceColorUv;
        vBrightness = instanceBrightness;
  
        // instanceMatrix will position/rotate/scale the entire plane.
        // 'position' is the vertex of the base PlaneGeometry.
        // We scale the base plane by instanceSize (multiplied by a factor if needed).
        vec3 scaledPosition = position * instanceSize; // Using instanceSize directly for scaling
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(scaledPosition, 1.0);
      }
    `

  const fragmentShader = `
      uniform sampler2D pointTexture;
      uniform sampler2D uColorRamp; // Kept for potential future use
      uniform float uTime;

      varying vec2 vUv;
      varying float vColorUv;
      varying float vBrightness;
  
      void main() {
        // Blinking effect based on brightness and time
        float blink = sin(uTime * vBrightness * 0.8 + vBrightness * 3.0) * 0.3 + 0.7;
        float modulatedBrightness = clamp(vBrightness * blink, 0.1, 1.5);

        vec4 tex = texture2D(pointTexture, vUv); // Use vUv for texturing the plane
        if (tex.a < 0.1) {
            discard; // Discard fragment if texture alpha is low
        }
  
        // Example usage of uColorRamp (uncomment and adjust as needed)
        // vec4 rampColor = texture2D(uColorRamp, vec2(vColorUv, 0.5));
        // gl_FragColor = vec4(rampColor.rgb * modulatedBrightness, tex.a);

        // Current: Modulate base texture color by brightness
        gl_FragColor = vec4(tex.rgb * modulatedBrightness, tex.a);
      }
    `

  const pointTexture = useMemo(() => {
    console.log("Loading /star.png")
    return new THREE.TextureLoader().load(
      "/star.png",
      (texture) => console.log("/star.png loaded successfully", texture),
      undefined, // onProgress callback (optional)
      (error) => console.error("Error loading /star.png", error)
    )
  }, [])
  const colorRampTexture = useMemo(() => {
    console.log("Loading /star-color-ramp.png")
    return new THREE.TextureLoader().load(
      "/star-color-ramp.png",
      (texture) => console.log("/star-color-ramp.png loaded successfully", texture),
      undefined, // onProgress callback (optional)
      (error) => console.error("Error loading /star-color-ramp.png", error)
    )
  }, [])

  const baseGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])

  return (
    <Instances ref={instancedMeshRef} limit={count}>
      <primitive object={baseGeometry} attach="geometry" />
      <shaderMaterial
        ref={shaderRef}
        uniforms={{
          uTime: { value: 0 },
          pointTexture: { value: pointTexture },
          uColorRamp: { value: colorRampTexture },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent={true}
      />
      {instanceData.map((data, i) => (
        <Instance
          key={i}
          position={data.position}
          // scale={data.size} // Alternative: Control scale via Instance prop, then vertex shader uses 'position' directly.
          // If using this, then in vertex shader: vec3 scaledPosition = position;
        />
      ))}
    </Instances>
  )
}

export { Starfield }
