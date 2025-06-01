import { forwardRef } from "react"
import { Effect } from "postprocessing"
import * as THREE from "three"

const fragmentShader = `
  uniform float time;
  uniform float noiseIntensity;
  uniform float scanlineIntensity;
  uniform float scanlineFrequency;
  uniform float vignetteIntensity;
  uniform float chromaticAberration;
  uniform float flickerIntensity;

  // Random function for noise
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  // Noise function
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec4 originalColor = inputColor;
    
    // Create time-based noise
    float timeNoise = noise(uv * 300.0 + time * 8.0);
    float staticNoise = random(uv + time * 0.03);
    float grainNoise = random(uv * 800.0 + time * 50.0);
    
    // Combine different noise types
    float combinedNoise = (timeNoise * 0.3 + staticNoise * 0.5 + grainNoise * 0.2) * noiseIntensity;
    
    // Scanlines effect
    float scanlines = sin(uv.y * scanlineFrequency * 3.14159);
    scanlines = (scanlines * 0.5 + 0.5);
    scanlines = pow(scanlines, 0.3) * scanlineIntensity;
    
    // Horizontal distortion bars
    float distortionBars = step(0.99, sin(uv.y * 25.0 + time * 3.0)) * 0.2;
    
    // Vignette effect
    vec2 vignetteUv = uv * (1.0 - uv.yx);
    float vignette = vignetteUv.x * vignetteUv.y * 16.0;
    vignette = pow(vignette, vignetteIntensity);
    
    // Screen flicker
    float flicker = sin(time * 60.0) * 0.015 + sin(time * 17.0) * 0.008;
    flicker *= flickerIntensity;
    
    // Chromatic aberration
    float aberration = chromaticAberration * 0.003;
    vec2 rOffset = vec2(aberration, 0.0);
    vec2 bOffset = vec2(-aberration, 0.0);
    
    float r = texture2D(inputBuffer, uv + rOffset).r;
    float g = originalColor.g;
    float b = texture2D(inputBuffer, uv + bOffset).b;
    
    vec3 color = vec3(r, g, b);
    
    // Apply CRT effects
    color += combinedNoise;
    color *= (1.0 - scanlines);
    color += distortionBars;
    color *= vignette;
    color += flicker;
    
    // CRT color tinting
    color.g *= 1.01;
    color.b *= 0.99;
    
    // Subtle RGB shift
    color.r += sin(uv.y * 150.0 + time) * 0.002;
    color.b += cos(uv.y * 150.0 + time) * 0.002;
    
    outputColor = vec4(color, originalColor.a);
  }
`

class CRTEffect extends Effect {
  constructor({
    noiseIntensity = 0.1,
    scanlineIntensity = 0.03,
    scanlineFrequency = 150,
    vignetteIntensity = 0.15,
    chromaticAberration = 0.5,
    flickerIntensity = 0.05,
  } = {}) {
    super("CRTEffect", fragmentShader, {
      uniforms: new Map([
        ["time", new THREE.Uniform(0.0)],
        ["noiseIntensity", new THREE.Uniform(noiseIntensity)],
        ["scanlineIntensity", new THREE.Uniform(scanlineIntensity)],
        ["scanlineFrequency", new THREE.Uniform(scanlineFrequency)],
        ["vignetteIntensity", new THREE.Uniform(vignetteIntensity)],
        ["chromaticAberration", new THREE.Uniform(chromaticAberration)],
        ["flickerIntensity", new THREE.Uniform(flickerIntensity)],
      ]),
    })
  }

  update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, deltaTime: number) {
    this.uniforms.get("time")!.value += deltaTime
  }
}

const CRTPostEffect = forwardRef<
  CRTEffect,
  {
    noiseIntensity?: number
    scanlineIntensity?: number
    scanlineFrequency?: number
    vignetteIntensity?: number
    chromaticAberration?: number
    flickerIntensity?: number
  }
>((props, ref) => {
  const effect = new CRTEffect(props)
  return <primitive ref={ref} object={effect} />
})

CRTPostEffect.displayName = "CRTPostEffect"

export { CRTPostEffect }
