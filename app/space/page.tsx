"use client"

import { ModelBytemywork } from "@/components/bmw"
import { GridPlane } from "@/components/space/grid-plane"
import { Starfield } from "@/components/space/starfield"
import { OrbitControls, PerspectiveCamera, /*PerspectiveCamera,*/ Stats } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

// Added easeInOutExpo function
function easeInOutExpo(x: number): number {
  if (x === 0) return 0
  if (x === 1) return 1
  if (x < 0.5) return Math.pow(2, 20 * x - 10) / 2
  return (2 - Math.pow(2, -20 * x + 10)) / 2
}

// Modified AnimatedCamera to include onAnimationComplete callback
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

export default function SpacePage() {
  // Renamed state for clarity and added animation completion state
  const [startIntroAnimation, setStartIntroAnimation] = useState(false)
  const [introAnimationComplete, setIntroAnimationComplete] = useState(false)
  const [screenWidth, setScreenWidth] = useState(0) // Added screenWidth state

  // Calculate model scale based on screen width
  const modelScale = screenWidth < 768 ? 0.175 : 1 // Example: smaller scale for mobile

  useEffect(() => {
    // Set initial screen width and add resize listener
    if (typeof window !== "undefined") {
      setScreenWidth(window.innerWidth)
      const handleResize = () => setScreenWidth(window.innerWidth)
      window.addEventListener("resize", handleResize)
      return () => window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Effect to handle page scroll lock during intro animation
  useEffect(() => {
    if (!introAnimationComplete) {
      // Animation has not completed (this covers initial state and during animation)
      document.body.style.overflow = "hidden"
    } else {
      // Animation has completed, unlock scroll
      document.body.style.overflow = "auto"
    }

    // Cleanup function to ensure scrolling is restored if component unmounts
    return () => {
      document.body.style.overflow = "auto"
    }
  }, [introAnimationComplete]) // Depend only on introAnimationComplete

  const handleEnterClick = () => {
    setStartIntroAnimation(true)
    setIntroAnimationComplete(false) // Reset completion state if animation is re-triggered
  }

  const handleIntroAnimationComplete = () => {
    setIntroAnimationComplete(true)
  }

  // Button is shown if the intro animation hasn't been started yet
  const showButton = !startIntroAnimation

  return (
    <>
      <div style={{ height: "100vh", width: "100vw", backgroundColor: "black", position: "relative" }}>
        {showButton && (
          <button
            onClick={handleEnterClick}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "16px",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              backgroundColor: "transparent",
              cursor: "pointer",
              zIndex: 10, // Ensure button is on top of the canvas
            }}
          >
            ENTER
          </button>
        )}
        <Canvas style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}>
          <AnimatedCamera
            startAnimation={startIntroAnimation}
            onAnimationComplete={handleIntroAnimationComplete}
            screenWidth={screenWidth} // Pass screenWidth to AnimatedCamera
          />
          {/* <OrthographicCamera makeDefault position={[0, 0, -50]} zoom={3} near={0.1} far={600} /> */}
          {/* <PerspectiveCamera makeDefault position={[0, 0, -50]} zoom={3} near={0.1} far={600} /> */}
          <color attach="background" args={["black"]} />
          <ambientLight intensity={2} />
          <EffectComposer>
            <Starfield />
            <GridPlane />
            <ModelBytemywork color="#fff" scale={modelScale} />
            <Bloom
              intensity={0.4}
              luminanceThreshold={0.05}
              luminanceSmoothing={0.2}
              mipmapBlur={true}
              kernelSize={3}
            />
          </EffectComposer>
          {/* OrbitControls are disabled to allow page scrolling after intro animation */}
          <OrbitControls enableZoom={true} enablePan={true} enabled={false} />
          <Stats />
        </Canvas>
      </div>
      <div
        style={{
          height: "100vh",
          width: "100vw",
          backgroundColor: "black",
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div>SECTION 1</div>
      </div>
      <div
        style={{
          height: "100vh",
          width: "100vw",
          backgroundColor: "black",
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div>SECTION 2</div>
      </div>
      <div
        style={{
          height: "100vh",
          width: "100vw",
          backgroundColor: "black",
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div>FOOTER</div>
      </div>
    </>
  )
}
