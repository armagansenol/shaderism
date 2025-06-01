"use client"

import { LogoBytemywork } from "@/components/3d-models/logo-bytemywork"
import { UnifiedCamera, UnifiedCameraRef } from "@/components/space/unified-camera"
import { GridPlane } from "@/components/space/grid-plane"
import { MouseSphere } from "@/components/space/mouse"
import { PostProcessingManager, PostProcessingManagerRef } from "@/components/space/post-processing-manager"
import { Starfield } from "@/components/space/starfield"
import { AdaptiveDpr, Stats, Text, Float } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { EffectComposer } from "@react-three/postprocessing"
import { useLenis } from "lenis/react"
import { useEffect, useRef, useState } from "react"

export default function Page() {
  const lenis = useLenis()
  const postProcessingRef = useRef<PostProcessingManagerRef>(null)
  const cameraRef = useRef<UnifiedCameraRef>(null)

  const [screenWidth, setScreenWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 0)
  const [startIntroAnimation, setStartIntroAnimation] = useState(false)
  const [introAnimationComplete, setIntroAnimationComplete] = useState(false)

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
    // Trigger the glitch effect fade-out
    if (postProcessingRef.current) {
      postProcessingRef.current.fadeOutGlitch(1.5) // 1.5 second fade-out
    }

    // Start camera animation from current position to endZ
    if (cameraRef.current) {
      cameraRef.current.startAnimation(1500, 20, 3.0) // 3 second animation
    }

    setStartIntroAnimation(true)
    setIntroAnimationComplete(false)
  }

  const handleIntroAnimationComplete = () => {
    console.log("Intro animation completed.")

    // Animate CRT effects to completely clean (0 values)
    if (postProcessingRef.current) {
      console.log("Starting CRT parameter animation to remove effects")
      postProcessingRef.current.animateGlitchToClean(1.0) // 1 second duration
    } else {
      console.log("postProcessingRef.current is null!")
    }

    setIntroAnimationComplete(true)
  }

  const showButton = !startIntroAnimation && !introAnimationComplete

  return (
    <>
      <div className="h-screen w-screen bg-black relative">
        {showButton && (
          <button
            className="font-bold underline absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-sm border-none rounded-md bg-transparent cursor-pointer z-10"
            onClick={handleEnterClick}
          >
            START
          </button>
        )}
        <Canvas className="absolute top-0 left-0">
          <UnifiedCamera
            ref={cameraRef}
            screenWidth={screenWidth}
            initialPosition={[0, 0, 1500]}
            mouseEnabled={true}
            mouseLimitX={8}
            mouseLimitY={5}
            mouseSmoothing={0.03}
            mouseSensitivity={1.2}
            onAnimationComplete={handleIntroAnimationComplete}
          />
          <color attach="background" args={["black"]} />
          <ambientLight intensity={2} />
          <EffectComposer>
            <LogoBytemywork color="#fff" scale={10} position={[0, 150, 1100]} />
            <Text color="white" position={[350, 80, 1000]} fontSize={16} fontWeight={400}>
              WEB DESIGN & DEV AGENCY
            </Text>
            <Text color="white" position={[0, -300, 1000]} fontSize={16} fontWeight={400}>
              WE ARE ABOUT DIGITAL EXPERIENCE & DESIGN
            </Text>
            <MouseSphere />
            <Starfield />
            <GridPlane />
            <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1.8}>
              <Text color="white" scale={0.025} position={[0, -5, 0]} fontSize={100} fontWeight={700}>
                BRANDING
              </Text>
            </Float>
            <Float speed={1.2} rotationIntensity={0.5} floatIntensity={2.0}>
              <Text color="white" scale={0.025} position={[0, 0, 0]} fontSize={100} fontWeight={700}>
                WEB DESIGN
              </Text>
            </Float>
            <Float speed={1.8} rotationIntensity={0.5} floatIntensity={1.6}>
              <Text color="white" scale={0.025} position={[0, 5, 0]} fontSize={100} fontWeight={700}>
                WEB DEVELOPMENT
              </Text>
            </Float>
            <PostProcessingManager ref={postProcessingRef} enableGUI={true} />
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
