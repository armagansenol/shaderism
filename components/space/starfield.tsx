import React, { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const Starfield = () => {
  const pointsRef = useRef<THREE.Points>(null!)
  const shaderRef = useRef<THREE.ShaderMaterial>(null!)

  const count = 10000
  const minRadius = 50
  const maxRadius = 1000

  const { positions, colorUVs, brightnessFactors, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const clrUVs = new Float32Array(count)
    const brghtFactors = new Float32Array(count)
    const sz = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      let x, y, z, d
      do {
        x = (Math.random() - 0.5) * maxRadius * 2
        y = (Math.random() - 0.5) * maxRadius * 2
        z = (Math.random() - 0.5) * maxRadius * 2
        d = Math.sqrt(x * x + y * y + z * z)
      } while (d > maxRadius || d < minRadius)

      pos[i * 3 + 0] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z

      clrUVs[i] = Math.random()
      brghtFactors[i] = Math.random() * 1.5 + 0.5
      sz[i] = Math.random() * 1.5 + 0.5
    }
    return {
      positions: new THREE.BufferAttribute(pos, 3),
      colorUVs: new THREE.BufferAttribute(clrUVs, 1),
      brightnessFactors: new THREE.BufferAttribute(brghtFactors, 1),
      sizes: new THREE.BufferAttribute(sz, 1),
    }
  }, [count, minRadius, maxRadius])

  useFrame(({ clock }) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  const vertexShader = `
      uniform float uTime;
      attribute float size;
      attribute float colorUv;
      attribute float brightness;
      
      varying float vColorUv;
      varying float vBrightness;
      varying float vSize;
  
      void main() {
        vColorUv = colorUv;
        vBrightness = brightness;
        vSize = size;
  
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z) * (sin(uTime * (0.1 + fract(position.x * 0.01)) + position.x * 0.5) * 0.5 + 0.5);
        gl_Position = projectionMatrix * mvPosition;
      }
    `

  const fragmentShader = `
      uniform sampler2D pointTexture;     // Texture for the star shape
      uniform sampler2D uColorRamp;     // Texture for star colors
      uniform float uTime;              // Time for blinking variation
  
      varying float vColorUv;
      varying float vBrightness;
      varying float vSize; // Received from vertex shader, can be used for additional effects if needed
  
      void main() {
        vec4 tex = texture2D(pointTexture, gl_PointCoord);
  
        // --- Debug: Temporarily use only the pointTexture for color and alpha ---
        gl_FragColor = tex;
        // --- End Debug ---
  
        // Original code (commented out for debugging):
        // vec3 baseColor = texture2D(uColorRamp, vec2(vColorUv, 0.5)).rgb;
        // vec3 finalColor = baseColor * vBrightness;
        // gl_FragColor = vec4(finalColor, tex.a);
        // gl_FragColor.rgb *= tex.a;
      }
    `

  const pointTexture = useMemo(() => new THREE.TextureLoader().load("/star.png"), [])
  const colorRampTexture = useMemo(() => new THREE.TextureLoader().load("/star-color-ramp.png"), [])

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <primitive attach="attributes-position" object={positions} />
        <primitive attach="attributes-size" object={sizes} />
        <primitive attach="attributes-colorUv" object={colorUVs} />
        <primitive attach="attributes-brightness" object={brightnessFactors} />
      </bufferGeometry>
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
    </points>
  )
}

export { Starfield }
