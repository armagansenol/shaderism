import { forwardRef, useEffect, useRef, useMemo } from "react"
import { Effect, PixelationEffect, EffectPass } from "postprocessing"
import { useThree } from "@react-three/fiber"
import { useControls, folder, button } from "leva"
import * as THREE from "three"

const fragmentShader = `
  uniform float time;
  uniform vec2 resolution;
  uniform float fadeOut;
  
  // Curvature
  uniform float barrelPower;
  // Motion-driven curvature
  uniform float motionVelocity;      // computed on CPU from camera speed (units/sec)
  uniform float velocityBarrelGain;  // how much velocity adds to barrel
  uniform float velocityBarrelMax;   // clamp for effective barrel power
  // Color bleeding
  uniform float colorBleeding;
  uniform float bleedingRangeX;
  uniform float bleedingRangeY;
  // Scanline
  uniform float linesDistance;
  uniform float scanSize;
  uniform float scanlineAlpha;
  uniform float linesVelocity;
  // Noise overlay
  uniform float noiseIntensity;
  uniform float noiseScale;
  uniform float noiseSpeed;

  // Simple noise function for grain effect
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  vec2 distort(vec2 p) {
    float angle = p.y / p.x;
    float theta = atan(p.y, p.x);
    // Compute motion-influenced barrel power
    float motionContribution = clamp(motionVelocity * velocityBarrelGain, 0.0, max(0.0, velocityBarrelMax - barrelPower));
    float effectiveBarrel = clamp(barrelPower + motionContribution, 0.0, velocityBarrelMax);

    float radius = pow(length(p), effectiveBarrel);

    p.x = radius * cos(theta);
    p.y = radius * sin(theta);

    return 0.5 * (p + vec2(1.0, 1.0));
  }

  void getColorBleeding(inout vec4 currentColor, inout vec4 colorLeft) {
    currentColor = currentColor * vec4(colorBleeding, 0.5, 1.0 - colorBleeding, 1.0);
    colorLeft = colorLeft * vec4(1.0 - colorBleeding, 0.5, colorBleeding, 1.0);
  }

  void getColorScanline(vec2 uv, inout vec4 c, float currentTime) {
    float screenY = uv.y * resolution.y;
    float lineRow = floor(screenY / scanSize + currentTime * linesVelocity);
    float linePattern = mod(lineRow, linesDistance);
    float scanlineStrength = step(linePattern, linesDistance * 0.5);
    
    // Make scanlines more visible
    c.rgb = mix(c.rgb, c.rgb * scanlineAlpha, scanlineStrength);
    c.a = 1.0;
  }

  void applyNoiseOverlay(inout vec4 color, vec2 uv, float currentTime) {
    if (noiseIntensity <= 0.0) return;
    
    // Create animated noise coordinates
    vec2 noiseCoord = uv * noiseScale + vec2(currentTime * noiseSpeed, currentTime * noiseSpeed * 0.7);
    
    // Generate noise value
    float noise = random(noiseCoord);
    
    // Apply noise as overlay (film grain effect)
    float noiseValue = (noise - 0.5) * noiseIntensity;
    color.rgb += noiseValue;
    
    // Optional: Add some color tinting to the noise for more realistic effect
    color.r += noiseValue * 0.1;
    color.b += noiseValue * 0.05;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Apply global fade out
    float globalIntensity = fadeOut;
    
    if (globalIntensity <= 0.0) {
      outputColor = inputColor;
      return;
    }

    vec2 xy = uv * 2.0;
    xy.x -= 1.0;
    xy.y -= 1.0;

    float d = length(xy);
    if (d < 1.5) {
      xy = mix(uv, distort(xy), globalIntensity);
    } else {
      xy = uv;
    }

    float pixelSizeX = 1.0 / resolution.x * bleedingRangeX * globalIntensity;
    float pixelSizeY = 1.0 / resolution.y * bleedingRangeY * globalIntensity;
    
    vec4 colorLeft = texture2D(inputBuffer, xy - vec2(pixelSizeX, pixelSizeY));
    vec4 currentColor = texture2D(inputBuffer, xy);
    
    // Apply color bleeding with intensity control
    vec4 originalLeft = colorLeft;
    vec4 originalCurrent = currentColor;
    getColorBleeding(currentColor, colorLeft);
    
    // Mix between original and bleeding effect based on intensity
    colorLeft = mix(originalLeft, colorLeft, globalIntensity);
    currentColor = mix(originalCurrent, currentColor, globalIntensity);
    
    vec4 c = currentColor + colorLeft;
    
    // Apply scanlines with intensity control
    vec4 originalC = c;
    getColorScanline(xy, c, time);
    c = mix(originalC, c, globalIntensity);
    
    // Apply noise overlay (film grain/static)
    applyNoiseOverlay(c, xy, time);
    
    outputColor = c;
  }
`

const PRESETS = {
  "Classic CRT": {
    barrelPower: 1.1,
    colorBleeding: 1.2,
    bleedingRangeX: 3.0,
    bleedingRangeY: 3.0,
    linesDistance: 4.0,
    scanSize: 2.0,
    scanlineAlpha: 0.9,
    linesVelocity: 30.0,
    noiseIntensity: 0.15,
    noiseScale: 400.0,
    noiseSpeed: 1.0,
  },
  "Strong Scanlines": {
    barrelPower: 1.05,
    colorBleeding: 0.5,
    bleedingRangeX: 1.0,
    bleedingRangeY: 1.0,
    linesDistance: 3.0,
    scanSize: 1.0,
    scanlineAlpha: 0.3,
    linesVelocity: 50.0,
    noiseIntensity: 0.25,
    noiseScale: 600.0,
    noiseSpeed: 2.0,
  },
  "Subtle Monitor": {
    barrelPower: 1.05,
    colorBleeding: 0.8,
    bleedingRangeX: 1.5,
    bleedingRangeY: 1.5,
    linesDistance: 6.0,
    scanSize: 3.0,
    scanlineAlpha: 0.95,
    linesVelocity: 15.0,
    noiseIntensity: 0.05,
    noiseScale: 800.0,
    noiseSpeed: 0.5,
  },
  "Old TV": {
    barrelPower: 1.3,
    colorBleeding: 1.8,
    bleedingRangeX: 5.0,
    bleedingRangeY: 5.0,
    linesDistance: 3.0,
    scanSize: 1.5,
    scanlineAlpha: 0.8,
    linesVelocity: 50.0,
    noiseIntensity: 0.005,
    noiseScale: 10.0,
    noiseSpeed: 3.0,
  },
  Clean: {
    barrelPower: 1.02,
    colorBleeding: 0.5,
    bleedingRangeX: 1.0,
    bleedingRangeY: 1.0,
    linesDistance: 8.0,
    scanSize: 4.0,
    scanlineAlpha: 0.98,
    linesVelocity: 10.0,
    noiseIntensity: 0.0,
    noiseScale: 1000.0,
    noiseSpeed: 0.0,
  },
}

class CRTEffect extends Effect {
  private camera: THREE.Camera | null
  private prevCameraPosition: THREE.Vector3 | null
  private smoothedVelocity: number
  private velocitySmoothing: number
  constructor(
    {
      fadeOut = 1.0,
      barrelPower = PRESETS["Old TV"].barrelPower,
      colorBleeding = PRESETS["Old TV"].colorBleeding,
      bleedingRangeX = PRESETS["Old TV"].bleedingRangeX,
      bleedingRangeY = PRESETS["Old TV"].bleedingRangeY,
      linesDistance = PRESETS["Old TV"].linesDistance,
      scanSize = PRESETS["Old TV"].scanSize,
      scanlineAlpha = PRESETS["Old TV"].scanlineAlpha,
      linesVelocity = PRESETS["Old TV"].linesVelocity,
      noiseIntensity = PRESETS["Old TV"].noiseIntensity,
      noiseScale = PRESETS["Old TV"].noiseScale,
      noiseSpeed = PRESETS["Old TV"].noiseSpeed,
      velocityBarrelGain = 0.002,
      velocityBarrelMax = 5.0,
      velocitySmoothing = 0.15,
    } = {},
    camera?: THREE.Camera
  ) {
    super("CRTEffect", fragmentShader, {
      // @ts-expect-error - postprocessing library requires flexible uniform types
      uniforms: new Map([
        ["time", new THREE.Uniform(0.0)],
        ["resolution", new THREE.Uniform(new THREE.Vector2(1920, 1080))],
        ["fadeOut", new THREE.Uniform(fadeOut)],
        ["barrelPower", new THREE.Uniform(barrelPower)],
        // Motion uniforms
        ["motionVelocity", new THREE.Uniform(0.0)],
        ["velocityBarrelGain", new THREE.Uniform(velocityBarrelGain)],
        ["velocityBarrelMax", new THREE.Uniform(velocityBarrelMax)],
        ["colorBleeding", new THREE.Uniform(colorBleeding)],
        ["bleedingRangeX", new THREE.Uniform(bleedingRangeX)],
        ["bleedingRangeY", new THREE.Uniform(bleedingRangeY)],
        ["linesDistance", new THREE.Uniform(linesDistance)],
        ["scanSize", new THREE.Uniform(scanSize)],
        ["scanlineAlpha", new THREE.Uniform(scanlineAlpha)],
        ["linesVelocity", new THREE.Uniform(linesVelocity)],
        ["noiseIntensity", new THREE.Uniform(noiseIntensity)],
        ["noiseScale", new THREE.Uniform(noiseScale)],
        ["noiseSpeed", new THREE.Uniform(noiseSpeed)],
      ]),
    })
    this.camera = camera ?? null
    this.prevCameraPosition = this.camera ? this.camera.position.clone() : null
    this.smoothedVelocity = 0
    this.velocitySmoothing = Math.max(0, Math.min(1, velocitySmoothing))
  }

  update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, deltaTime: number) {
    this.uniforms.get("time")!.value += deltaTime
    this.uniforms.get("resolution")!.value.set(inputBuffer.width, inputBuffer.height)

    // Update motion velocity from camera movement (units/second)
    if (this.camera && this.prevCameraPosition) {
      const current = this.camera.position
      const distance = current.distanceTo(this.prevCameraPosition)
      const instantaneous = distance / Math.max(deltaTime, 1e-6)
      this.smoothedVelocity += (instantaneous - this.smoothedVelocity) * this.velocitySmoothing
      const uniform = this.uniforms.get("motionVelocity")
      if (uniform) uniform.value = this.smoothedVelocity
      this.prevCameraPosition.copy(current)
    }
  }

  // Method to update uniform values
  updateUniforms(params: Record<string, unknown>) {
    Object.entries(params).forEach(([key, value]) => {
      const uniform = this.uniforms.get(key)
      if (uniform) {
        uniform.value = value
      }
    })
  }

  // Method to smoothly fade out the effect
  fadeOutEffect(duration = 2.0) {
    const startTime = Date.now()
    const startValue = this.uniforms.get("fadeOut")!.value as number

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3) // Ease out cubic

      const currentValue = startValue * (1 - easedProgress)
      this.uniforms.get("fadeOut")!.value = currentValue

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  }

  // Method to fade in the effect
  fadeInEffect(duration = 2.0) {
    const startTime = Date.now()
    const startValue = this.uniforms.get("fadeOut")!.value as number

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = Math.pow(progress, 3) // Ease in cubic

      const currentValue = startValue + (1 - startValue) * easedProgress
      this.uniforms.get("fadeOut")!.value = currentValue

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  }

  // Method to animate specific parameters to target values
  animateParametersTo(targets: Record<string, number>, duration = 1.0) {
    console.log("animateParametersTo called with targets:", targets, "duration:", duration)
    const startTime = Date.now()
    const startValues: Record<string, number> = {}

    // Store starting values
    Object.keys(targets).forEach((key) => {
      const uniform = this.uniforms.get(key)
      if (uniform) {
        startValues[key] = uniform.value as number
        console.log(`Starting value for ${key}:`, startValues[key], "-> target:", targets[key])
      } else {
        console.log(`Uniform ${key} not found!`)
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
          const startValue = startValues[key]
          const currentValue = startValue + (targetValue - startValue) * easedProgress
          uniform.value = currentValue
        }
      })

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        console.log("Animation completed!")
      }
    }

    animate()
  }
}

interface CRTParams {
  fadeOut?: number
  barrelPower?: number
  colorBleeding?: number
  bleedingRangeX?: number
  bleedingRangeY?: number
  linesDistance?: number
  scanSize?: number
  scanlineAlpha?: number
  linesVelocity?: number
  noiseIntensity?: number
  noiseScale?: number
  noiseSpeed?: number
  pixelationGranularity?: number
  velocityBarrelGain?: number
  velocityBarrelMax?: number
  velocitySmoothing?: number
}

const CRTPostEffect = forwardRef<CRTEffect, CRTParams>((props, ref) => {
  const effectRef = useRef<CRTEffect>(null!)
  const pixelationRef = useRef<PixelationEffect>(null!)

  const { camera } = useThree()
  const effect = useMemo(() => new CRTEffect(props, camera as unknown as THREE.Camera), [props, camera])
  const pixelationEffect = useMemo(
    () => new PixelationEffect(props.pixelationGranularity ?? 5),
    [props.pixelationGranularity]
  )

  // Set the ref to point to the effect instance
  useEffect(() => {
    if (ref && typeof ref === "object") {
      ref.current = effect
    }
    effectRef.current = effect
    pixelationRef.current = pixelationEffect
  }, [effect, pixelationEffect, ref])

  // Leva controls for CRT effects
  useControls("CRT Monitor Effects", {
    "Screen Curvature": folder({
      "Barrel Distortion": {
        value: props.barrelPower ?? PRESETS["Old TV"].barrelPower,
        min: 1.0,
        max: 2.0,
        step: 0.01,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ barrelPower: value })
        },
      },
    }),
    "Color Bleeding": folder({
      "Bleeding Intensity": {
        value: props.colorBleeding ?? PRESETS["Old TV"].colorBleeding,
        min: 0.0,
        max: 2.0,
        step: 0.01,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ colorBleeding: value })
        },
      },
      "Horizontal Range": {
        value: props.bleedingRangeX ?? PRESETS["Old TV"].bleedingRangeX,
        min: 0.0,
        max: 10.0,
        step: 0.1,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ bleedingRangeX: value })
        },
      },
      "Vertical Range": {
        value: props.bleedingRangeY ?? PRESETS["Old TV"].bleedingRangeY,
        min: 0.0,
        max: 10.0,
        step: 0.1,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ bleedingRangeY: value })
        },
      },
    }),
    Scanlines: folder({
      "Line Distance": {
        value: props.linesDistance ?? PRESETS["Old TV"].linesDistance,
        min: 1.0,
        max: 20.0,
        step: 0.1,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ linesDistance: value })
        },
      },
      "Scan Size": {
        value: props.scanSize ?? PRESETS["Old TV"].scanSize,
        min: 0.5,
        max: 10.0,
        step: 0.1,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ scanSize: value })
        },
      },
      "Scanline Alpha": {
        value: props.scanlineAlpha ?? PRESETS["Old TV"].scanlineAlpha,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ scanlineAlpha: value })
        },
      },
      "Animation Speed": {
        value: props.linesVelocity ?? PRESETS["Old TV"].linesVelocity,
        min: 0.0,
        max: 100.0,
        step: 1.0,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ linesVelocity: value })
        },
      },
    }),
    "Noise Overlay": folder({
      "Grain Intensity": {
        value: props.noiseIntensity ?? PRESETS["Old TV"].noiseIntensity,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ noiseIntensity: value })
        },
      },
      "Grain Size": {
        value: props.noiseScale ?? PRESETS["Old TV"].noiseScale,
        min: 10.0,
        max: 1000.0,
        step: 10.0,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ noiseScale: value })
        },
      },
      "Noise Animation Speed": {
        value: props.noiseSpeed ?? PRESETS["Old TV"].noiseSpeed,
        min: 0.0,
        max: 5.0,
        step: 0.1,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ noiseSpeed: value })
        },
      },
    }),
    Pixelation: folder({
      "Pixel Size": {
        value: props.pixelationGranularity ?? 5,
        min: 1,
        max: 100,
        step: 1,
        onChange: (value: number) => {
          if (pixelationRef.current) {
            pixelationRef.current.granularity = value
          }
        },
      },
    }),
    "Motion Response": folder({
      "Barrel Gain": {
        value: props.velocityBarrelGain ?? 0.002,
        min: 0.0,
        max: 0.01,
        step: 0.0001,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ velocityBarrelGain: value })
        },
      },
      "Max Barrel": {
        value: props.velocityBarrelMax ?? 5.0,
        min: 1.0,
        max: 10.0,
        step: 0.01,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ velocityBarrelMax: value })
        },
      },
      "Velocity Smoothing": {
        value: props.velocitySmoothing ?? 0.15,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        onChange: (value: number) => {
          if (effectRef.current) {
            ;(effectRef.current as unknown as { velocitySmoothing: number }).velocitySmoothing = Math.max(
              0,
              Math.min(1, value)
            )
          }
        },
      },
    }),
    Global: folder({
      "Effect Intensity": {
        value: props.fadeOut ?? 1.0,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        onChange: (value: number) => {
          effectRef.current?.updateUniforms({ fadeOut: value })
        },
      },
    }),
    Presets: folder({
      "Classic CRT": button(() => {
        effectRef.current?.updateUniforms(PRESETS["Classic CRT"])
      }),
      "Strong Scanlines": button(() => {
        effectRef.current?.updateUniforms(PRESETS["Strong Scanlines"])
      }),
      "Subtle Monitor": button(() => {
        effectRef.current?.updateUniforms(PRESETS["Subtle Monitor"])
      }),
      "Old TV": button(() => {
        effectRef.current?.updateUniforms(PRESETS["Old TV"])
      }),
      Clean: button(() => {
        effectRef.current?.updateUniforms(PRESETS.Clean)
      }),
    }),
  })

  const effectPass = useMemo(
    () => new EffectPass(camera as unknown as THREE.Camera, effect, pixelationEffect),
    [camera, effect, pixelationEffect]
  )

  return <primitive object={effectPass} attach='passes' />
})

CRTPostEffect.displayName = "CRTPostEffect"

export { CRTPostEffect, CRTEffect }
