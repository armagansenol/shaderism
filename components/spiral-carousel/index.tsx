"use client"

import { shaderMaterial, useTexture } from "@react-three/drei"
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber"
import type { GUI as GUIType } from "dat.gui"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Suspense, useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { Starfield } from "../space/starfield"

// Constants
const SLIDE_COUNT = 6
const IMAGES = [
  "/carousel/1.jpg",
  "/carousel/2.jpg",
  "/carousel/3.jpg",
  "/carousel/4.jpg",
  "/carousel/5.jpg",
  "/carousel/6.jpg",
  "/carousel/7.jpg",
]

const INITIAL_PARAMS = {
  radius: 3,
  gapPercent: 10,
  heightScale: 1,
  camX: 0,
  camY: 0,
  camZ: 2,
  fov: 45,
  rotXDeg: 0,
  rotYDeg: 0,
  rotZDeg: 90,
  posX: 0,
  posY: 0,
  posZ: 0,
}

// Types
type Params = typeof INITIAL_PARAMS

// Curved material to map a plane onto a cylindrical surface
const CurvedMaterial = shaderMaterial(
  {
    map: null,
    radius: 3,
    thetaStart: 0,
    thetaLength: Math.PI / 3,
    height: 1,
    barrelK: 0.02,
    barrelPower: 2.0,
  },
  // vertex
  `varying vec2 vUv;
   uniform float radius;
   uniform float thetaStart;
   uniform float thetaLength;
   uniform float height;
   uniform float barrelK;
   uniform float barrelPower;
   void main(){
     vUv = uv;
     float phi = thetaStart + uv.x * thetaLength;
     vec3 radial = vec3(sin(phi), 0.0, cos(phi));
     float yNorm = (uv.y - 0.5) * 2.0; // -1..1
     float bulge = 1.0 + barrelK * (1.0 - pow(abs(yNorm), barrelPower));
     float r = radius * bulge;
     vec3 transformed = vec3(r * radial.x, (uv.y - 0.5) * height, r * radial.z);
     gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
   }`,
  // fragment
  `uniform sampler2D map; varying vec2 vUv; void main(){ vec2 uv = vec2(vUv.y, 1.0 - vUv.x); gl_FragColor = texture2D(map, uv); }`
)

extend({ CurvedMaterial })

// Custom hook for smooth mouse tracking
function useMouseTracking(lerpFactorX = 0.1, lerpFactorY = 0.01) {
  const targetMousePosition = useRef({ x: 0, y: 0 })
  const currentMousePosition = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1 // -1 to 1
      const y = (event.clientY / window.innerHeight) * 2 - 1 // -1 to 1
      targetMousePosition.current = { x, y }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  const updateMousePosition = () => {
    currentMousePosition.current.x = THREE.MathUtils.lerp(
      currentMousePosition.current.x,
      targetMousePosition.current.x,
      lerpFactorX
    )
    currentMousePosition.current.y = THREE.MathUtils.lerp(
      currentMousePosition.current.y,
      targetMousePosition.current.y,
      lerpFactorY
    )
  }

  return { currentMousePosition, updateMousePosition }
}

// Custom hook for slide calculation
function useSlideTracking(slideCount: number, getProgress: () => number) {
  const [currentSlide, setCurrentSlide] = useState(1)

  useEffect(() => {
    const updateSlide = () => {
      const progress = getProgress()
      const slideNumber = Math.floor(progress * slideCount) + 1
      setCurrentSlide(Math.min(slideNumber, slideCount))
    }

    const interval = setInterval(updateSlide, 16) // ~60fps
    return () => clearInterval(interval)
  }, [slideCount, getProgress])

  return currentSlide
}

function CylinderPreview({
  radius,
  gapPercent,
  heightScale,
  getScrollProgress,
  barrelK,
  barrelPower,
  rotX,
  rotY,
  rotZ,
  posX,
  posY,
  posZ,
}: {
  radius: number
  gapPercent: number
  heightScale: number
  getScrollProgress: () => number
  barrelK: number
  barrelPower: number
  rotX: number
  rotY: number
  rotZ: number
  posX: number
  posY: number
  posZ: number
}) {
  const group = useRef<THREE.Group>(null)
  const { currentMousePosition, updateMousePosition } = useMouseTracking()

  useFrame(() => {
    if (!group.current) return
    const scrollProgress = getScrollProgress()

    // Update mouse position with smooth interpolation
    updateMousePosition()

    // Apply position
    group.current.position.set(posX, posY, posZ)

    // Reset rotation matrix
    group.current.rotation.set(0, 0, 0)

    // Apply scroll-based rotation around X-axis directly
    group.current.rotation.x = scrollProgress * Math.PI * 2

    // Apply mouse-based rotation (subtle movement with smooth interpolation)
    const mouseRotationY = currentMousePosition.current.x * 0.05 // Scale down for subtle effect
    const mouseRotationX = currentMousePosition.current.y * 0.1 // Scale down for subtle effect

    group.current.rotateY(mouseRotationY)
    group.current.rotateX(mouseRotationX)

    // Then apply the user-defined rotations in the correct order
    // This ensures the rotation axis is properly transformed
    group.current.rotateX(rotX)
    group.current.rotateY(rotY)
    group.current.rotateZ(rotZ)
  })

  // Slides
  const textures = useTexture(IMAGES)
  textures.forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    t.anisotropy = 8
    t.flipY = false
  })

  const thetaLength = (2 * Math.PI) / IMAGES.length
  const gapAngle = thetaLength * (gapPercent / 100)
  const visibleTheta = thetaLength - gapAngle
  const arcLength = radius * visibleTheta
  const height = ((arcLength * 2160) / 2700) * heightScale

  return (
    <group ref={group}>
      {textures.map((tex, i) => (
        <mesh key={i}>
          <planeGeometry args={[1, 1, 64, 128]} />
          {/* @ts-expect-error Drei shaderMaterial JSX type */}
          <curvedMaterial
            attach='material'
            map={tex}
            radius={radius}
            thetaStart={i * thetaLength + gapAngle / 2}
            thetaLength={visibleTheta}
            height={height}
            barrelK={barrelK}
            barrelPower={barrelPower}
            side={THREE.DoubleSide}
            transparent={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

export function SpiralCarousel() {
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const cylinderProgressRef = useRef<number>(0)
  const [params, setParams] = useState<Params>(INITIAL_PARAMS)
  const [barrel, setBarrel] = useState({ k: 0.02, power: 2.0 })

  const currentSlide = useSlideTracking(SLIDE_COUNT, () => cylinderProgressRef.current)

  // Keep camera reactive to GUI changes
  function CameraSync() {
    const { camera } = useThree()
    useFrame(() => {
      if (camera.position.x !== params.camX || camera.position.y !== params.camY || camera.position.z !== params.camZ) {
        camera.position.set(params.camX, params.camY, params.camZ)
      }
      const persp = camera as THREE.PerspectiveCamera
      if (persp.fov !== params.fov) {
        persp.fov = params.fov
        persp.updateProjectionMatrix()
      }
    })
    return null
  }

  // initialize dat.gui once (avoid recreating on state change)
  useEffect(() => {
    let gui: GUIType | null = null
    ;(async () => {
      const { GUI } = await import("dat.gui")
      const g = new GUI({ width: 300 })
      gui = g
      g.domElement.style.position = "absolute"
      g.domElement.style.right = "16px"
      g.domElement.style.top = "16px"

      const conf: Params = { ...INITIAL_PARAMS }
      g.add(conf, "radius", 1, 8, 0.1).onChange((v: number) => setParams((p) => ({ ...p, radius: v })))
      g.add(conf, "gapPercent", 0, 50, 1)
        .name("gap %")
        .onChange((v: number) => setParams((p) => ({ ...p, gapPercent: v })))
      g.add(conf, "heightScale", 0.5, 2, 0.01)
        .name("height scale")
        .onChange((v: number) => setParams((p) => ({ ...p, heightScale: v })))

      const camFolder = g.addFolder("camera")
      camFolder
        .add(conf, "camX", -10, 10, 0.1)
        .name("x")
        .onChange((v: number) => setParams((p) => ({ ...p, camX: v })))
      camFolder
        .add(conf, "camY", -10, 10, 0.1)
        .name("y")
        .onChange((v: number) => setParams((p) => ({ ...p, camY: v })))
      camFolder
        .add(conf, "camZ", 1, 30, 0.1)
        .name("z")
        .onChange((v: number) => setParams((p) => ({ ...p, camZ: v })))
      camFolder
        .add(conf, "fov", 20, 90, 1)
        .name("fov")
        .onChange((v: number) => setParams((p) => ({ ...p, fov: v })))

      const rotFolder = g.addFolder("rotation (deg)")
      rotFolder
        .add(conf, "rotXDeg", -180, 180, 1)
        .name("x")
        .onChange((v: number) => setParams((p) => ({ ...p, rotXDeg: v })))
      rotFolder
        .add(conf, "rotYDeg", -180, 180, 1)
        .name("y")
        .onChange((v: number) => setParams((p) => ({ ...p, rotYDeg: v })))
      rotFolder
        .add(conf, "rotZDeg", -180, 180, 1)
        .name("z")
        .onChange((v: number) => setParams((p) => ({ ...p, rotZDeg: v })))

      const posFolder = g.addFolder("position")
      posFolder
        .add(conf, "posX", -10, 10, 0.1)
        .name("x")
        .onChange((v: number) => setParams((p) => ({ ...p, posX: v })))
      posFolder
        .add(conf, "posY", -10, 10, 0.1)
        .name("y")
        .onChange((v: number) => setParams((p) => ({ ...p, posY: v })))
      posFolder
        .add(conf, "posZ", -10, 10, 0.1)
        .name("z")
        .onChange((v: number) => setParams((p) => ({ ...p, posZ: v })))

      const barrelFolder = g.addFolder("barrel")
      const barrelConf = { k: 0.2, power: 2.0 }
      barrelFolder
        .add(barrelConf, "k", -0.6, 1.0, 0.01)
        .name("amount")
        .onChange((v: number) => setBarrel((b) => ({ ...b, k: v })))
      barrelFolder
        .add(barrelConf, "power", 1.0, 6.0, 0.1)
        .name("power")
        .onChange((v: number) => setBarrel((b) => ({ ...b, power: v })))
    })()

    return () => gui?.destroy()
  }, [])

  // Pin + scrub the section to drive progress via ScrollTrigger
  useEffect(() => {
    if (!sectionRef.current) return
    gsap.registerPlugin(ScrollTrigger)

    const st = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top top",
      end: "+=6000",
      scrub: true,
      pin: true,
      onUpdate: (self) => {
        cylinderProgressRef.current = self.progress
      },
    })

    return () => {
      st.kill()
    }
  }, [])

  return (
    <>
      <div className='w-screen h-11/12 bg-black flex items-center justify-center'>
        <span className='text-white text-4xl font-bold'>BMW</span>
      </div>
      <div ref={sectionRef} className='w-screen h-screen relative'>
        <div className='w-full h-[200px] bg-gradient-to-b from-black to-black/0 z-50 absolute top-0 left-0'></div>
        <div className='w-full h-[200px] bg-gradient-to-t from-black to-black/0 z-50 absolute bottom-0 left-0'></div>
        <Canvas
          camera={{ position: [params.camX, params.camY, params.camZ], fov: params.fov }}
          onCreated={({ camera }) => {
            camera.position.set(params.camX, params.camY, params.camZ)
            const persp = camera as THREE.PerspectiveCamera
            persp.fov = params.fov
            persp.updateProjectionMatrix()
          }}
        >
          <color attach='background' args={[0x000000]} />
          <CameraSync />
          <Suspense fallback={null}>
            <CylinderPreview
              radius={params.radius}
              gapPercent={params.gapPercent}
              heightScale={params.heightScale}
              getScrollProgress={() => cylinderProgressRef.current}
              barrelK={barrel.k}
              barrelPower={barrel.power}
              rotX={(params.rotXDeg * Math.PI) / 180}
              rotY={(params.rotYDeg * Math.PI) / 180}
              rotZ={-(params.rotZDeg * Math.PI) / 180}
              posX={params.posX}
              posY={params.posY}
              posZ={params.posZ}
            />
          </Suspense>
          <Starfield />
          {/* <EffectComposer>
          <PostProcessingManager />
        </EffectComposer> */}
        </Canvas>

        {/* Slide Number Display */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
            fontFamily: "Arial, sans-serif",
            textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          {currentSlide} / {SLIDE_COUNT}
        </div>
      </div>
      <div className='w-screen h-11/12 bg-black flex items-center justify-center'>
        <span className='text-white text-4xl font-bold'>BMW</span>
      </div>
    </>
  )
}

export default SpiralCarousel
