"use client"

import { Bloom } from "@react-three/postprocessing"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { GlitchEffect, GlitchPostEffect } from "./glitch-post-effect"

export interface PostProcessingManagerRef {
  fadeOutGlitch: (duration?: number) => void
  animateGlitchToClean: (duration?: number) => void
  setEffect: (effect: string) => void
}

interface PostProcessingManagerProps {
  enableGUI?: boolean
}

export const PostProcessingManager = forwardRef<PostProcessingManagerRef, PostProcessingManagerProps>(
  ({ enableGUI = true }, ref) => {
    const glitchEffectRef = useRef<GlitchEffect | null>(null)
    const guiRef = useRef<unknown>(null)
    const [currentEffect, setCurrentEffect] = useState("glitch") // "none", "glitch"

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
              linesDistance: 0.0,
            },
            duration
          )
        }
      },
      setEffect: (effect: string) => {
        setCurrentEffect(effect)
        updateEffectIntensities(effect)
      },
    }))

    // Function to update effect intensities based on selection
    const updateEffectIntensities = (effect: string) => {
      if (glitchEffectRef.current) {
        switch (effect) {
          case "none":
            glitchEffectRef.current.updateUniforms({ fadeOut: 0.0 })
            break
          case "glitch":
            glitchEffectRef.current.updateUniforms({ fadeOut: 1.0 })
            break
        }
      }
    }

    // Post-processing effects controller with dat.gui
    useEffect(() => {
      if (!enableGUI || typeof window === "undefined") return

      import("dat.gui")
        .then((dat) => {
          if (guiRef.current) {
            // Destroy existing GUI
            if (
              guiRef.current &&
              typeof guiRef.current === "object" &&
              guiRef.current !== null &&
              "destroy" in guiRef.current
            ) {
              ;(guiRef.current as { destroy: () => void }).destroy()
            }
          }

          const GUI = dat.GUI
          const gui = new GUI()
          guiRef.current = gui

          const effectsFolder = gui.addFolder("Post-Processing Effects")

          const effectOptions = {
            "Effect Mode": currentEffect,
          }

          effectsFolder
            .add(effectOptions, "Effect Mode", ["none", "glitch"])
            .name("Active Effect")
            .onChange((value: string) => {
              setCurrentEffect(value)
              updateEffectIntensities(value)
            })

          // Quick presets
          const presets = {
            "Reset to Glitch": () => {
              setCurrentEffect("glitch")
              updateEffectIntensities("glitch")
            },
            "Disable All": () => {
              setCurrentEffect("none")
              updateEffectIntensities("none")
            },
          }

          const presetFolder = effectsFolder.addFolder("Quick Presets")
          Object.entries(presets).forEach(([name, func]) => {
            presetFolder.add({ [name]: func }, name)
          })
        })
        .catch((error) => {
          console.error("Failed to load dat.gui:", error)
        })

      // Cleanup function
      return () => {
        if (
          guiRef.current &&
          typeof guiRef.current === "object" &&
          guiRef.current !== null &&
          "destroy" in guiRef.current
        ) {
          ;(guiRef.current as { destroy: () => void }).destroy()
          guiRef.current = null
        }
      }
    }, [currentEffect, enableGUI])

    return (
      <>
        <Bloom intensity={0.02} luminanceThreshold={0.05} luminanceSmoothing={0.02} mipmapBlur={true} kernelSize={30} />
        <GlitchPostEffect
          ref={glitchEffectRef}
          barrelPower={1.1}
          colorBleeding={1.2}
          bleedingRangeX={3.0}
          bleedingRangeY={3.0}
          linesDistance={4.0}
          scanSize={2.0}
          scanlineAlpha={0.9}
          linesVelocity={30.0}
          pixelationGranularity={3}
        />
      </>
    )
  }
)

PostProcessingManager.displayName = "PostProcessingManager"
