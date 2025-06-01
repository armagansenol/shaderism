"use client"

import { PerspectiveCamera as DreiPerspectiveCamera } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import * as THREE from "three"

// Easing function
function easeInOutExpo(x: number): number {
  if (x === 0) return 0
  if (x === 1) return 1
  if (x < 0.5) return Math.pow(2, 20 * x - 10) / 2
  return (2 - Math.pow(2, -20 * x + 10)) / 2
}

type CameraMode = "mouse" | "animating" | "idle"

export interface UnifiedCameraRef {
  // Animation controls
  startAnimation: (fromZ: number, toZ: number, duration?: number) => void

  // Mouse rig controls
  setMouseEnabled: (enabled: boolean) => void
  setMouseLimits: (limitX: number, limitY: number) => void
  setMouseSensitivity: (sensitivity: number) => void
  setMouseSmoothing: (smoothing: number) => void
  setCameraLerpFactor: (factor: number) => void

  // General controls
  setPosition: (x: number, y: number, z: number) => void
  lookAt: (x: number, y: number, z: number) => void
  resetPosition: () => void
  getCurrentMode: () => CameraMode
}

interface UnifiedCameraProps {
  // Screen
  screenWidth: number

  // Camera settings
  fovMobile?: number
  fovDesktop?: number
  near?: number
  far?: number
  lookAtTarget?: [number, number, number]

  // Initial position
  initialPosition?: [number, number, number]

  // Mouse rig settings
  mouseEnabled?: boolean
  mouseLimitX?: number
  mouseLimitY?: number
  mouseSmoothing?: number
  cameraLerpFactor?: number
  mouseSensitivity?: number
  invertX?: boolean
  invertY?: boolean

  // Callbacks
  onAnimationComplete?: () => void
}

export const UnifiedCamera = forwardRef<UnifiedCameraRef, UnifiedCameraProps>(
  (
    {
      screenWidth,
      fovMobile = 45,
      fovDesktop = 75,
      near = 0.1,
      far = 2000,
      lookAtTarget = [0, 0, 0],
      initialPosition = [0, 0, 20],
      mouseEnabled = true,
      mouseLimitX = 8,
      mouseLimitY = 5,
      mouseSmoothing = 0.03,
      cameraLerpFactor = 0.1,
      mouseSensitivity = 1.2,
      invertX = false,
      invertY = false,
      onAnimationComplete,
    },
    ref
  ) => {
    const { pointer } = useThree()

    const cameraRef = useRef<THREE.PerspectiveCamera>(null!)
    const modeRef = useRef<CameraMode>("mouse")

    // Animation state
    const animationProgressRef = useRef(0)
    const animationStartZRef = useRef(0)
    const animationEndZRef = useRef(0)
    const animationDurationRef = useRef(1.0)
    const animationStartTimeRef = useRef(0)

    // Mouse rig state
    const mouseEnabledRef = useRef(mouseEnabled)
    const basePositionRef = useRef(new THREE.Vector3(...initialPosition))
    const targetPositionRef = useRef(new THREE.Vector3(...initialPosition))
    const currentPositionRef = useRef(new THREE.Vector3(...initialPosition))
    const smoothedMouseRef = useRef({ x: 0, y: 0 })
    const mouseLimitsRef = useRef({ x: mouseLimitX, y: mouseLimitY })
    const mouseSensitivityRef = useRef(mouseSensitivity)
    const mouseSmoothingRef = useRef(mouseSmoothing)
    const cameraLerpFactorRef = useRef(cameraLerpFactor)

    // Look at target
    const lookAtTargetRef = useRef(new THREE.Vector3(...lookAtTarget))

    const fov = screenWidth < 768 ? fovMobile : fovDesktop

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      startAnimation: (fromZ: number, toZ: number, duration = 1.0) => {
        if (cameraRef.current) {
          modeRef.current = "animating"
          animationProgressRef.current = 0
          animationStartZRef.current = fromZ
          animationEndZRef.current = toZ
          animationDurationRef.current = duration
          animationStartTimeRef.current = Date.now()

          // Set initial position for animation, preserving X and Y from initialPosition
          cameraRef.current.position.set(initialPosition[0], initialPosition[1], fromZ)
          cameraRef.current.lookAt(lookAtTargetRef.current)
        }
      },

      setMouseEnabled: (enabled: boolean) => {
        mouseEnabledRef.current = enabled
        if (enabled && modeRef.current !== "animating") {
          modeRef.current = "mouse"
        } else if (!enabled && modeRef.current === "mouse") {
          modeRef.current = "idle"
        }
      },

      setMouseLimits: (limitX: number, limitY: number) => {
        mouseLimitsRef.current.x = limitX
        mouseLimitsRef.current.y = limitY
      },

      setMouseSensitivity: (sensitivity: number) => {
        mouseSensitivityRef.current = sensitivity
      },

      setMouseSmoothing: (smoothing: number) => {
        mouseSmoothingRef.current = smoothing
      },

      setCameraLerpFactor: (factor: number) => {
        cameraLerpFactorRef.current = factor
      },

      setPosition: (x: number, y: number, z: number) => {
        if (cameraRef.current) {
          const position = new THREE.Vector3(x, y, z)
          cameraRef.current.position.copy(position)
          basePositionRef.current.copy(position)
          targetPositionRef.current.copy(position)
          currentPositionRef.current.copy(position)
        }
      },

      lookAt: (x: number, y: number, z: number) => {
        lookAtTargetRef.current.set(x, y, z)
        if (cameraRef.current) {
          cameraRef.current.lookAt(lookAtTargetRef.current)
        }
      },

      resetPosition: () => {
        if (cameraRef.current) {
          const currentPos = cameraRef.current.position.clone()
          basePositionRef.current.copy(currentPos)
          targetPositionRef.current.copy(currentPos)
          currentPositionRef.current.copy(currentPos)
          smoothedMouseRef.current = { x: 0, y: 0 }
        }
      },

      getCurrentMode: () => modeRef.current,
    }))

    // Initialize camera
    useEffect(() => {
      if (cameraRef.current) {
        cameraRef.current.fov = fov
        cameraRef.current.updateProjectionMatrix()
        cameraRef.current.position.set(...initialPosition)
        cameraRef.current.lookAt(lookAtTargetRef.current)
      }
    }, [fov, initialPosition])

    // Update lookAt target when prop changes
    useEffect(() => {
      lookAtTargetRef.current.set(...lookAtTarget)
      if (cameraRef.current) {
        cameraRef.current.lookAt(lookAtTargetRef.current)
      }
    }, [lookAtTarget])

    // Main update loop
    useFrame(() => {
      if (!cameraRef.current) return

      const mode = modeRef.current

      if (mode === "animating") {
        // Handle animation
        const elapsed = (Date.now() - animationStartTimeRef.current) / 1000
        const progress = Math.min(elapsed / animationDurationRef.current, 1.0)

        if (progress >= 1.0) {
          // Animation completed
          const finalZ = animationEndZRef.current
          cameraRef.current.position.set(initialPosition[0], initialPosition[1], finalZ)

          // Update lookAt target to match camera Y position to avoid downward rotation
          lookAtTargetRef.current.set(0, initialPosition[1], 0)
          cameraRef.current.lookAt(lookAtTargetRef.current)

          // Update base position for potential mouse control
          basePositionRef.current.set(initialPosition[0], initialPosition[1], finalZ)
          targetPositionRef.current.copy(basePositionRef.current)
          currentPositionRef.current.copy(basePositionRef.current)

          // Switch back to mouse or idle mode
          modeRef.current = mouseEnabledRef.current ? "mouse" : "idle"

          if (onAnimationComplete) {
            onAnimationComplete()
          }
        } else {
          // Animation in progress
          const easedProgress = easeInOutExpo(progress)
          const currentZ =
            animationStartZRef.current + (animationEndZRef.current - animationStartZRef.current) * easedProgress
          cameraRef.current.position.set(initialPosition[0], initialPosition[1], currentZ)

          // Update lookAt target to match camera Y position during animation
          lookAtTargetRef.current.set(0, initialPosition[1], 0)
          cameraRef.current.lookAt(lookAtTargetRef.current)
        }
      } else if (mode === "mouse" && mouseEnabledRef.current) {
        // Handle mouse movement
        const targetMouseX = (invertX ? -pointer.x : pointer.x) * mouseSensitivityRef.current
        const targetMouseY = (invertY ? -pointer.y : pointer.y) * mouseSensitivityRef.current

        // Smooth mouse input
        smoothedMouseRef.current.x += (targetMouseX - smoothedMouseRef.current.x) * mouseSmoothingRef.current * 2
        smoothedMouseRef.current.y += (targetMouseY - smoothedMouseRef.current.y) * mouseSmoothingRef.current * 2

        // Calculate target position
        const basePos = basePositionRef.current
        const limits = mouseLimitsRef.current

        targetPositionRef.current.set(
          basePos.x + smoothedMouseRef.current.x * limits.x,
          basePos.y + smoothedMouseRef.current.y * limits.y,
          basePos.z
        )

        // Smooth camera movement
        currentPositionRef.current.lerp(targetPositionRef.current, cameraLerpFactorRef.current)
        cameraRef.current.position.copy(currentPositionRef.current)
      }

      // Always maintain look at target
      cameraRef.current.lookAt(lookAtTargetRef.current)
    })

    return <DreiPerspectiveCamera ref={cameraRef} makeDefault fov={fov} near={near} far={far} />
  }
)

UnifiedCamera.displayName = "UnifiedCamera"
