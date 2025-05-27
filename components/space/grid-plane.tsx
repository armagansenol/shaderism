import React, { useRef, useMemo, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
// import { GUI } from "dat.gui"; // Removed static import

// Placeholder for water normals texture - replace with your actual texture
const waterNormalsTextureURL1 = "/water-normal-map-3.jpg" // Path for the first normal map
// const waterNormalsTextureURL2 = "/vortex-map.png" // We'll set this aside for now, vortex is geometric

const GridPlane = () => {
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const { scene } = useThree()

  const [normalSampler1, setNormalSampler1] = useState<THREE.Texture | null>(null)
  const [isVortexActive, setIsVortexActive] = useState(false) // false for flat grid, true for vortex

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
      gridDensity: 15.0, // Flat grid density ( circumferential lines on cylinder)
      animationSpeed: 1.0,
      // Vortex params
      numRadialLines: 24.0, // Lines around circumference
      numConcentricLines: 8.0, // Rings along length
      vortexTwistFactor: 1.5, // Increased for more twist
      vortexEndFadeStart: 0.7, // Start fading the far end of the vortex (0 = start of tube, 1 = far end)
      vortexEndFadeLength: 0.3, // Length of the fade at the far end
      vortexOpeningFade: 0.1, // Fade near the camera opening
    }),
    []
  )

  const uniforms = useMemo(
    () => ({
      normalSampler1: { value: null },
      uVortexTransition: { value: 0.0 }, // 0: flat grid, 1: vortex
      time: { value: 0.0 },
      size: { value: initialParams.size },
      uGridColor: { value: initialParams.gridColor.clone() },
      alpha: { value: initialParams.alpha },
      noiseStrength: { value: initialParams.noiseStrength },
      uLineThickness: { value: initialParams.lineThickness },
      uLineFade: { value: initialParams.lineFade },
      uGridDensity: { value: initialParams.gridDensity },
      uAnimationSpeed: { value: initialParams.animationSpeed },
      uNumRadialLines: { value: initialParams.numRadialLines },
      uNumConcentricLines: { value: initialParams.numConcentricLines },
      uVortexTwistFactor: { value: initialParams.vortexTwistFactor },
      uVortexEndFadeStart: { value: initialParams.vortexEndFadeStart },
      uVortexEndFadeLength: { value: initialParams.vortexEndFadeLength },
      uVortexOpeningFade: { value: initialParams.vortexOpeningFade },
    }),
    [initialParams]
  )

  useEffect(() => {
    if (materialRef.current && normalSampler1) {
      materialRef.current.uniforms.normalSampler1.value = normalSampler1
    }
  }, [normalSampler1])

  useEffect(() => {
    if (!materialRef.current?.uniforms) return

    // Dynamically import dat.gui only on the client side
    if (typeof window !== "undefined") {
      import("dat.gui")
        .then((dat) => {
          const GUI = dat.GUI // Access GUI constructor from the imported module
          const gui = new GUI()
          const guiFolder = gui.addFolder("Tunnel Controls")

          const guiParams = {
            gridColor: `#${initialParams.gridColor.getHexString()}`,
            size: initialParams.size,
            noiseStrength: initialParams.noiseStrength,
            alpha: initialParams.alpha,
            lineThickness: initialParams.lineThickness,
            lineFade: initialParams.lineFade,
            animationSpeed: initialParams.animationSpeed,
            toggleVortex: () => {
              setIsVortexActive((prev) => !prev)
            },
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

          const vortexFolder = guiFolder.addFolder("Vortex Grid (Cylinder)")
          vortexFolder.add(initialParams, "numRadialLines", 5.0, 100.0, 1.0).onChange((value: number) => {
            materialRef.current.uniforms.uNumRadialLines.value = value
          })
          vortexFolder
            .add(initialParams, "numConcentricLines", 5.0, 50.0, 1.0)
            .name("Rings Along Length")
            .onChange((value: number) => {
              materialRef.current.uniforms.uNumConcentricLines.value = value
            })
          vortexFolder.add(initialParams, "vortexTwistFactor", 0.0, 5.0, 0.01).onChange((value: number) => {
            materialRef.current.uniforms.uVortexTwistFactor.value = value
          })
          vortexFolder
            .add(initialParams, "vortexEndFadeStart", 0.0, 1.0, 0.01)
            .name("Far End Fade Start (0-1)")
            .onChange((value: number) => {
              materialRef.current.uniforms.uVortexEndFadeStart.value = value
            })
          vortexFolder
            .add(initialParams, "vortexEndFadeLength", 0.0, 1.0, 0.01)
            .name("Far End Fade Length")
            .onChange((value: number) => {
              materialRef.current.uniforms.uVortexEndFadeLength.value = value
            })
          vortexFolder
            .add(initialParams, "vortexOpeningFade", 0.0, 0.5, 0.01)
            .name("Near End Fade (0-1)")
            .onChange((value: number) => {
              materialRef.current.uniforms.uVortexOpeningFade.value = value
            })

          guiFolder.add(guiParams, "toggleVortex").name("Toggle Vortex Mode")
          guiFolder.open()

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
    // If not in window context, we don't do anything, and no cleanup is needed initially.
    // The return from the promise handles cleanup if GUI was loaded.
    // If you need a general cleanup function for other things in useEffect, define it here.
    return () => {
      // General cleanup if needed, e.g. if gui instance was stored on the component
      // and needs to be destroyed regardless of promise success.
      // This might be tricky if gui is only defined in the promise scope.
      // A common pattern is to use a ref to store the gui instance.
    }
  }, [initialParams, setIsVortexActive]) // Added setIsVortexActive back as it's used in toggleVortex

  useFrame(({ clock }) => {
    if (!materialRef.current || !normalSampler1) return
    const effectiveTime = clock.getElapsedTime() * materialRef.current.uniforms.uAnimationSpeed.value
    materialRef.current.uniforms.time.value = effectiveTime

    const currentVortexTransition = materialRef.current.uniforms.uVortexTransition.value
    const targetVortexTransitionValue = isVortexActive ? 1.0 : 0.0
    const transitionSpeed = 0.03

    if (Math.abs(currentVortexTransition - targetVortexTransitionValue) > 0.001) {
      materialRef.current.uniforms.uVortexTransition.value +=
        (targetVortexTransitionValue - currentVortexTransition) * transitionSpeed
    } else {
      materialRef.current.uniforms.uVortexTransition.value = targetVortexTransitionValue
    }
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
    
    uniform float uVortexTransition; // 0: flat, 1: vortex
    uniform float uNumRadialLines;   // Lines around circumference in vortex
    uniform float uNumConcentricLines; // Rings along length in vortex
    uniform float uVortexTwistFactor;
    uniform float uVortexEndFadeStart; // Start of fade at the far end (0-1 along length)
    uniform float uVortexEndFadeLength; // Length of fade at far end
    uniform float uVortexOpeningFade; // Fade at the near end (0-1 along length)

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
      // Lines around the circumference (can use uNumRadialLines or a new density param)
      float linesCircumferential = line(fract(displacedUv.x * uNumRadialLines), uLineThickness, uLineFade);
      
      float grid = max(linesLengthwise, linesCircumferential);

      // Fade along the length of the cylinder (original vUv.y for consistent fade end)
      float fadeOut = 1.0 - smoothstep(uVortexEndFadeStart, uVortexEndFadeStart + uVortexEndFadeLength, uv.y);
      float fadeIn = smoothstep(0.0, uVortexOpeningFade, uv.y); // Fade in at the start of the tube

      return uGridColor * grid * fadeOut * fadeIn;
    }

    vec3 renderVortexOnCylinder(vec2 uv, vec3 worldPos) {
      float angle_uv = uv.x; // 0-1, angle around cylinder
      float dist_uv = uv.y;  // 0-1, distance along cylinder length

      // Apply twist: twist increases with distance along the tube
      float twisted_angle_uv = angle_uv + dist_uv * uVortexTwistFactor * (0.5 + uVortexTransition * 0.5); 
      // Add time-based rotation to the vortex itself
      twisted_angle_uv += time * 0.05 * uVortexTwistFactor;

      float radialLines = line(fract(twisted_angle_uv * uNumRadialLines), uLineThickness, uLineFade);
      // Concentric lines are now rings along the length of the tube
      float concentricRings = line(fract(dist_uv * uNumConcentricLines), uLineThickness, uLineFade);
      
      float grid = max(radialLines, concentricRings);

      // Fade the far end of the vortex to create the "hole"
      float endFade = 1.0 - smoothstep(uVortexEndFadeStart, uVortexEndFadeStart + uVortexEndFadeLength, dist_uv);
      // Fade the opening near the camera as well, to soften the entrance
      float openingFade = smoothstep(0.0, uVortexOpeningFade, dist_uv);
      
      return uGridColor * grid * endFade * openingFade;
    }

    void main() {
      #include <logdepthbuf_fragment>

      vec3 wavyCylinderColor = renderWavyCylinderGrid(vUv, vWorldPosition);
      vec3 vortexCylinderColor = renderVortexOnCylinder(vUv, vWorldPosition);

      vec3 finalColor = mix(wavyCylinderColor, vortexCylinderColor, uVortexTransition);
      
      gl_FragColor = vec4(finalColor, alpha);

      #include <fog_fragment>
    }
  `

  // Cylinder: radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded
  // Height is along Y by default. Rotate to make it along Z.
  const cylinderRadius = 50
  const cylinderHeight = 1000

  return (
    <mesh
      ref={meshRef}
      // Rotate cylinder to be horizontal along Z axis, and move its center if needed
      // Default Cylinder is Y-up. Rotate PI/2 around X to make it Z-along if Z is forward.
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, cylinderHeight / 2]} // Position so one end is near origin if camera looks at 0,0,0
    >
      <cylinderGeometry args={[cylinderRadius, cylinderRadius, cylinderHeight, 32, 5, true]} />
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
