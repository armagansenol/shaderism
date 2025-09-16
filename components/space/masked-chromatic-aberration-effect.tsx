import { forwardRef, useEffect, useRef, useMemo } from "react"
import { Effect, EffectPass } from "postprocessing"
import { useThree } from "@react-three/fiber"
import { useControls, folder, button } from "leva"
import * as THREE from "three"

const fragmentShader = `
  uniform float time;
  uniform vec2 resolution;
  uniform float intensity;
  uniform float distortionAmount;
  uniform float animationSpeed;

  // Simple noise function for subtle grain
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  // Pincushion distortion function
  vec2 PincushionDistortion(in vec2 uv, float strength) {
    vec2 st = uv - 0.5;
    float uvA = atan(st.x, st.y);
    float uvD = dot(st, st);
    return 0.5 + vec2(sin(uvA), cos(uvA)) * sqrt(uvD) * (1.0 - strength * uvD);
  }

  // Chromatic aberration with pincushion distortion
  vec3 ChromaticAberration(sampler2D tex, in vec2 uv, float distortionStrength) {
    float rChannel = texture2D(tex, PincushionDistortion(uv, 0.3 * distortionStrength)).r;
    float gChannel = texture2D(tex, PincushionDistortion(uv, 0.15 * distortionStrength)).g;
    float bChannel = texture2D(tex, PincushionDistortion(uv, 0.075 * distortionStrength)).b;
    return vec3(rChannel, gChannel, bChannel);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (intensity <= 0.0) {
      outputColor = inputColor;
      return;
    }

    // Calculate animated distortion amount
    float animatedDistortion = (sin(time * animationSpeed) + 1.0) / 2.0;
    float finalDistortion = distortionAmount * intensity * animatedDistortion;

    // Apply chromatic aberration with pincushion distortion
    vec3 chromaticColor = ChromaticAberration(inputBuffer, uv, finalDistortion);
    
    // Add subtle noise/grain
    float noise = (random(uv * resolution + time) - 0.5) * 0.02 * intensity;
    
    // Output final color
    outputColor = vec4(chromaticColor + noise, inputColor.a);
  }
`

const PRESETS = {
  "Subtle Pincushion Chromatic": {
    intensity: 0.3,
    distortionAmount: 0.2,
    animationSpeed: 0.8,
  },
  "Strong Pincushion Chromatic": {
    intensity: 0.6,
    distortionAmount: 0.4,
    animationSpeed: 1.2,
  },
  "Dramatic Pincushion Chromatic": {
    intensity: 1.0,
    distortionAmount: 0.6,
    animationSpeed: 1.5,
  },
  Clean: {
    intensity: 0.0,
    distortionAmount: 0.0,
    animationSpeed: 0.8,
  },
}

class MaskedChromaticAberrationEffect extends Effect {
  constructor({ intensity = 0.3, distortionAmount = 0.2, animationSpeed = 0.8 } = {}) {
    super("MaskedChromaticAberrationEffect", fragmentShader, {
      // @ts-expect-error - postprocessing library requires flexible uniform types
      uniforms: new Map([
        ["time", new THREE.Uniform(0.0)],
        ["resolution", new THREE.Uniform(new THREE.Vector2(1920, 1080))],
        ["intensity", new THREE.Uniform(intensity)],
        ["distortionAmount", new THREE.Uniform(distortionAmount)],
        ["animationSpeed", new THREE.Uniform(animationSpeed)],
      ]),
    })
  }

  update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, deltaTime: number) {
    this.uniforms.get("time")!.value += deltaTime
    this.uniforms.get("resolution")!.value.set(inputBuffer.width, inputBuffer.height)
  }

  // Method to update uniform values
  updateUniforms(params: Record<string, unknown>) {
    Object.entries(params).forEach(([key, value]) => {
      const uniform = this.uniforms.get(key)
      if (uniform) {
        if (key === "offset" && Array.isArray(value)) {
          uniform.value.set(value[0], value[1])
        } else {
          uniform.value = value
        }
      }
    })
  }

  // Method to smoothly fade out the effect
  fadeOutEffect(duration = 2.0) {
    const startTime = Date.now()
    const startValue = this.uniforms.get("intensity")!.value as number

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3) // Ease out cubic

      const currentValue = startValue * (1 - easedProgress)
      this.uniforms.get("intensity")!.value = currentValue

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  }

  // Method to fade in the effect
  fadeInEffect(duration = 2.0) {
    const startTime = Date.now()
    const startValue = this.uniforms.get("intensity")!.value as number

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = Math.pow(progress, 3) // Ease in cubic

      const currentValue = startValue + (1 - startValue) * easedProgress
      this.uniforms.get("intensity")!.value = currentValue

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  }

  // Method to animate specific parameters to target values
  animateParametersTo(targets: Record<string, number | number[]>, duration = 1.0) {
    const startTime = Date.now()
    const startValues: Record<string, number | number[]> = {}

    // Store starting values
    Object.keys(targets).forEach((key) => {
      const uniform = this.uniforms.get(key)
      if (uniform) {
        if (key === "offset" && Array.isArray(targets[key])) {
          startValues[key] = [uniform.value.x, uniform.value.y]
        } else {
          startValues[key] = uniform.value as number
        }
      }
    })

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3) // Ease out cubic

      // Update each parameter
      Object.entries(targets).forEach(([key, targetValue]) => {
        const uniform = this.uniforms.get(key)
        if (uniform && startValues[key] !== undefined) {
          if (key === "offset" && Array.isArray(targetValue) && Array.isArray(startValues[key])) {
            const startValue = startValues[key] as number[]
            const currentX = startValue[0] + (targetValue[0] - startValue[0]) * easedProgress
            const currentY = startValue[1] + (targetValue[1] - startValue[1]) * easedProgress
            uniform.value.set(currentX, currentY)
          } else {
            const startValue = startValues[key] as number
            const currentValue = startValue + ((targetValue as number) - startValue) * easedProgress
            uniform.value = currentValue
          }
        }
      })

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  }
}

interface MaskedChromaticAberrationParams {
  intensity?: number
  distortionAmount?: number
  animationSpeed?: number
}

const MaskedChromaticAberrationPostEffect = forwardRef<
  MaskedChromaticAberrationEffect,
  MaskedChromaticAberrationParams
>((props, ref) => {
  const effectRef = useRef<MaskedChromaticAberrationEffect>(null!)

  const { camera } = useThree()
  const effect = useMemo(() => new MaskedChromaticAberrationEffect(props), [props])

  // Set the ref to point to the effect instance
  useEffect(() => {
    if (ref && typeof ref === "object") {
      ref.current = effect
    }
    effectRef.current = effect
  }, [effect, ref])

  // Leva controls for Masked Chromatic Aberration
  useControls("Masked Chromatic Aberration", {
    "Global Intensity": {
      value: props.intensity ?? 0.3,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      onChange: (value: number) => {
        effectRef.current?.updateUniforms({ intensity: value })
      },
    },
    "Pincushion Distortion": folder({
      "Distortion Amount": {
        value: props.distortionAmount ?? 0.2,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ distortionAmount: value })
        },
      },
      "Animation Speed": {
        value: props.animationSpeed ?? 0.8,
        min: 0.0,
        max: 3.0,
        step: 0.01,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ animationSpeed: value })
        },
      },
    }),
    Presets: folder({
      "Subtle Pincushion Chromatic": button(() => {
        effectRef.current?.updateUniforms(PRESETS["Subtle Pincushion Chromatic"])
      }),
      "Strong Pincushion Chromatic": button(() => {
        effectRef.current?.updateUniforms(PRESETS["Strong Pincushion Chromatic"])
      }),
      "Dramatic Pincushion Chromatic": button(() => {
        effectRef.current?.updateUniforms(PRESETS["Dramatic Pincushion Chromatic"])
      }),
      Clean: button(() => {
        effectRef.current?.updateUniforms(PRESETS.Clean)
      }),
    }),
  })

  const effectPass = useMemo(() => new EffectPass(camera as unknown as THREE.Camera, effect), [camera, effect])

  return <primitive object={effectPass} attach='passes' />
})

MaskedChromaticAberrationPostEffect.displayName = "MaskedChromaticAberrationPostEffect"

export { MaskedChromaticAberrationPostEffect, MaskedChromaticAberrationEffect }
