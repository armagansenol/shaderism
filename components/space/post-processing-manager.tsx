"use client"

import { Bloom } from "@react-three/postprocessing"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react"
import { useControls, button } from "leva"
import { CRTEffect, CRTPostEffect } from "./crt-post-effect"
import {
  PincushionChromaticAberrationEffect,
  PincushionChromaticAberrationPostEffect,
} from "./pincushion-chromatic-aberration-effect"

type EffectMode = "none" | "glitch" | "chromatic"

export interface PostProcessingManagerRef {
  fadeOutGlitch: (duration?: number) => void
  animateGlitchToClean: (duration?: number) => void
  setEffect: (effect: EffectMode) => void
  animateBarrelDistortionTransition: () => void
  fadeOutChromatic: (duration?: number) => void
  animateChromaticToClean: (duration?: number) => void
}

interface PostProcessingManagerProps {
  enableGUI?: boolean
  enableCRT?: boolean
  enableChromatic?: boolean
  enableBloom?: boolean
}

export const PostProcessingManager = forwardRef<PostProcessingManagerRef, PostProcessingManagerProps>(
  ({ enableGUI = true, enableCRT = true, enableChromatic = true, enableBloom = true }, ref) => {
    const glitchEffectRef = useRef<CRTEffect | null>(null)
    const chromaticEffectRef = useRef<PincushionChromaticAberrationEffect | null>(null)
    const barrelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [currentEffect, setCurrentEffect] = useState<EffectMode>("chromatic")

    // Leva controls for post-processing effects
    useControls(
      "Post-Processing Effects",
      {
        "Effect Mode": {
          value: currentEffect,
          options: ["none", ...(enableCRT ? ["glitch"] : []), ...(enableChromatic ? ["chromatic"] : [])],
          onChange: (value: EffectMode) => {
            setCurrentEffect(value)
            updateEffectIntensities(value)
          },
        },
        ...(enableCRT
          ? {
              "Reset to Glitch": button(() => {
                setCurrentEffect("glitch")
                updateEffectIntensities("glitch")
              }),
            }
          : {}),
        ...(enableChromatic
          ? {
              "Enable Chromatic": button(() => {
                setCurrentEffect("chromatic")
                updateEffectIntensities("chromatic")
              }),
            }
          : {}),
        "Disable All": button(() => {
          setCurrentEffect("none")
          updateEffectIntensities("none")
        }),
      },
      { collapsed: !enableGUI }
    )

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      fadeOutGlitch: (duration = 1.5) => {
        if (glitchEffectRef.current) {
          glitchEffectRef.current.fadeOutEffect(duration)
        }
      },
      animateGlitchToClean: (duration = 1.0) => {
        if (glitchEffectRef.current) {
          glitchEffectRef.current.animateParametersTo(
            {
              fadeOut: 0.0,
              barrelPower: 1.0,
              colorBleeding: 0.0,
              bleedingRangeX: 0.0,
              bleedingRangeY: 0.0,
              // Avoid division by zero in shader while fading out
              linesDistance: 1.0,
              scanlineAlpha: 0.0,
            },
            duration
          )
        }
      },
      animateBarrelDistortionTransition: () => {
        // First 2 seconds: smoothly increase barrel distortion to 4.0
        if (glitchEffectRef.current) {
          // Ensure effect is active and visible
          updateEffectIntensities("glitch")
          glitchEffectRef.current.fadeInEffect(0.2)
          glitchEffectRef.current.animateParametersTo({ barrelPower: 4.0 }, 2.0)
          // Last 1 second: smoothly return to 1.1
          if (barrelTimeoutRef.current) {
            clearTimeout(barrelTimeoutRef.current)
          }
          barrelTimeoutRef.current = setTimeout(() => {
            glitchEffectRef.current?.animateParametersTo({ barrelPower: 1.1 }, 1.0)
          }, 2000)
        }
      },
      setEffect: (effect: EffectMode) => {
        setCurrentEffect(effect)
        updateEffectIntensities(effect)
      },
      fadeOutChromatic: (duration = 1.5) => {
        if (chromaticEffectRef.current) {
          chromaticEffectRef.current.fadeOutEffect(duration)
        }
      },
      animateChromaticToClean: (duration = 1.0) => {
        if (chromaticEffectRef.current) {
          chromaticEffectRef.current.animateParametersTo(
            {
              intensity: 0.0,
            },
            duration
          )
        }
      },
    }))

    // Function to update effect intensities based on selection
    const updateEffectIntensities = useCallback(
      (effect: EffectMode) => {
        if (glitchEffectRef.current && enableCRT) {
          switch (effect) {
            case "none":
              glitchEffectRef.current.updateUniforms({ fadeOut: 0.0 })
              break
            case "glitch":
              glitchEffectRef.current.updateUniforms({ fadeOut: 1.0 })
              break
            case "chromatic":
              glitchEffectRef.current.updateUniforms({ fadeOut: 0.0 })
              break
          }
        }

        if (chromaticEffectRef.current && enableChromatic) {
          switch (effect) {
            case "none":
              chromaticEffectRef.current.updateUniforms({ intensity: 0.0 })
              break
            case "glitch":
              chromaticEffectRef.current.updateUniforms({ intensity: 0.0 })
              break
            case "chromatic":
              chromaticEffectRef.current.updateUniforms({ intensity: 0.3 })
              break
          }
        }
      },
      [enableCRT, enableChromatic]
    )

    // Initialize effect on mount
    useEffect(() => {
      updateEffectIntensities(currentEffect)
    }, [currentEffect, updateEffectIntensities])

    // Cleanup any outstanding timers on unmount
    useEffect(() => {
      return () => {
        if (barrelTimeoutRef.current) {
          clearTimeout(barrelTimeoutRef.current)
        }
      }
    }, [])

    return (
      <>
        {enableBloom && (
          <Bloom
            intensity={0.02}
            luminanceThreshold={0.05}
            luminanceSmoothing={0.02}
            mipmapBlur={true}
            kernelSize={30}
          />
        )}
        {enableCRT && (
          <CRTPostEffect
            ref={glitchEffectRef}
            barrelPower={1.1}
            colorBleeding={1.1}
            bleedingRangeX={3.0}
            bleedingRangeY={3.0}
            linesDistance={4.0}
            scanSize={2.0}
            scanlineAlpha={0.9}
            linesVelocity={30.0}
            pixelationGranularity={2}
          />
        )}
        {enableChromatic && (
          <PincushionChromaticAberrationPostEffect
            ref={chromaticEffectRef}
            intensity={0.4}
            distortionAmount={0.3}
            animationSpeed={1.0}
          />
        )}
      </>
    )
  }
)

PostProcessingManager.displayName = "PostProcessingManager"
