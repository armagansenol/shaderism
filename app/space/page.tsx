"use client"

import { ModelBytemywork } from "@/components/bmw"
import { GridPlane } from "@/components/space/grid-plane"
import { Starfield } from "@/components/space/starfield"
// import { ModelBytemywork } from "@/components/bmw" // Commented out as it's not used in simplified version
import { AdaptiveDpr, PerspectiveCamera as DreiPerspectiveCamera, Stats } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { useLenis } from "lenis/react"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three" // Commented out as it might be unused

/* Easing function - can be kept if AnimatedCamera is restored later
function easeInOutExpo(x: number): number {
  if (x === 0) return 0
  if (x === 1) return 1
  if (x < 0.5) return Math.pow(2, 20 * x - 10) / 2
  return (2 - Math.pow(2, -20 * x + 10)) / 2
}
*/

/* --- AnimatedCamera Component (Currently Commented Out for Debugging Starfield) ---
function AnimatedCamera({
  startAnimation,
  onAnimationComplete,
  screenWidth,
}: {
  startAnimation: boolean
  onAnimationComplete: () => void
  screenWidth: number
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!)

  const CAMERA_X_POSITION = 0
  const CAMERA_Y_POSITION = 0 // Consistent Y height for the camera
  const ANIMATION_START_Z = 1030 // Current initial Z from user's context
  const ANIMATION_END_Z = 20 // Target Z, stopping in front of the origin

  const animationTIncrement = 0.006 // Controls animation speed

  const tProgressRef = useRef(0) // Animation progress 't' from 0 to 1
  const animationCompletedSignaledRef = useRef(false) // To signal completion only once
  const lookAtTarget = useRef(new THREE.Vector3(0, 0, 0)).current // Constant lookAt target

  // Determine FOV based on screen width
  const fov = screenWidth < 768 ? 45 : 75 // Example: 45 FOV for mobile, 75 for desktop

  useEffect(() => {
    if (cameraRef.current) {
      if (startAnimation) {
        cameraRef.current.position.set(CAMERA_X_POSITION, CAMERA_Y_POSITION, ANIMATION_START_Z)
        cameraRef.current.lookAt(lookAtTarget)
        tProgressRef.current = 0
        animationCompletedSignaledRef.current = false // Reset completion flag when animation (re)starts
      } else {
        // Initial state or if startAnimation becomes false
        cameraRef.current.position.set(CAMERA_X_POSITION, CAMERA_Y_POSITION, ANIMATION_START_Z)
        cameraRef.current.lookAt(lookAtTarget)
        tProgressRef.current = 0
        // Consider if animationCompletedSignaledRef should be true or false here based on desired reset behavior
        // For now, assuming if not startAnimation, it implies a reset or initial state where controls might not be active yet.
        // If controls could be active, this might need to be true.
        // Given current SpacePage logic, startAnimation only goes true once.
        animationCompletedSignaledRef.current = true
      }
    }
  }, [startAnimation, lookAtTarget])

  useFrame(() => {
    if (!cameraRef.current || !startAnimation || animationCompletedSignaledRef.current) {
      // Animation is not active, camera isn't ready, or it has already completed.
      return
    }

    // Increment progress
    tProgressRef.current += animationTIncrement

    if (tProgressRef.current >= 1.0) {
      // Reached or passed the end point of the animation
      tProgressRef.current = 1.0 // Clamp progress to exactly 1.0

      cameraRef.current.position.set(CAMERA_X_POSITION, CAMERA_Y_POSITION, ANIMATION_END_Z)
      cameraRef.current.lookAt(lookAtTarget)

      // Signal completion to the parent component and mark as completed internally
      // This ensures onAnimationComplete is called only once and further updates are stopped.
      onAnimationComplete()
      animationCompletedSignaledRef.current = true
    } else {
      // Animation is still in progress
      const easedT = easeInOutExpo(tProgressRef.current)
      const currentZ = ANIMATION_START_Z + (ANIMATION_END_Z - ANIMATION_START_Z) * easedT
      cameraRef.current.position.set(CAMERA_X_POSITION, CAMERA_Y_POSITION, currentZ)
      cameraRef.current.lookAt(lookAtTarget)
    }
  })

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={fov} near={0.1} far={600} />
}
*/

// Easing function
function easeInOutExpo(x: number): number {
  if (x === 0) return 0
  if (x === 1) return 1
  if (x < 0.5) return Math.pow(2, 20 * x - 10) / 2
  return (2 - Math.pow(2, -20 * x + 10)) / 2
}

// --- AnimatedCamera Component ---
function AnimatedCamera({
  startAnimation,
  onAnimationComplete,
  screenWidth,
}: {
  startAnimation: boolean
  onAnimationComplete: () => void
  screenWidth: number
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!) // This ref is for a THREE.PerspectiveCamera instance
  const CAMERA_X_POSITION = 0
  const CAMERA_Y_POSITION = 0
  const ANIMATION_START_Z = 1030
  const ANIMATION_END_Z = 20
  const animationTIncrement = 0.006
  const tProgressRef = useRef(0)
  const animationCompletedSignaledRef = useRef(false)
  const lookAtTarget = useRef(new THREE.Vector3(0, 0, 0)).current
  const fov = screenWidth < 768 ? 45 : 75

  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.fov = fov
      cameraRef.current.updateProjectionMatrix()

      if (startAnimation) {
        cameraRef.current.position.set(CAMERA_X_POSITION, CAMERA_Y_POSITION, ANIMATION_START_Z)
        cameraRef.current.lookAt(lookAtTarget)
        tProgressRef.current = 0
        animationCompletedSignaledRef.current = false
      } else {
        cameraRef.current.position.set(CAMERA_X_POSITION, CAMERA_Y_POSITION, ANIMATION_START_Z)
        cameraRef.current.lookAt(lookAtTarget)
        tProgressRef.current = 0
        animationCompletedSignaledRef.current = true
      }
    }
  }, [startAnimation, lookAtTarget, fov])

  useFrame(() => {
    if (!cameraRef.current || !startAnimation || animationCompletedSignaledRef.current) return
    tProgressRef.current += animationTIncrement
    if (tProgressRef.current >= 1.0) {
      tProgressRef.current = 1.0
      cameraRef.current.position.set(CAMERA_X_POSITION, CAMERA_Y_POSITION, ANIMATION_END_Z)
      cameraRef.current.lookAt(lookAtTarget)
      onAnimationComplete()
      animationCompletedSignaledRef.current = true
    } else {
      const easedT = easeInOutExpo(tProgressRef.current)
      const currentZ = ANIMATION_START_Z + (ANIMATION_END_Z - ANIMATION_START_Z) * easedT
      cameraRef.current.position.set(CAMERA_X_POSITION, CAMERA_Y_POSITION, currentZ)
      cameraRef.current.lookAt(lookAtTarget)
    }
  })
  // Use DreiPerspectiveCamera here for makeDefault and R3F integration
  return <DreiPerspectiveCamera ref={cameraRef} makeDefault fov={fov} near={0.1} far={2000} />
}

export default function SpacePage() {
  const lenis = useLenis()

  const [screenWidth, setScreenWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 0)
  const [startIntroAnimation, setStartIntroAnimation] = useState(false)
  const [introAnimationComplete, setIntroAnimationComplete] = useState(false)
  // const [showButton, setShowButton] = useState(true) // Replaced by derived state below

  useEffect(() => {
    const updateScreenSize = () => {
      const currentScreenWidth = window.innerWidth
      setScreenWidth(currentScreenWidth)
    }
    window.addEventListener("resize", updateScreenSize)
    updateScreenSize()
    return () => window.removeEventListener("resize", updateScreenSize)
  }, [])

  useEffect(() => {
    if (lenis) {
      if (!introAnimationComplete) {
        lenis.stop()
      } else {
        lenis.start()
      }
    }
    return () => {
      if (lenis) {
        lenis.start()
      }
    }
  }, [introAnimationComplete, lenis])

  const handleEnterClick = () => {
    // setShowButton(false) // No longer needed due to derived showButton state
    setStartIntroAnimation(true)
    setIntroAnimationComplete(false)
  }

  const handleIntroAnimationComplete = () => {
    console.log("Intro animation completed.")
    setIntroAnimationComplete(true)
  }

  const showButton = !startIntroAnimation && !introAnimationComplete

  return (
    <>
      <div className="h-screen w-screen bg-black relative">
        {showButton && (
          <button
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-sm border-none rounded-md bg-transparent cursor-pointer z-10"
            onClick={handleEnterClick}
          >
            ENTER
          </button>
        )}
        <Canvas className="absolute top-0 left-0">
          <AnimatedCamera
            startAnimation={startIntroAnimation}
            onAnimationComplete={handleIntroAnimationComplete}
            screenWidth={screenWidth}
          />
          {/* <OrbitControls />  You might want to enable OrbitControls after animation, e.g., based on introAnimationComplete state */}

          <color attach="background" args={["black"]} />
          <ambientLight intensity={2} />

          {/* Starfield is now inside EffectComposer */}
          <EffectComposer>
            <Starfield />
            <GridPlane />
            <ModelBytemywork color="#fff" scale={1} />
            <Bloom
              intensity={0.4}
              luminanceThreshold={0.05}
              luminanceSmoothing={0.2}
              mipmapBlur={true}
              kernelSize={3}
            />
          </EffectComposer>
          <Stats />
          <AdaptiveDpr pixelated />
        </Canvas>
      </div>
      <div className="h-screen w-screen bg-black">SECTION 1</div>
      <div className="h-screen w-screen bg-black">SECTION 2</div>
      <div className="h-screen w-screen bg-black">SECTION 3</div>
      <div className="h-screen w-screen bg-black">FOOTER</div>
    </>
  )
}
