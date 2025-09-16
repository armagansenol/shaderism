"use client"

import { useGSAP } from "@gsap/react"
import { AdaptiveDpr, Html, shaderMaterial, Stats, useTexture } from "@react-three/drei"
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber"
import cn from "clsx"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { folder, useControls } from "leva"
import { ArrowRightCircle } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { Suspense, useEffect, useRef, useState } from "react"
import * as THREE from "three"

const ITEMS = [
  {
    title: "FERE CATALOG",
    description: "Description",
    image: "/carousel/1.jpg",
    link: "/works/fere-catalog",
  },
  {
    title: "MUNCH OWRA",
    description: "Description",
    image: "/carousel/2.jpg",
    link: "/works/munch-owra",
  },
  {
    title: "CINEMACHINE.ORG",
    description: "Description",
    image: "/carousel/3.jpg",
    link: "/works/cinemachine",
  },
  {
    title: "SILVER SHARK CARS",
    description: "Description",
    image: "/carousel/4.jpg",
    link: "/works/silver-shark-cars",
  },
  {
    title: "PERTH",
    description: "Description",
    image: "/carousel/5.jpg",
    link: "/works/perth",
  },
  {
    title: "ARKY MULTIMEDIA",
    description: "Description",
    image: "/carousel/6.jpg",
    link: "/works/arky-multimedia",
  },
  {
    title: "MATEA",
    description: "Description",
    image: "/carousel/7.jpg",
    link: "/works/matea",
  },
]

const INITIAL_PARAMS = {
  radius: 3,
  gapPercent: 10,
  heightScale: 1,
  camX: 0,
  camY: 0,
  camZ: 2,
  fov: 30,
  rotXDeg: -150,
  rotYDeg: 0,
  rotZDeg: -90,
  posX: 0,
  posY: 0,
  posZ: 0,
}

const CurvedMaterial = shaderMaterial(
  {
    map: null,
    radius: 3,
    thetaStart: 0,
    thetaLength: Math.PI / 3,
    height: 1,
    barrelK: 0.02,
    barrelPower: 2.0,
    textureRotation: 0.0,
  },
  // vertex
  `varying vec2 vUv;
   uniform float radius;
   uniform float thetaStart;
   uniform float thetaLength;
   uniform float height;
   uniform float barrelK;
   uniform float barrelPower;
   uniform float textureRotation;
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
  `uniform sampler2D map; 
   uniform float textureRotation;
   varying vec2 vUv; 
   void main(){ 
     vec2 uv = vec2(vUv.y, 1.0 - vUv.x);
     
     // Apply rotation around center (0.5, 0.5)
     vec2 center = vec2(0.5, 0.5);
     vec2 rotatedUv = uv - center;
     float cosA = cos(textureRotation);
     float sinA = sin(textureRotation);
     rotatedUv = vec2(
       rotatedUv.x * cosA - rotatedUv.y * sinA,
       rotatedUv.x * sinA + rotatedUv.y * cosA
     );
     rotatedUv += center;
     
     gl_FragColor = texture2D(map, rotatedUv); 
   }`
)

const CurvedWireframeMaterial = shaderMaterial(
  {
    radius: 3,
    thetaStart: 0,
    thetaLength: Math.PI / 3,
    height: 1,
    barrelK: 0.02,
    barrelPower: 2.0,
    wireframeColor: new THREE.Color(1, 1, 1),
    wireframeOpacity: 0.3,
  },
  // vertex - same transformation as curved material
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
  // fragment - solid color for wireframe
  `uniform vec3 wireframeColor;
   uniform float wireframeOpacity;
   void main(){ 
     gl_FragColor = vec4(wireframeColor, wireframeOpacity); 
   }`
)

extend({ CurvedMaterial, CurvedWireframeMaterial })

function useSlideTracking(slideCount: number, getProgress: () => number, triggerOffsetMultiplier: number = -0.25) {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const updateSlide = () => {
      const progress = getProgress()

      // Calculate current rotation (same as in CylinderPreview)
      const maxRotation = ((slideCount - 1) / slideCount) * Math.PI * 2
      const currentRotation = progress * maxRotation

      // Calculate the angular size of each slide
      const thetaLength = (2 * Math.PI) / slideCount

      // Calculate trigger points for each slide
      // Trigger when the top edge of each plane reaches the center of the screen
      // This is approximately when each plane has rotated to face the camera
      const triggerOffsets: number[] = []
      for (let i = 0; i < slideCount; i++) {
        // Each slide's center rotation point
        const slideBaseRotation = i * thetaLength
        // Offset to trigger when top edge is at desired position
        // Negative offset because we want to trigger slightly before the center
        const triggerOffset = thetaLength * triggerOffsetMultiplier // Configurable trigger position
        triggerOffsets.push(slideBaseRotation + triggerOffset)
      }

      // Find which trigger point we've passed most recently
      let newSlide = 0
      for (let i = 0; i < slideCount; i++) {
        const triggerRotation = triggerOffsets[i]
        // Normalize rotation to handle wrap-around
        const normalizedTrigger = ((triggerRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const normalizedCurrent = ((currentRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

        if (normalizedCurrent >= normalizedTrigger) {
          newSlide = i
        }
      }

      setCurrentSlide(Math.min(newSlide, slideCount - 1))
    }

    const interval = setInterval(updateSlide, 16) // ~60fps
    return () => clearInterval(interval)
  }, [slideCount, getProgress, triggerOffsetMultiplier])

  return currentSlide
}

// interface MouseTrackingSphereProps {
//   isActive?: boolean
// }

// function MouseTrackingSphere({ isActive }: MouseTrackingSphereProps) {
//   const meshRef = useRef<THREE.Mesh>(null)
//   const { pointer } = useThree()
//   const targetPosition = useRef(new THREE.Vector3())
//   const currentPosition = useRef(new THREE.Vector3())

//   // Create transition for the sphere appearance
//   const transition = useTransition(isActive, {
//     from: { scale: [0, 0, 0], opacity: 0 },
//     enter: { scale: [1, 1, 1], opacity: 1 },
//     leave: { scale: [0, 0, 0], opacity: 0 },
//     config: { mass: 5, tension: 1000, friction: 100 },
//     trail: 100,
//   })

//   useFrame((state, delta) => {
//     if (!meshRef.current) return

//     // Calculate target position based on mouse cursor
//     targetPosition.current.set(pointer.x, pointer.y, 0)

//     // Smooth interpolation for position
//     currentPosition.current.lerp(targetPosition.current, delta * 8)
//     meshRef.current.position.copy(currentPosition.current)
//   })

//   const textRef = useRef<THREE.Mesh>(null)
//   useFrame((state) => {
//     if (textRef.current) {
//       const time = state.clock.elapsedTime
//       const radius = 0.15
//       textRef.current.position.x = Math.cos(time) * radius
//     }
//   })

//   return transition((styles, item) =>
//     item ? (
//       <animated.mesh ref={meshRef} scale={styles.scale as unknown as [number, number, number]}>
//         <sphereGeometry args={[0.05, 32, 32]} />
//         <animated.meshStandardMaterial
//           color='#0066ff'
//           emissive='#0033aa'
//           emissiveIntensity={0}
//           metalness={0}
//           roughness={1}
//           transparent
//           opacity={styles.opacity}
//         >
//           <RenderTexture attach='map' anisotropy={16}>
//             <color attach='background' args={["#fff"]} />
//             <Text font={"./fonts/alexandria/Alexandria-Black.ttf"} ref={textRef} fontSize={0.2} color='#fff'>
//               GO TO PROJECT
//             </Text>
//           </RenderTexture>
//         </animated.meshStandardMaterial>
//       </animated.mesh>
//     ) : null
//   )
// }

function CameraController({ camX, camY, camZ, fov }: { camX: number; camY: number; camZ: number; fov: number }) {
  const { camera, pointer } = useThree()
  const vec = new THREE.Vector3()
  const smoothPointer = useRef({ x: 0, y: 0 })

  useFrame(() => {
    // Use smoothed pointer values to prevent jitter from HTML interactions
    smoothPointer.current.x += (pointer.x - smoothPointer.current.x) * 0.05
    smoothPointer.current.y += (pointer.y - smoothPointer.current.y) * 0.05

    // Apply mouse parallax effect on top of base camera position
    const mouseX = smoothPointer.current.x * 0.05
    const mouseY = smoothPointer.current.y * 0.05
    camera.position.lerp(vec.set(camX + mouseX, camY + mouseY, camZ), 1.9)

    const persp = camera as THREE.PerspectiveCamera
    persp.fov = fov
    persp.updateProjectionMatrix()
  })

  return null
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
  wireframeEnabled,
  wireframeColor,
  wireframeOpacity,
}: // setIsSphereActive,
{
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
  wireframeEnabled: boolean
  wireframeColor: string
  wireframeOpacity: number
  setIsSphereActive?: (isActive: boolean) => void
}) {
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!group.current) return
    const scrollProgress = getScrollProgress()

    // Apply position
    group.current.position.set(posX, posY, posZ)

    // Reset rotation matrix
    group.current.rotation.set(0, 0, 0)

    // Apply scroll-based rotation around X-axis directly
    // Calculate max rotation to stop on last item: (n-1)/n * 2π
    const maxRotation = ((ITEMS.length - 1) / ITEMS.length) * Math.PI * 2
    group.current.rotation.x = scrollProgress * maxRotation

    // Then apply the user-defined rotations in the correct order
    // This ensures the rotation axis is properly transformed
    group.current.rotateX(rotX)
    group.current.rotateY(rotY)
    group.current.rotateZ(rotZ)
  })

  // Slides
  const textures = useTexture(ITEMS.map((item) => item.image))
  textures.forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    t.anisotropy = 80
    t.flipY = false
  })

  const textureRotation = (180 * Math.PI) / 180 // Convert 120 degrees to radians

  const thetaLength = (2 * Math.PI) / ITEMS.length
  const gapAngle = thetaLength * (gapPercent / 100)
  const visibleTheta = thetaLength - gapAngle
  const arcLength = radius * visibleTheta
  const height = ((arcLength * 2160) / 2700) * heightScale

  return (
    <group ref={group}>
      {textures.map((tex, i) => (
        <group
          key={i}

          // onPointerOver={() => setIsSphereActive(true)}
          // onPointerOut={() => setIsSphereActive(false)}
        >
          <mesh>
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
              textureRotation={textureRotation}
              side={THREE.DoubleSide}
              transparent={false}
              toneMapped={false}
            />
          </mesh>
          {/* Curved wireframe border - follows the same curved geometry */}
          {wireframeEnabled && (
            <mesh>
              <planeGeometry args={[1, 1, 64, 128]} />
              {/* @ts-expect-error Drei shaderMaterial JSX type */}
              <curvedWireframeMaterial
                attach='material'
                radius={radius}
                thetaStart={i * thetaLength + gapAngle / 2}
                thetaLength={visibleTheta}
                height={height}
                barrelK={barrelK}
                barrelPower={barrelPower}
                wireframeColor={new THREE.Color(wireframeColor)}
                wireframeOpacity={wireframeOpacity}
                side={THREE.DoubleSide}
                transparent={true}
                wireframe={true}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

export function BarrelCarousel() {
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const cylinderProgressRef = useRef<number>(0)
  // const [isSphereActive, setIsSphereActive] = useState(true)

  // Leva controls
  const controls = useControls("Barrel Carousel", {
    geometry: folder({
      radius: { value: INITIAL_PARAMS.radius, min: 1, max: 8, step: 0.1 },
      "gap %": { value: INITIAL_PARAMS.gapPercent, min: 0, max: 50, step: 1 },
      "height scale": { value: INITIAL_PARAMS.heightScale, min: 0.5, max: 2, step: 0.01 },
    }),
    camera: folder({
      "cam x": { value: INITIAL_PARAMS.camX, min: -10, max: 10, step: 0.1 },
      "cam y": { value: INITIAL_PARAMS.camY, min: -10, max: 10, step: 0.1 },
      "cam z": { value: INITIAL_PARAMS.camZ, min: 1, max: 30, step: 0.1 },
      fov: { value: INITIAL_PARAMS.fov, min: 20, max: 90, step: 1 },
    }),
    "rotation (deg)": folder({
      "rot x": { value: INITIAL_PARAMS.rotXDeg, min: -180, max: 180, step: 1 },
      "rot y": { value: INITIAL_PARAMS.rotYDeg, min: -180, max: 180, step: 1 },
      "rot z": { value: INITIAL_PARAMS.rotZDeg, min: -180, max: 180, step: 1 },
    }),
    position: folder({
      "pos x": { value: INITIAL_PARAMS.posX, min: -10, max: 10, step: 0.1 },
      "pos y": { value: INITIAL_PARAMS.posY, min: -10, max: 10, step: 0.1 },
      "pos z": { value: INITIAL_PARAMS.posZ, min: -10, max: 10, step: 0.1 },
    }),
    barrel: folder({
      amount: { value: 0.02, min: -0.6, max: 1.0, step: 0.01 },
      power: { value: 2.0, min: 1.0, max: 6.0, step: 0.1 },
    }),
    wireframe: folder({
      enabled: { value: false },
      color: { value: "#ffffff" },
      opacity: { value: 0.3, min: 0, max: 1, step: 0.01 },
      thickness: { value: 1.0, min: 0.1, max: 5.0, step: 0.1 },
    }),
    "slide triggers": folder({
      "trigger offset": { value: -0.45, min: -1, max: 1, step: 0.01 },
      "debug mode": { value: false },
    }),
  })

  const currentSlide = useSlideTracking(ITEMS.length, () => cylinderProgressRef.current, controls["trigger offset"])

  // Extract values from controls
  const params = {
    radius: controls.radius,
    gapPercent: controls["gap %"],
    heightScale: controls["height scale"],
    camX: controls["cam x"],
    camY: controls["cam y"],
    camZ: controls["cam z"],
    fov: controls.fov,
    rotXDeg: controls["rot x"],
    rotYDeg: controls["rot y"],
    rotZDeg: controls["rot z"],
    posX: controls["pos x"],
    posY: controls["pos y"],
    posZ: controls["pos z"],
  }

  const barrel = {
    k: controls.amount,
    power: controls.power,
  }

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.registerPlugin(ScrollTrigger)

    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "center center",
      end: `${(ITEMS.length - 1) * 1000}`,
      scrub: true,
      pin: true,
      onUpdate: (self) => {
        cylinderProgressRef.current = self.progress
      },
    })
  })

  return (
    <div
      ref={sectionRef}
      className={cn(
        "w-screen h-[120vh] relative",
        "before:w-full before:h-[200px] before:bg-gradient-to-b before:from-black before:to-black/0 before:z-50 before:absolute before:top-0 before:left-0 before:pointer-events-none",
        "after:w-full after:h-[200px] after:bg-gradient-to-t after:from-black after:to-black/0 after:z-50 after:absolute after:bottom-0 after:left-0 after:pointer-events-none"
      )}
    >
      <Canvas>
        <color attach='background' args={[0x000000]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <pointLight position={[0, 0, 5]} intensity={0.3} color='#ffffff' />
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
            wireframeEnabled={controls.enabled}
            wireframeColor={controls.color}
            wireframeOpacity={controls.opacity}
            // setIsSphereActive={setIsSphereActive}
          />
          {/* <MouseTrackingSphere isActive={isSphereActive} /> */}
        </Suspense>
        <AdaptiveDpr pixelated />
        <Stats />
        <CameraController camX={params.camX} camY={params.camY} camZ={params.camZ} fov={params.fov} />
        <Html fullscreen pointerEvents='auto'>
          <Link href={ITEMS[currentSlide].link} className='absolute top-4/12 left-48 z-50'>
            <AnimatePresence mode='wait'>
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className='flex flex-col gap-1  group'
              >
                <div className='text-white text-2xl font-bold group-hover:text-amber-200 transition-colors'>
                  {ITEMS[currentSlide].title}
                </div>
                <div className='text-white text-sm font-bold flex items-center gap-2 group-hover:text-amber-200 transition-colors'>
                  <span>GO TO PROJECT</span>
                  <ArrowRightCircle className='w-4 h-4' />
                </div>
                {/* <div className='text-white text-sm'>
                  {currentSlide + 1} / {ITEMS.length}
                </div> */}
              </motion.div>
            </AnimatePresence>
          </Link>
        </Html>
      </Canvas>
    </div>
  )
}
