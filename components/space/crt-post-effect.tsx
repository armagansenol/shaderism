import { forwardRef, useEffect, useRef, useMemo } from "react"
import { Effect, PixelationEffect, EffectPass } from "postprocessing"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"

const fragmentShader = `
  uniform float time;
  uniform vec2 resolution;
  uniform float fadeOut;
  
  // Curvature
  uniform float barrelPower;
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
    float radius = pow(length(p), barrelPower);

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
  constructor({
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
  } = {}) {
    super("CRTEffect", fragmentShader, {
      // @ts-expect-error - postprocessing library requires flexible uniform types
      uniforms: new Map([
        ["time", new THREE.Uniform(0.0)],
        ["resolution", new THREE.Uniform(new THREE.Vector2(1920, 1080))],
        ["fadeOut", new THREE.Uniform(fadeOut)],
        ["barrelPower", new THREE.Uniform(barrelPower)],
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
}

const CRTPostEffect = forwardRef<CRTEffect, CRTParams>((props, ref) => {
  const effectRef = useRef<CRTEffect>(null!)
  const pixelationRef = useRef<PixelationEffect>(null!)
  const guiRef = useRef<unknown>(null)

  const effect = useMemo(() => new CRTEffect(props), [props])
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

  useEffect(() => {
    if (guiRef.current) return // Prevent creating multiple GUIs

    // Dynamically import dat.gui only on the client side
    if (typeof window !== "undefined") {
      import("dat.gui")
        .then((dat) => {
          if (guiRef.current) return // Double-check in case another instance started creating GUI

          const GUI = dat.GUI
          const gui = new GUI()
          guiRef.current = gui

          const crtFolder = gui.addFolder("CRT Monitor Effects")

          // Curvature controls
          const curvatureFolder = crtFolder.addFolder("Screen Curvature")
          curvatureFolder
            .add({ barrelPower: props.barrelPower ?? PRESETS["Old TV"].barrelPower }, "barrelPower", 1.0, 2.0, 0.01)
            .name("Barrel Distortion")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ barrelPower: value })
            })

          // Color bleeding controls
          const bleedingFolder = crtFolder.addFolder("Color Bleeding")
          bleedingFolder
            .add(
              { colorBleeding: props.colorBleeding ?? PRESETS["Old TV"].colorBleeding },
              "colorBleeding",
              0.0,
              2.0,
              0.01
            )
            .name("Bleeding Intensity")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ colorBleeding: value })
            })

          bleedingFolder
            .add(
              { bleedingRangeX: props.bleedingRangeX ?? PRESETS["Old TV"].bleedingRangeX },
              "bleedingRangeX",
              0.0,
              10.0,
              0.1
            )
            .name("Horizontal Range")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ bleedingRangeX: value })
            })

          bleedingFolder
            .add(
              { bleedingRangeY: props.bleedingRangeY ?? PRESETS["Old TV"].bleedingRangeY },
              "bleedingRangeY",
              0.0,
              10.0,
              0.1
            )
            .name("Vertical Range")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ bleedingRangeY: value })
            })

          // Scanline controls
          const scanlineFolder = crtFolder.addFolder("Scanlines")
          scanlineFolder
            .add(
              { linesDistance: props.linesDistance ?? PRESETS["Old TV"].linesDistance },
              "linesDistance",
              1.0,
              20.0,
              0.1
            )
            .name("Line Distance")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ linesDistance: value })
            })

          scanlineFolder
            .add({ scanSize: props.scanSize ?? PRESETS["Old TV"].scanSize }, "scanSize", 0.5, 10.0, 0.1)
            .name("Scan Size")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ scanSize: value })
            })

          scanlineFolder
            .add(
              { scanlineAlpha: props.scanlineAlpha ?? PRESETS["Old TV"].scanlineAlpha },
              "scanlineAlpha",
              0.0,
              1.0,
              0.01
            )
            .name("Scanline Alpha")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ scanlineAlpha: value })
            })

          scanlineFolder
            .add(
              { linesVelocity: props.linesVelocity ?? PRESETS["Old TV"].linesVelocity },
              "linesVelocity",
              0.0,
              100.0,
              1.0
            )
            .name("Animation Speed")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ linesVelocity: value })
            })

          // Noise overlay controls
          const noiseFolder = crtFolder.addFolder("Noise Overlay")
          noiseFolder
            .add(
              { noiseIntensity: props.noiseIntensity ?? PRESETS["Old TV"].noiseIntensity },
              "noiseIntensity",
              0.0,
              1.0,
              0.01
            )
            .name("Grain Intensity")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ noiseIntensity: value })
            })

          noiseFolder
            .add({ noiseScale: props.noiseScale ?? PRESETS["Old TV"].noiseScale }, "noiseScale", 10.0, 1000.0, 10.0)
            .name("Grain Size")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ noiseScale: value })
            })

          noiseFolder
            .add({ noiseSpeed: props.noiseSpeed ?? PRESETS["Old TV"].noiseSpeed }, "noiseSpeed", 0.0, 5.0, 0.1)
            .name("Animation Speed")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ noiseSpeed: value })
            })

          // Pixelation controls
          const pixelationFolder = crtFolder.addFolder("Pixelation")
          pixelationFolder
            .add({ granularity: props.pixelationGranularity ?? 5 }, "granularity", 1, 100, 1)
            .name("Pixel Size")
            .onChange((value: number) => {
              if (pixelationRef.current) {
                pixelationRef.current.granularity = value
              }
            })

          // Global controls
          const globalFolder = crtFolder.addFolder("Global")
          globalFolder
            .add({ fadeOut: props.fadeOut ?? 1.0 }, "fadeOut", 0.0, 1.0, 0.01)
            .name("Effect Intensity")
            .onChange((value: number) => {
              effectRef.current?.updateUniforms({ fadeOut: value })
            })

          // Add presets
          const presets = {
            "Classic CRT": () => {
              effectRef.current?.updateUniforms(PRESETS["Classic CRT"])
            },
            "Strong Scanlines": () => {
              effectRef.current?.updateUniforms(PRESETS["Strong Scanlines"])
            },
            "Subtle Monitor": () => {
              effectRef.current?.updateUniforms(PRESETS["Subtle Monitor"])
            },
            "Old TV": () => {
              effectRef.current?.updateUniforms(PRESETS["Old TV"])
            },
            Clean: () => {
              effectRef.current?.updateUniforms(PRESETS.Clean)
            },
          }

          const presetFolder = crtFolder.addFolder("Presets")
          Object.entries(presets).forEach(([name, func]) => {
            presetFolder.add({ [name]: func }, name)
          })
        })
        .catch((error) => {
          console.error("Failed to load dat.gui:", error)
        })
    }

    // Cleanup function to destroy GUI when component unmounts
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
  }, [props])

  const { camera } = useThree()
  const effectPass = useMemo(
    () => new EffectPass(camera as unknown as THREE.Camera, effect, pixelationEffect),
    [camera, effect, pixelationEffect]
  )

  return <primitive object={effectPass} attach='passes' />
})

CRTPostEffect.displayName = "CRTPostEffect"

export { CRTPostEffect, CRTEffect }
