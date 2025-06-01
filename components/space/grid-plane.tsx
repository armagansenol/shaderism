import React, { useRef, useMemo, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
// import { GUI } from "dat.gui"; // Removed static import

// Placeholder for water normals texture - replace with your actual texture
const waterNormalsTextureURL1 = "/water-normal-map-3.jpg" // Path for the first normal map
// const waterNormalsTextureURL2 = "/vortex-map.png" // We'll set this aside for now, vortex is geometric

// Global flag to prevent multiple GUI creation
let globalGuiCreated = false

const GridPlane = () => {
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const guiRef = useRef<{ destroy: () => void } | null>(null) // Add ref to track GUI instance

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

  useEffect(() => {
    if (!materialRef.current?.uniforms) return
    if (guiRef.current) return // Prevent creating multiple GUIs
    if (globalGuiCreated) return // Global check to prevent any duplicate GUI

    // Dynamically import dat.gui only on the client side
    if (typeof window !== "undefined") {
      import("dat.gui")
        .then((dat) => {
          if (globalGuiCreated) return // Double-check in case another instance started creating GUI

          const GUI = dat.GUI // Access GUI constructor from the imported module
          const gui = new GUI()
          guiRef.current = gui // Store the GUI instance
          globalGuiCreated = true // Mark as created globally
          const guiFolder = gui.addFolder("Tunnel Controls")

          const guiParams = {
            gridColor: `#${initialParams.gridColor.getHexString()}`,
            size: initialParams.size,
            noiseStrength: initialParams.noiseStrength,
            alpha: initialParams.alpha,
            lineThickness: initialParams.lineThickness,
            lineFade: initialParams.lineFade,
            animationSpeed: initialParams.animationSpeed,
          }

          guiFolder.addColor(guiParams, "gridColor").onChange((value: string) => {
            materialRef.current?.uniforms.uGridColor?.value.set(value)
          })
          guiFolder.add(guiParams, "size", 0.01, 10.0, 0.01).onChange((value: number) => {
            materialRef.current.uniforms.size.value = value
          })
          guiFolder.add(guiParams, "noiseStrength", 0.0, 0.5, 0.001).onChange((value: number) => {
            materialRef.current.uniforms.noiseStrength.value = value
          })
          guiFolder.add(guiParams, "alpha", 0.0, 1.0, 0.01).onChange((value: number) => {
            materialRef.current.uniforms.alpha.value = value
          })
          guiFolder.add(guiParams, "lineThickness", 0.001, 0.05, 0.001).onChange((value: number) => {
            materialRef.current.uniforms.uLineThickness.value = value
          })
          guiFolder.add(guiParams, "lineFade", 0.0001, 0.02, 0.0001).onChange((value: number) => {
            materialRef.current.uniforms.uLineFade.value = value
          })
          guiFolder.add(guiParams, "animationSpeed", 0.0, 5.0, 0.01).onChange((value: number) => {
            materialRef.current.uniforms.uAnimationSpeed.value = value
          })

          const flatGridFolder = guiFolder.addFolder("Wavy Grid (Cylinder)")
          flatGridFolder
            .add(initialParams, "size", 0.01, 10.0, 0.01)
            .name("Noise Scale")
            .onChange((value: number) => {
              materialRef.current.uniforms.size.value = value
            })
          flatGridFolder
            .add(initialParams, "noiseStrength", 0.0, 0.5, 0.001)
            .name("Noise Strength")
            .onChange((value: number) => {
              materialRef.current.uniforms.noiseStrength.value = value
            })
          flatGridFolder
            .add(initialParams, "gridDensity", 1.0, 50.0, 0.1)
            .name("Grid Density (Lengthwise)")
            .onChange((value: number) => {
              materialRef.current.uniforms.uGridDensity.value = value
            })
          flatGridFolder
            .add(initialParams, "numCircumferentialLines", 5.0, 100.0, 1.0)
            .name("Circumferential Lines")
            .onChange((value: number) => {
              materialRef.current.uniforms.uNumCircumferentialLines.value = value
            })
          // Add GUI controls for new fading parameters
          flatGridFolder
            .add(initialParams, "cylinderOpeningFade", 0.0, 0.5, 0.01)
            .name("Near End Fade")
            .onChange((value: number) => {
              materialRef.current.uniforms.uCylinderOpeningFade.value = value
            })
          flatGridFolder
            .add(initialParams, "cylinderEndFadeStart", 0.0, 1.0, 0.01)
            .name("Far End Fade Start")
            .onChange((value: number) => {
              materialRef.current.uniforms.uCylinderEndFadeStart.value = value
            })
          flatGridFolder
            .add(initialParams, "cylinderEndFadeLength", 0.0, 1.0, 0.01)
            .name("Far End Fade Length")
            .onChange((value: number) => {
              materialRef.current.uniforms.uCylinderEndFadeLength.value = value
            })

          // Add hourglass shape controls
          const createHourglassGeometry = () => {
            const points = []
            const segments = 20 // Number of points along the profile

            for (let i = 0; i <= segments; i++) {
              const t = i / segments // 0 to 1

              // Create hourglass curve using smooth interpolation
              let radius
              if (t <= initialParams.waistPosition) {
                // From bottom to waist
                const localT = t / initialParams.waistPosition
                radius =
                  initialParams.bottomRadius +
                  (initialParams.waistRadius - initialParams.bottomRadius) *
                    (3 * localT * localT - 2 * localT * localT * localT) // Smooth curve
              } else {
                // From waist to top
                const localT = (t - initialParams.waistPosition) / (1 - initialParams.waistPosition)
                radius =
                  initialParams.waistRadius +
                  (initialParams.topRadius - initialParams.waistRadius) *
                    (3 * localT * localT - 2 * localT * localT * localT) // Smooth curve
              }

              const y = (t - 0.5) * cylinderHeight // Center the hourglass
              points.push(new THREE.Vector2(radius, y))
            }

            return new THREE.LatheGeometry(points, 32)
          }

          const hourglassFolder = guiFolder.addFolder("Hourglass Shape")
          hourglassFolder
            .add(initialParams, "topRadius", 5.0, 200.0, 1.0)
            .name("Top Radius")
            .onChange(() => {
              if (meshRef.current) {
                const newGeometry = createHourglassGeometry()
                meshRef.current.geometry.dispose()
                meshRef.current.geometry = newGeometry
              }
            })
          hourglassFolder
            .add(initialParams, "waistRadius", 5.0, 100.0, 1.0)
            .name("Waist Radius")
            .onChange(() => {
              if (meshRef.current) {
                const newGeometry = createHourglassGeometry()
                meshRef.current.geometry.dispose()
                meshRef.current.geometry = newGeometry
              }
            })
          hourglassFolder
            .add(initialParams, "bottomRadius", 5.0, 150.0, 1.0)
            .name("Bottom Radius")
            .onChange(() => {
              if (meshRef.current) {
                const newGeometry = createHourglassGeometry()
                meshRef.current.geometry.dispose()
                meshRef.current.geometry = newGeometry
              }
            })
          hourglassFolder
            .add(initialParams, "waistPosition", 0.2, 0.8, 0.01)
            .name("Waist Position")
            .onChange(() => {
              if (meshRef.current) {
                const newGeometry = createHourglassGeometry()
                meshRef.current.geometry.dispose()
                meshRef.current.geometry = newGeometry
              }
            })

          if (gui.domElement) {
            gui.domElement.style.zIndex = "9999"
          }

          // Store the gui instance if you need to destroy it from outside this promise
          // For now, returning the destroy function for useEffect cleanup
          return () => {
            gui.destroy()
          }
        })
        .catch((error) => {
          console.error("Failed to load dat.gui", error)
        })
    }
    // Cleanup function to destroy GUI when component unmounts
    return () => {
      if (guiRef.current) {
        guiRef.current.destroy()
        guiRef.current = null
        globalGuiCreated = false // Reset global flag
      }
    }
  }, [initialParams]) // Removed setIsVortexActive from dependencies

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

  // Create hourglass geometry
  const createHourglassGeometry = () => {
    const points = []
    const segments = 20 // Number of points along the profile

    for (let i = 0; i <= segments; i++) {
      const t = i / segments // 0 to 1

      // Create hourglass curve using smooth interpolation
      let radius
      if (t <= initialParams.waistPosition) {
        // From bottom to waist
        const localT = t / initialParams.waistPosition
        radius =
          initialParams.bottomRadius +
          (initialParams.waistRadius - initialParams.bottomRadius) *
            (3 * localT * localT - 2 * localT * localT * localT) // Smooth curve
      } else {
        // From waist to top
        const localT = (t - initialParams.waistPosition) / (1 - initialParams.waistPosition)
        radius =
          initialParams.waistRadius +
          (initialParams.topRadius - initialParams.waistRadius) * (3 * localT * localT - 2 * localT * localT * localT) // Smooth curve
      }

      const y = (t - 0.5) * cylinderHeight // Center the hourglass
      points.push(new THREE.Vector2(radius, y))
    }

    return new THREE.LatheGeometry(points, 32)
  }

  return (
    <mesh
      ref={meshRef}
      // Rotate cylinder to be horizontal along Z axis, and move its center if needed
      // Default Cylinder is Y-up. Rotate PI/2 around X to make it Z-along if Z is forward.
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, cylinderHeight / 2]} // Position so one end is near origin if camera looks at 0,0,0
    >
      {React.createElement("primitive", { object: createHourglassGeometry() })}
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
