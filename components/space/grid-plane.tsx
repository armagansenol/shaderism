import React, { useRef, useMemo, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useControls, folder } from "leva"
import * as THREE from "three"

// Placeholder for water normals texture - replace with your actual texture
const waterNormalsTextureURL1 = "/water-normal-map-3.jpg" // Path for the first normal map
// const waterNormalsTextureURL2 = "/vortex-map.png" // We'll set this aside for now, vortex is geometric

const GridPlane = () => {
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const { scene, camera } = useThree()

  const [normalSampler1, setNormalSampler1] = useState<THREE.Texture | null>(null)
  const [boundingSphere, setBoundingSphere] = useState<THREE.Sphere | null>(null)

  useEffect(() => {
    const textureLoader = new THREE.TextureLoader()
    textureLoader.load(waterNormalsTextureURL1, (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      setNormalSampler1(texture)
    })
  }, [])

  // Initial values for uniforms and GUI
  const initialParams = useMemo(
    () => ({
      gridColor: new THREE.Color(0x4fff75),
      size: 1.0,
      noiseStrength: 0.05, // Reduced noise for cylinder
      alpha: 1.0,
      lineThickness: 0.008, // Adjusted for cylinder view
      lineFade: 0.004, // Adjusted for cylinder view
      gridDensity: 15.0, // Flat grid density (lines along cylinder length)
      numCircumferentialLines: 24.0, // New: for lines around circumference
      animationSpeed: 1.0,
      // New general cylinder fading params
      cylinderEndFadeStart: 0.7,
      cylinderEndFadeLength: 0.3,
      cylinderOpeningFade: 0.1,
      // Hourglass shape parameters
      topRadius: 200, // Radius at the top
      waistRadius: 25, // Radius at the narrowest point (middle)
      bottomRadius: 80, // Radius at the bottom
      waistPosition: 0.5, // Position of waist along height (0.0 = bottom, 1.0 = top)
    }),
    []
  )

  const uniforms = useMemo(
    () => ({
      normalSampler1: { value: null },
      time: { value: 0.0 },
      size: { value: initialParams.size },
      uGridColor: { value: initialParams.gridColor.clone() },
      alpha: { value: initialParams.alpha },
      noiseStrength: { value: initialParams.noiseStrength },
      uLineThickness: { value: initialParams.lineThickness },
      uLineFade: { value: initialParams.lineFade },
      uGridDensity: { value: initialParams.gridDensity },
      uAnimationSpeed: { value: initialParams.animationSpeed },
      uNumCircumferentialLines: { value: initialParams.numCircumferentialLines },
      // New general cylinder fading uniforms
      uCylinderEndFadeStart: { value: initialParams.cylinderEndFadeStart },
      uCylinderEndFadeLength: { value: initialParams.cylinderEndFadeLength },
      uCylinderOpeningFade: { value: initialParams.cylinderOpeningFade },
    }),
    [initialParams]
  )

  const frustum = useMemo(() => new THREE.Frustum(), [])
  const projScreenMatrix = useMemo(() => new THREE.Matrix4(), [])

  // Function to create hourglass geometry
  const createHourglassGeometry = (params: typeof initialParams) => {
    const points = []
    const segments = 20 // Number of points along the profile
    const cylinderHeight = 1000

    for (let i = 0; i <= segments; i++) {
      const t = i / segments // 0 to 1

      // Create hourglass curve using smooth interpolation
      let radius
      if (t <= params.waistPosition) {
        // From bottom to waist
        const localT = t / params.waistPosition
        radius =
          params.bottomRadius +
          (params.waistRadius - params.bottomRadius) * (3 * localT * localT - 2 * localT * localT * localT) // Smooth curve
      } else {
        // From waist to top
        const localT = (t - params.waistPosition) / (1 - params.waistPosition)
        radius =
          params.waistRadius +
          (params.topRadius - params.waistRadius) * (3 * localT * localT - 2 * localT * localT * localT) // Smooth curve
      }

      const y = (t - 0.5) * cylinderHeight // Center the hourglass
      points.push(new THREE.Vector2(radius, y))
    }

    return new THREE.LatheGeometry(points, 32)
  }

  // Leva controls for Grid Plane
  useControls("Tunnel Controls", {
    "Grid Appearance": folder({
      "Grid Color": {
        value: `#${initialParams.gridColor.getHexString()}`,
        onChange: (value: string) => {
          if (materialRef.current?.uniforms.uGridColor?.value) {
            materialRef.current.uniforms.uGridColor.value.set(value)
          }
        },
      },
      Size: {
        value: initialParams.size,
        min: 0.01,
        max: 10.0,
        step: 0.01,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.size) {
            materialRef.current.uniforms.size.value = value
          }
        },
      },
      "Noise Strength": {
        value: initialParams.noiseStrength,
        min: 0.0,
        max: 0.5,
        step: 0.001,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.noiseStrength) {
            materialRef.current.uniforms.noiseStrength.value = value
          }
        },
      },
      Alpha: {
        value: initialParams.alpha,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.alpha) {
            materialRef.current.uniforms.alpha.value = value
          }
        },
      },
      "Line Thickness": {
        value: initialParams.lineThickness,
        min: 0.001,
        max: 0.05,
        step: 0.001,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.uLineThickness) {
            materialRef.current.uniforms.uLineThickness.value = value
          }
        },
      },
      "Line Fade": {
        value: initialParams.lineFade,
        min: 0.0001,
        max: 0.02,
        step: 0.0001,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.uLineFade) {
            materialRef.current.uniforms.uLineFade.value = value
          }
        },
      },
      "Animation Speed": {
        value: initialParams.animationSpeed,
        min: 0.0,
        max: 5.0,
        step: 0.01,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.uAnimationSpeed) {
            materialRef.current.uniforms.uAnimationSpeed.value = value
          }
        },
      },
    }),
    "Wavy Grid (Cylinder)": folder({
      "Grid Density (Lengthwise)": {
        value: initialParams.gridDensity,
        min: 1.0,
        max: 50.0,
        step: 0.1,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.uGridDensity) {
            materialRef.current.uniforms.uGridDensity.value = value
          }
        },
      },
      "Circumferential Lines": {
        value: initialParams.numCircumferentialLines,
        min: 0.0,
        max: 100.0,
        step: 1.0,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.uNumCircumferentialLines) {
            materialRef.current.uniforms.uNumCircumferentialLines.value = value
          }
        },
      },
      "Near End Fade": {
        value: initialParams.cylinderOpeningFade,
        min: 0.0,
        max: 0.5,
        step: 0.01,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.uCylinderOpeningFade) {
            materialRef.current.uniforms.uCylinderOpeningFade.value = value
          }
        },
      },
      "Far End Fade Start": {
        value: initialParams.cylinderEndFadeStart,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.uCylinderEndFadeStart) {
            materialRef.current.uniforms.uCylinderEndFadeStart.value = value
          }
        },
      },
      "Far End Fade Length": {
        value: initialParams.cylinderEndFadeLength,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        onChange: (value: number) => {
          if (materialRef.current?.uniforms.uCylinderEndFadeLength) {
            materialRef.current.uniforms.uCylinderEndFadeLength.value = value
          }
        },
      },
    }),
    "Hourglass Shape": folder({
      "Top Radius": {
        value: initialParams.topRadius,
        min: 5.0,
        max: 200.0,
        step: 1.0,
        onChange: (value: number) => {
          const newParams = { ...initialParams, topRadius: value }
          if (meshRef.current) {
            const newGeometry = createHourglassGeometry(newParams)
            meshRef.current.geometry.dispose()
            meshRef.current.geometry = newGeometry
          }
        },
      },
      "Waist Radius": {
        value: initialParams.waistRadius,
        min: 5.0,
        max: 100.0,
        step: 1.0,
        onChange: (value: number) => {
          const newParams = { ...initialParams, waistRadius: value }
          if (meshRef.current) {
            const newGeometry = createHourglassGeometry(newParams)
            meshRef.current.geometry.dispose()
            meshRef.current.geometry = newGeometry
          }
        },
      },
      "Bottom Radius": {
        value: initialParams.bottomRadius,
        min: 5.0,
        max: 150.0,
        step: 1.0,
        onChange: (value: number) => {
          const newParams = { ...initialParams, bottomRadius: value }
          if (meshRef.current) {
            const newGeometry = createHourglassGeometry(newParams)
            meshRef.current.geometry.dispose()
            meshRef.current.geometry = newGeometry
          }
        },
      },
      "Waist Position": {
        value: initialParams.waistPosition,
        min: 0.2,
        max: 0.8,
        step: 0.01,
        onChange: (value: number) => {
          const newParams = { ...initialParams, waistPosition: value }
          if (meshRef.current) {
            const newGeometry = createHourglassGeometry(newParams)
            meshRef.current.geometry.dispose()
            meshRef.current.geometry = newGeometry
          }
        },
      },
    }),
  })

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.geometry.computeBoundingSphere()
      if (meshRef.current.geometry.boundingSphere) {
        setBoundingSphere(meshRef.current.geometry.boundingSphere.clone())
      }
    }
  }, []) // Compute once after mount

  useEffect(() => {
    if (materialRef.current && normalSampler1) {
      materialRef.current.uniforms.normalSampler1.value = normalSampler1
    }
  }, [normalSampler1])

  useFrame(({ clock }) => {
    if (!materialRef.current || !normalSampler1 || !meshRef.current || !boundingSphere) return

    // Frustum culling check
    camera.updateMatrixWorld()
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(projScreenMatrix)

    // We need to apply the mesh's world matrix to its bounding sphere
    const worldSphere = boundingSphere.clone().applyMatrix4(meshRef.current.matrixWorld)

    if (!frustum.intersectsSphere(worldSphere)) {
      return // Skip updates if not visible
    }

    const effectiveTime = clock.getElapsedTime() * materialRef.current.uniforms.uAnimationSpeed.value
    materialRef.current.uniforms.time.value = effectiveTime
  })

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition; // Changed from vec4, we only need .xyz for world pos

    #include <fog_pars_vertex>
    #include <logdepthbuf_pars_vertex>

    void main() {
      vUv = uv;
      // modelMatrix * vec4(position, 1.0) gives world position of vertex
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      #include <logdepthbuf_vertex>
      #include <fog_vertex>
    }
  `

  const fragmentShader = `
    uniform float time;
    uniform float size; // Noise scale
    uniform sampler2D normalSampler1;
    uniform vec3 uGridColor;
    uniform float alpha;
    uniform float noiseStrength;
    uniform float uLineThickness;
    uniform float uLineFade;
    uniform float uGridDensity; // For flat grid mode (lines along cylinder length)
    uniform float uNumCircumferentialLines; // New: for lines around circumference
    
    // New general cylinder fading uniforms
    uniform float uCylinderEndFadeStart;
    uniform float uCylinderEndFadeLength;
    uniform float uCylinderOpeningFade;

    varying vec2 vUv; // u: circumference, v: length
    varying vec3 vWorldPosition;

    #define PI 3.141592653589793

    #include <common>
    #include <fog_pars_fragment>
    #include <logdepthbuf_pars_fragment>

    vec4 sampleNoise(sampler2D smplr, vec2 uv_coord_for_noise) {
      vec2 uv0 = ( uv_coord_for_noise / 103.0 ) + vec2(time / 17.0, time / 29.0);
      vec2 uv1 = uv_coord_for_noise / 107.0 - vec2( time / -19.0, time / 31.0 );
      vec2 uv2 = uv_coord_for_noise / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
      vec2 uv3 = uv_coord_for_noise / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
      vec4 noise = texture2D( smplr, uv0 ) +
                   texture2D( smplr, uv1 ) +
                   texture2D( smplr, uv2 ) +
                   texture2D( smplr, uv3 );
      return noise * 0.5 - 1.0;
    }

    float line(float val, float thickness, float fade) {
      // Ensure thickness + fade does not exceed 0.5 to avoid overlap from fract()
      // This can be made more robust if needed
      return smoothstep(0.0, thickness, val) - smoothstep(thickness, thickness + fade, val);
    }

    vec3 renderWavyCylinderGrid(vec2 uv, vec3 worldPos) {
      // For wavy effect on cylinder, we can use world position for noise sampling
      // or try to create a 2D domain from unfolding the cylinder if more control is needed.
      // Using worldPos.xz (top-down view essentially) for noise sampling point:
      vec4 noise = sampleNoise(normalSampler1, worldPos.xz * size ); 
      
      // Displace UVs. For a cylinder, u (vUv.x) is angle, v (vUv.y) is length.
      // Noise can displace the perceived angle or length a bit.
      vec2 displacedUv = uv;
      displacedUv.x += noise.x * noiseStrength * 0.1; // Affect angle slightly
      displacedUv.y += noise.y * noiseStrength;      // Affect length position

      // Lines along the length (controlled by uGridDensity)
      float linesLengthwise = line(fract(displacedUv.y * uGridDensity), uLineThickness, uLineFade);
      // Lines around the circumference (controlled by uNumCircumferentialLines)
      float linesCircumferential = line(fract(displacedUv.x * uNumCircumferentialLines), uLineThickness, uLineFade);
      
      float grid = max(linesLengthwise, linesCircumferential);

      // Fade along the length of the cylinder using new general uniforms
      float fadeOut = 1.0 - smoothstep(uCylinderEndFadeStart, uCylinderEndFadeStart + uCylinderEndFadeLength, uv.y);
      float fadeIn = smoothstep(0.0, uCylinderOpeningFade, uv.y);

      return uGridColor * grid * fadeOut * fadeIn;
    }

    void main() {
      #include <logdepthbuf_fragment>

      vec3 wavyCylinderColor = renderWavyCylinderGrid(vUv, vWorldPosition);
      
      gl_FragColor = vec4(wavyCylinderColor, alpha);

      #include <fog_fragment>
    }
  `

  // Cylinder: radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded
  // Height is along Y by default. Rotate to make it along Z.
  const cylinderHeight = 1050

  return (
    <mesh
      ref={meshRef}
      // Rotate cylinder to be horizontal along Z axis, and move its center if needed
      // Default Cylinder is Y-up. Rotate PI/2 around X to make it Z-along if Z is forward.
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, cylinderHeight / 2]} // Position so one end is near origin if camera looks at 0,0,0
    >
      {React.createElement("primitive", { object: createHourglassGeometry(initialParams) })}
      <shaderMaterial
        ref={materialRef}
        args={[
          {
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            lights: false,
            fog: scene.fog !== undefined,
            transparent: true,
            side: THREE.DoubleSide, // Render inside of the cylinder too
          },
        ]}
      />
    </mesh>
  )
}

export { GridPlane }
