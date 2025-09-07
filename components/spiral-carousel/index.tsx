"use client"

import { useTexture, shaderMaterial } from "@react-three/drei"
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber"
import type { GUI as GUIType } from "dat.gui"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Suspense, useEffect, useRef, useState } from "react"
import Core from "smooothy"
import * as THREE from "three"

type SmooothyOptions = Partial<ConstructorParameters<typeof Core>[1]>

// Curved material to map a plane onto a cylindrical surface
const CurvedMaterial = shaderMaterial(
  {
    map: null,
    radius: 3,
    thetaStart: 0,
    thetaLength: Math.PI / 3,
    height: 1,
    barrelK: 0.0,
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
  `uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor = texture2D(map, vUv); }`
)

extend({ CurvedMaterial })

function useSmooothyProgress(slideCount: number, options: SmooothyOptions = {}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const coreRef = useRef<Core | null>(null)
  const progressRef = useRef(0)

  useEffect(() => {
    if (!wrapperRef.current) return
    const instance = new Core(wrapperRef.current, {
      infinite: true,
      snap: true,
      lerpFactor: 0.12,
      dragSensitivity: 1,
      scrollSensitivity: 1,
      ...options,
      onUpdate: (core) => {
        progressRef.current = core.progress
        options.onUpdate?.(core)
      },
    })

    coreRef.current = instance

    let rafId: number
    const loop = () => {
      instance.update()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      instance.destroy()
      coreRef.current = null
    }
  }, [slideCount, options])

  return {
    wrapperRef,
    coreRef,
    get progress() {
      return progressRef.current
    },
  }
}

function CylinderPreview({
  slideCount,
  getProgress,
  radius,
  gapPercent,
  heightScale,
  getScrollProgress,
  barrelK,
  barrelPower,
}: {
  slideCount: number
  getProgress: () => number
  radius: number
  gapPercent: number
  heightScale: number
  getScrollProgress?: () => number
  barrelK: number
  barrelPower: number
}) {
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!group.current) return
    const rotationPerSlide = (2 * Math.PI) / slideCount
    // Prefer ScrollTrigger progress if provided, else Smooothy's
    const sp = getScrollProgress ? getScrollProgress() : null
    const base = sp ?? getProgress() % 1
    const p = base % 1
    group.current.rotation.y = p * rotationPerSlide * slideCount
  })

  // Slides
  const images = ["/s-1.jpg", "/s-2.jpg", "/s-3.jpg"]
  const textures = useTexture(images)
  textures.forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    t.anisotropy = 8
  })

  const thetaLength = (2 * Math.PI) / images.length
  const gapAngle = thetaLength * (gapPercent / 100)
  const visibleTheta = thetaLength - gapAngle
  const arcLength = radius * visibleTheta
  const height = ((arcLength * 9) / 16) * heightScale

  return (
    <group ref={group}>
      {textures.map((tex, i) => (
        <mesh key={i}>
          <planeGeometry args={[1, 1, 128, 64]} />
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
          />
        </mesh>
      ))}
    </group>
  )
}

export function SpiralCarousel() {
  const slideCount = 6
  const { wrapperRef, progress, coreRef } = useSmooothyProgress(slideCount, { snap: false })
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const cylinderProgressRef = useRef<number>(0)

  type Params = {
    radius: number
    gapPercent: number
    heightScale: number
    camX: number
    camY: number
    camZ: number
    fov: number
  }
  const INITIAL_PARAMS = { radius: 3, gapPercent: 10, heightScale: 1, camX: 0, camY: 0, camZ: 10, fov: 45 } as Params
  const [params, setParams] = useState<Params>(INITIAL_PARAMS)
  const [barrel, setBarrel] = useState({ k: 0.2, power: 2.0 })

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

      const conf: Params = { radius: 3, gapPercent: 10, heightScale: 1, camX: 0, camY: 0, camZ: 10, fov: 45 }
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
      end: "+=3000",
      scrub: true,
      pin: true,
      onUpdate: (self) => {
        cylinderProgressRef.current = self.progress
        // Also push into smooothy if available
        const core = coreRef.current
        if (core) core.target = self.progress * (slideCount - 1)
      },
    })

    return () => {
      st.kill()
    }
  }, [coreRef, slideCount])

  return (
    <div ref={sectionRef} style={{ width: "100%", height: "100vh", position: "relative" }}>
      {/* Hidden but in-viewport DOM slider that drives Smooothy physics */}
      <div style={{ position: "absolute", left: 0, top: 0, opacity: 0, pointerEvents: "none" }}>
        <div ref={wrapperRef} style={{ display: "flex" }}>
          {Array.from({ length: slideCount }).map((_, i) => (
            <div key={i} style={{ width: 320, height: 200 }} />
          ))}
        </div>
      </div>

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
            slideCount={slideCount}
            getProgress={() => progress}
            radius={params.radius}
            gapPercent={params.gapPercent}
            heightScale={params.heightScale}
            getScrollProgress={() => cylinderProgressRef.current}
            barrelK={barrel.k}
            barrelPower={barrel.power}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default SpiralCarousel
