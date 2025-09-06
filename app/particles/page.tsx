"use client"

import React, { useRef, useMemo, useState } from "react"
import * as THREE from "three"
import { Canvas, useFrame, extend } from "@react-three/fiber"
import { OrbitControls, shaderMaterial, useGLTF } from "@react-three/drei"
import { MeshSurfaceSampler } from "three-stdlib"

interface BmwGLTFResult {
  nodes: {
    Curve002?: { geometry: THREE.BufferGeometry }
  }
  materials: unknown
}

useGLTF.preload("/glb/bmw.glb")

const PARTICLE_COUNT = 15000
const CUBE_SIDE_LENGTH = 10
const SPHERE_RADIUS = 7.5
const MODEL_SCALE_FACTOR = 150

const CustomShaderMaterial = shaderMaterial(
  // Uniforms
  {
    interpolation: 0.5,
    color: new THREE.Color(0x00ff00),
    time: 0,
  },
  // Vertex Shader
  /*glsl*/ `
    uniform float interpolation;
    uniform float time;

    attribute vec3 positionCube;
    attribute vec3 positionSphere;
    attribute vec3 positionModel;

    attribute float phi;
    attribute float theta;
    attribute float speed;
    attribute float amplitude;
    attribute float frequency;

    vec3 rtp2xyz(){
      float tmpTheta = theta + time * speed;
      float tmpPhi = phi + time * speed;
      float r = sin(time * frequency) * amplitude * sin(interpolation * 3.1415926);
      float x = sin(tmpTheta) * cos(tmpPhi) * r;
      float y = sin(tmpTheta) * sin(tmpPhi) * r;
      float z = cos(tmpPhi) * r;
      return vec3(x, y, z);
    }

    void main(){
      float stage1Interp = clamp(interpolation * 2.0, 0.0, 1.0);
      float stage2Interp = clamp((interpolation - 0.5) * 2.0, 0.0, 1.0);

      vec3 basePos = mix(positionCube, positionSphere, stage1Interp);
      basePos = mix(basePos, positionModel, stage2Interp);

      vec3 finalPosition = basePos + rtp2xyz();
      
      vec4 mvPosition = modelViewMatrix * vec4( finalPosition, 1.0 );
      gl_PointSize = 2.0 * ( 1.0 / length( mvPosition.xyz ) );
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment Shader
  /*glsl*/ `
    uniform vec3 color;
    void main(){
      gl_FragColor = vec4( color, 1.0 );
    }
  `
)

extend({ CustomShaderMaterial })

interface ParticlesProps {
  interpolationValue: number
  particleCount: number
  attrPositionCube: Float32Array
  attrPositionSphere: Float32Array
  attrPositionModel: Float32Array
  baseColor: THREE.Color
}

const Particles: React.FC<ParticlesProps> = ({
  interpolationValue,
  particleCount,
  attrPositionCube,
  attrPositionSphere,
  attrPositionModel,
  baseColor,
}) => {
  const time = useRef(0)
  useFrame((_state, delta) => {
    time.current += delta
  })

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry()

    // Set base position attribute (used by rtp2xyz if it were to depend on `position`)
    // For now, it's effectively a placeholder as attributes are used directly.
    geom.setAttribute("position", new THREE.BufferAttribute(attrPositionCube, 3))

    geom.setAttribute("positionCube", new THREE.BufferAttribute(attrPositionCube, 3))
    geom.setAttribute("positionSphere", new THREE.BufferAttribute(attrPositionSphere, 3))
    geom.setAttribute("positionModel", new THREE.BufferAttribute(attrPositionModel, 3))

    const phi = new Float32Array(particleCount)
    const theta = new Float32Array(particleCount)
    const speed = new Float32Array(particleCount)
    const amplitude = new Float32Array(particleCount)
    const frequency = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      phi[i] = Math.random() * Math.PI * 2
      theta[i] = Math.random() * Math.PI * 2
      speed[i] = THREE.MathUtils.randFloatSpread(6)
      amplitude[i] = Math.random() * 5
      frequency[i] = Math.random() * 5
    }

    geom.setAttribute("phi", new THREE.BufferAttribute(phi, 1))
    geom.setAttribute("theta", new THREE.BufferAttribute(theta, 1))
    geom.setAttribute("speed", new THREE.BufferAttribute(speed, 1))
    geom.setAttribute("amplitude", new THREE.BufferAttribute(amplitude, 1))
    geom.setAttribute("frequency", new THREE.BufferAttribute(frequency, 1))

    return geom
  }, [particleCount, attrPositionCube, attrPositionSphere, attrPositionModel])

  return (
    <points geometry={geometry}>
      {/* @ts-expect-error: customShaderMaterial is extended */}
      <customShaderMaterial
        attach="material"
        time={time.current}
        interpolation={interpolationValue}
        color={baseColor}
        // radius uniform is no longer used by this shader version
      />
    </points>
  )
}

const ParticlesPage = () => {
  const [sliderValue, setSliderValue] = useState(0.0) // Start at cube
  const { nodes: bmwNodes } = useGLTF("/glb/bmw.glb") as unknown as BmwGLTFResult
  const bmwGeom = bmwNodes.Curve002?.geometry

  const { cubePositions, spherePositions, modelPositions } = useMemo(() => {
    const tempPosition = new THREE.Vector3()

    const cPositions = new Float32Array(PARTICLE_COUNT * 3)
    const sPositions = new Float32Array(PARTICLE_COUNT * 3)
    const mPositions = new Float32Array(PARTICLE_COUNT * 3)

    // 1. Cube Points
    const boxGeom = new THREE.BoxGeometry(CUBE_SIDE_LENGTH, CUBE_SIDE_LENGTH, CUBE_SIDE_LENGTH)
    const boxMeshForSampling = new THREE.Mesh(boxGeom)
    const boxSampler = new MeshSurfaceSampler(boxMeshForSampling).build()
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      boxSampler.sample(tempPosition)
      cPositions.set([tempPosition.x, tempPosition.y, tempPosition.z], i * 3)
    }

    // 2. Sphere Points (derived from cube samples for correspondence, scaled to SPHERE_RADIUS)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      tempPosition
        .set(cPositions[i * 3], cPositions[i * 3 + 1], cPositions[i * 3 + 2])
        .normalize()
        .multiplyScalar(SPHERE_RADIUS)
      sPositions.set([tempPosition.x, tempPosition.y, tempPosition.z], i * 3)
    }

    // 3. BMW Model Points
    if (bmwGeom && bmwGeom.attributes.position) {
      const modelMeshForSampling = new THREE.Mesh(bmwGeom)
      const modelSampler = new MeshSurfaceSampler(modelMeshForSampling).build()
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        modelSampler.sample(tempPosition)
        tempPosition.multiplyScalar(MODEL_SCALE_FACTOR)
        mPositions.set([tempPosition.x, tempPosition.y, tempPosition.z], i * 3)
      }
    } else {
      console.warn(
        "BMW GLB geometry issues (not loaded, no Curve002, or Curve002 has no position data). Falling back to sphere for model points."
      )
      mPositions.set(sPositions)
    }

    return { cubePositions: cPositions, spherePositions: sPositions, modelPositions: mPositions }
  }, [bmwGeom]) // Dependency on bmwGeom ensures this recalculates if the model loads

  const particleColor = useMemo(() => {
    // Change color based on interpolation stage for visual feedback
    if (sliderValue < 0.48) return new THREE.Color(0x00ff00) // Cube-ish: Green
    if (sliderValue < 0.52) return new THREE.Color(0x0000ff) // Sphere: Blue
    return new THREE.Color(0xff0000) // Model-ish: Red
  }, [sliderValue])

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <input
        id="slider"
        type="range"
        min="0"
        max="1"
        step="0.001" // Finer step for smoother transitions
        value={sliderValue}
        onChange={(e) => setSliderValue(parseFloat(e.target.value))}
        style={{ position: "absolute", width: "300px", zIndex: 10, top: "20px", left: "20px" }}
      />
      <Canvas camera={{ position: [0, 0, 25], fov: 60, near: 0.1, far: 1000 }}>
        {" "}
        {/* Adjusted camera Z for better view */}
        <ambientLight intensity={0.7} />
        <Particles
          interpolationValue={sliderValue}
          particleCount={PARTICLE_COUNT}
          attrPositionCube={cubePositions}
          attrPositionSphere={spherePositions}
          attrPositionModel={modelPositions}
          baseColor={particleColor}
        />
        <OrbitControls />
      </Canvas>
    </div>
  )
}

export default ParticlesPage
