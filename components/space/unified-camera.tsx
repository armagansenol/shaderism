"use client"

import { PerspectiveCamera as DreiPerspectiveCamera } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react"
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
  mobileBreakpoint?: number
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
      mobileBreakpoint = 768,
      near = 0.1,
      far = 2000,
      lookAtTarget = [0, 0, 0],
      initialPosition = [0, 0, 20],
      mouseEnabled = true,
      mouseLimitX = 2,
      mouseLimitY = 1,
      mouseSmoothing = 0.03,
      cameraLerpFactor = 0.1,
      mouseSensitivity = 0.2,
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

    const fov = useMemo(
      () => (screenWidth < mobileBreakpoint ? fovMobile : fovDesktop),
      [screenWidth, fovMobile, fovDesktop, mobileBreakpoint]
    )

    // Utility to apply current lookAt target
    const applyLookAt = () => {
      if (cameraRef.current) {
        cameraRef.current.lookAt(lookAtTargetRef.current)
      }
    }

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      startAnimation: (fromZ: number, toZ: number, duration = 1.0) => {
        if (cameraRef.current) {
          modeRef.current = "animating"
          animationProgressRef.current = 0
          animationStartZRef.current = fromZ
          animationEndZRef.current = toZ
          animationDurationRef.current = duration
          animationStartTimeRef.current = performance.now()

          // Set initial position for animation, preserving X and Y from initialPosition
          cameraRef.current.position.set(initialPosition[0], initialPosition[1], fromZ)
          applyLookAt()
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
        const clamped = Math.max(0, Math.min(1, smoothing))
        mouseSmoothingRef.current = clamped
      },

      setCameraLerpFactor: (factor: number) => {
        const clamped = Math.max(0, Math.min(1, factor))
        cameraLerpFactorRef.current = clamped
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
        applyLookAt()
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

    // Update camera projection when FOV changes (do not touch position)
    useEffect(() => {
      if (cameraRef.current) {
        cameraRef.current.fov = fov
        cameraRef.current.updateProjectionMatrix()
      }
    }, [fov])

    // Set initial position and targets on mount only to avoid resets during runtime
    useEffect(() => {
      if (cameraRef.current) {
        cameraRef.current.position.set(...initialPosition)
        basePositionRef.current.set(...initialPosition)
        targetPositionRef.current.set(...initialPosition)
        currentPositionRef.current.set(...initialPosition)
        applyLookAt()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Update lookAt target when prop changes
    useEffect(() => {
      lookAtTargetRef.current.set(...lookAtTarget)
      applyLookAt()
    }, [lookAtTarget])

    // Sync prop updates to refs
    useEffect(() => {
      mouseEnabledRef.current = mouseEnabled
      if (modeRef.current !== "animating") {
        modeRef.current = mouseEnabled ? "mouse" : "idle"
      }
    }, [mouseEnabled])

    useEffect(() => {
      mouseLimitsRef.current.x = mouseLimitX
      mouseLimitsRef.current.y = mouseLimitY
    }, [mouseLimitX, mouseLimitY])

    useEffect(() => {
      mouseSensitivityRef.current = mouseSensitivity
    }, [mouseSensitivity])

    useEffect(() => {
      mouseSmoothingRef.current = Math.max(0, Math.min(1, mouseSmoothing ?? 0))
    }, [mouseSmoothing])

    useEffect(() => {
      cameraLerpFactorRef.current = Math.max(0, Math.min(1, cameraLerpFactor ?? 0))
    }, [cameraLerpFactor])

    // Main update loop
    useFrame(() => {
      if (!cameraRef.current) return

      const mode = modeRef.current

      if (mode === "animating") {
        // Handle animation
        const elapsed = (performance.now() - animationStartTimeRef.current) / 1000
        const progress = Math.min(elapsed / animationDurationRef.current, 1.0)

        if (progress >= 1.0) {
          // Animation completed
          const finalZ = animationEndZRef.current
          cameraRef.current.position.set(initialPosition[0], initialPosition[1], finalZ)

          // Update lookAt target to match camera Y position to avoid downward rotation
          lookAtTargetRef.current.set(0, initialPosition[1], 0)
          applyLookAt()

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
          applyLookAt()
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
      applyLookAt()
    })

    return <DreiPerspectiveCamera ref={cameraRef} makeDefault fov={fov} near={near} far={far} />
  }
)

UnifiedCamera.displayName = "UnifiedCamera"
