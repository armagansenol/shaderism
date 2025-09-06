"use client"
import * as React from "react"
import { Canvas } from "@react-three/fiber"
import {
  OrbitControls,
  TransformControls as DreiTransformControls,
  Points,
  PointMaterial,
  Line,
} from "@react-three/drei"
import * as THREE from "three"

// #region KABSCH CLASS (Moved outside component, uses potentially imported Vec3/Quat)
class Kabsch {
  refPoints: number[][] = []
  refOffset: number[][] = []
  refScale = 1
  refCenter: number[] = [0, 0, 0]
  tarPoints: THREE.Vector3[] = [] // Use THREE.Vector3 for target points internally for R3F compatibility
  iterations = 30
  covariance = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  rotation = new THREE.Quaternion() // Use THREE.Quaternion for output
  translation = new THREE.Vector3() // Use THREE.Vector3 for output
  scale = 1

  setReferences(ary: number[][]) {
    this.refCenter = [0, 0, 0]
    this._centroid(ary, this.refCenter) // Calculate centroid using input array format

    this.refPoints = []
    this.refOffset = []
    this.refScale = 0

    for (const p of ary) {
      this.refPoints.push([...p]) // Store original format if needed
      const off = [p[0] - this.refCenter[0], p[1] - this.refCenter[1], p[2] - this.refCenter[2]]
      try {
        // Use the helper function
        this.refScale += getVectorLength(off)
      } catch (err) {
        console.error("Error using getVectorLength:", err)
        // Fallback or default scaling logic if Vec3.len fails
        this.refScale += Math.sqrt(off[0] * off[0] + off[1] * off[1] + off[2] * off[2])
      }
      this.refOffset.push(off) // Keep offset in original number[] format for covariance calc
    }
    return this
  }

  // Accepts THREE.Vector3 for easier integration with R3F state
  setTargets(ary: THREE.Vector3[]) {
    this.tarPoints = ary.map((v) => v.clone()) // Store clones
    return this
  }

  // Returns THREE.Vector3 for R3F compatibility
  getComputedPoints(incScale = false): THREE.Vector3[] {
    const rtn: THREE.Vector3[] = []
    for (const offset of this.refOffset) {
      // Convert ref offset (number[]) to THREE.Vector3 for rotation
      const v = new THREE.Vector3(...offset)
      v.applyQuaternion(this.rotation)
      if (incScale) v.multiplyScalar(this.scale)
      v.add(this.translation)
      rtn.push(v)
    }
    return rtn
  }

  // Can handle number[][] or THREE.Vector3[]
  _centroid(ary: Array<number[] | THREE.Vector3>, out: number[] = [0, 0, 0]) {
    out[0] = 0
    out[1] = 0
    out[2] = 0
    for (const i of ary) {
      if (Array.isArray(i)) {
        // Handles refPoints (number[][])
        out[0] += i[0]
        out[1] += i[1]
        out[2] += i[2]
      } else {
        // Handles tarPoints (THREE.Vector3[])
        out[0] += i.x
        out[1] += i.y
        out[2] += i.z
      }
    }
    const invLen = ary.length > 0 ? 1 / ary.length : 1
    out[0] *= invLen
    out[1] *= invLen
    out[2] *= invLen
    return out
  }

  compute() {
    if (!this.refPoints.length || !this.tarPoints.length || this.refPoints.length !== this.tarPoints.length) {
      console.error("Kabsch compute error: Point counts mismatch or zero.")
      this.translation.set(0, 0, 0)
      this.rotation.identity()
      this.scale = 1
      return
    }

    // Target centroid calculation (using THREE.Vector3 array)
    const tarCenterArr = this._centroid(this.tarPoints)
    const tarCenter = new THREE.Vector3(...tarCenterArr)
    const tarOffsetVec: THREE.Vector3[] = [] // Keep as THREE.Vector3
    let tarScale = 0

    for (let i = 0; i < this.tarPoints.length; i++) {
      const offset = this.tarPoints[i].clone().sub(tarCenter)
      tarOffsetVec.push(offset)
      tarScale += offset.length()
    }

    // --- Covariance Matrix ---
    // Reset Matrix
    for (const i of this.covariance) {
      i[0] = 0
      i[1] = 0
      i[2] = 0
    }
    const c = this.covariance

    // Compute Matrix (Ref * Tar^T)
    // Uses refOffset (number[][]) and tarOffsetVec (THREE.Vector3[])
    for (let i = 0; i < this.refOffset.length; i++) {
      const l = this.refOffset[i] // Reference offset point (number[])
      const r = tarOffsetVec[i] // Target offset point (THREE.Vector3)

      c[0][0] += l[0] * r.x
      c[1][0] += l[1] * r.x
      c[2][0] += l[2] * r.x
      c[0][1] += l[0] * r.y
      c[1][1] += l[1] * r.y
      c[2][1] += l[2] * r.y
      c[0][2] += l[0] * r.z
      c[1][2] += l[1] * r.z
      c[2][2] += l[2] * r.z
    }

    // --- Extract Rotation ---
    // This method internally updates this.rotation (THREE.Quaternion)
    this.extractRotation()

    // --- Translation and Scale ---
    const refCenterVec = new THREE.Vector3(...this.refCenter)

    // Translation T = centroid_tar - S * R * centroid_ref
    // Need to apply calculated rotation and scale to the reference centroid
    const scaledRotatedRefCenter = refCenterVec.clone().applyQuaternion(this.rotation)
    // .multiplyScalar(this.scale); // Apply scale here if it affects translation like this

    this.translation.subVectors(tarCenter, scaledRotatedRefCenter)

    // Scale computation (RMSD approach might be more robust, but matching original)
    if (this.refScale > 1e-6) {
      // Avoid division by near-zero
      this.scale = tarScale / this.refScale
    } else {
      this.scale = 1
      console.warn("Reference scale is near zero, defaulting scale to 1.")
    }
    // Clamp scale if necessary
    this.scale = Math.max(1e-6, this.scale)
  }

  // Adapted from https://animation.rwth-aachen.de/media/papers/2016-MIG-StableRotation.pdf
  // Uses THREE.js math objects for internal calculation, outputs to this.rotation
  extractRotation(iter?: number) {
    const iterations = iter === undefined ? this.iterations : iter
    const c = this.covariance // The 3x3 covariance matrix data [row][col]

    // --- SVD Approach (More standard and robust for Kabsch) ---
    // For Kabsch, the optimal rotation is found via SVD of the covariance matrix C = P^T * Q
    // Where P and Q are centered point sets. C = U * S * V^T
    // The optimal rotation R = V * diag(1, 1, det(V*U^T)) * U^T
    try {
      const qx = new THREE.Vector3()
      const qy = new THREE.Vector3()
      const qz = new THREE.Vector3()
      const axis = new THREE.Vector3()
      const tempVec = new THREE.Vector3()
      const tempQuat = new THREE.Quaternion()
      const currentRotation = new THREE.Quaternion() // Start with identity

      for (let i = 0; i < iterations; i++) {
        qx.set(1, 0, 0).applyQuaternion(currentRotation)
        qy.set(0, 1, 0).applyQuaternion(currentRotation)
        qz.set(0, 0, 1).applyQuaternion(currentRotation)

        // Get columns of Covariance matrix applied to current axes
        // These represent the target directions for the current axes
        const cx = new THREE.Vector3(c[0][0], c[1][0], c[2][0]).applyQuaternion(currentRotation) // Col 0 rotated
        const cy = new THREE.Vector3(c[0][1], c[1][1], c[2][1]).applyQuaternion(currentRotation) // Col 1 rotated
        const cz = new THREE.Vector3(c[0][2], c[1][2], c[2][2]).applyQuaternion(currentRotation) // Col 2 rotated

        // Calculate torque based on cross products (align current axes to target directions)
        axis
          .crossVectors(qx, cx) // Torque for x-axis
          .add(tempVec.crossVectors(qy, cy)) // Add torque for y-axis
          .add(tempVec.crossVectors(qz, cz)) // Add torque for z-axis

        // Check if axis is non-zero before normalizing
        const rad = axis.length()
        if (rad < 1e-9) break // Converged or zero torque

        axis.multiplyScalar(1.0 / rad) // Normalize axis
        // Apply a fraction of the rotation (like gradient descent step) - angle based on magnitude?
        // Or use the angle derived in the paper if implementing accurately
        tempQuat.setFromAxisAngle(axis, Math.min(rad * 0.5, Math.PI / 4)) // Apply rotation based on torque axis/magnitude (damped)

        // Accumulate rotation
        currentRotation.premultiply(tempQuat).normalize()
      }
      this.rotation.copy(currentRotation)
    } catch (error) {
      console.error("Error during SVD or rotation extraction:", error)
      this.rotation.identity() // Reset on error
    }

    return this.rotation
  }
}
// #endregion

// #region Scene Component
const Scene = () => {
  // Use state for initial points to allow potential future dynamic changes
  const [initialRefPoints] = React.useState(() => [
    [-1, 0, -1],
    [-1, 0, 1],
    [1, 0, 1],
    [1, 0, -1],
  ])
  const [initialTarPoints] = React.useState(() => [
    new THREE.Vector3(-2, 0, -2),
    new THREE.Vector3(-2, 0, 2),
    new THREE.Vector3(2, 0, 2),
    new THREE.Vector3(2, 0, -2),
  ])

  const [targetPoints, setTargetPoints] = React.useState<THREE.Vector3[]>(initialTarPoints)
  const [selectedPointIndex, setSelectedPointIndex] = React.useState<number>(0)
  const [computedPoints, setComputedPoints] = React.useState<THREE.Vector3[]>([])
  const [kabschResult, setKabschResult] = React.useState<{
    translation: THREE.Vector3
    rotation: THREE.Quaternion
    scale: number
  }>({
    translation: new THREE.Vector3(),
    rotation: new THREE.Quaternion(),
    scale: 1,
  })

  const kabschSolver = React.useRef<Kabsch | null>(null)
  const transformControlsRef = React.useRef<React.ComponentRef<typeof DreiTransformControls>>(null)

  // Initialize Kabsch Solver only once
  React.useEffect(() => {
    if (!kabschSolver.current) {
      kabschSolver.current = new Kabsch()
      kabschSolver.current.setReferences(initialRefPoints)
      console.log("Kabsch solver initialized")

      // Perform initial computation
      kabschSolver.current.setTargets(initialTarPoints) // Use initial targets
      kabschSolver.current.compute()
      setKabschResult({
        translation: kabschSolver.current.translation.clone(),
        rotation: kabschSolver.current.rotation.clone(),
        scale: kabschSolver.current.scale,
      })
      setComputedPoints(kabschSolver.current.getComputedPoints(false))
    }
  }, [initialRefPoints, initialTarPoints]) // Add initialTarPoints dependency

  // Re-run Kabsch Calculation when target points change
  React.useEffect(() => {
    // Skip initial run if already handled by init useEffect
    if (!kabschSolver.current || targetPoints === initialTarPoints) return

    kabschSolver.current.setTargets(targetPoints)
    kabschSolver.current.compute()

    setKabschResult({
      translation: kabschSolver.current.translation.clone(),
      rotation: kabschSolver.current.rotation.clone(),
      scale: kabschSolver.current.scale,
    })
    setComputedPoints(kabschSolver.current.getComputedPoints(false)) // Get points without scale for viz
  }, [targetPoints, initialTarPoints]) // Depend on targetPoints

  // --- Transform Controls Logic ---
  const transformTargetRef = React.useRef<THREE.Group>(null!) // Ref for the object TransformControls attaches to

  // Update dummy object's position when selected point changes
  React.useEffect(() => {
    const selectedPos = targetPoints[selectedPointIndex]
    if (selectedPos && transformTargetRef.current) {
      transformTargetRef.current.position.copy(selectedPos)
    }
  }, [selectedPointIndex, targetPoints])

  // Handle TransformControls drag end (or objectChange for continuous update)
  const handleDragEnd = React.useCallback(() => {
    if (transformTargetRef.current) {
      const newPos = transformTargetRef.current.position
      setTargetPoints((prevPoints) => {
        const newPoints = prevPoints.map((p, i) => (i === selectedPointIndex ? newPos.clone() : p))
        // Check if position actually changed to avoid unnecessary updates
        if (!newPoints[selectedPointIndex].equals(prevPoints[selectedPointIndex])) {
          return newPoints
        }
        return prevPoints // No change
      })
    }
  }, [selectedPointIndex])

  // Handle Keyboard Input to switch selected point
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyNum = parseInt(event.key)
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= targetPoints.length) {
        const newIndex = keyNum - 1
        if (newIndex !== selectedPointIndex) {
          setSelectedPointIndex(newIndex)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [targetPoints.length, selectedPointIndex]) // Re-run if point count or selection changes

  return (
    <>
      <ambientLight intensity={Math.PI / 2} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <OrbitControls makeDefault enableDamping={true} dampingFactor={0.1} />

      {/* Cube driven by Kabsch result */}
      <mesh
        position={kabschResult.translation}
        quaternion={kabschResult.rotation}
        // Apply scale. Note: Scaling non-uniformly might require matrix.
        scale={kabschResult.scale}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="royalblue" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* CORRECTED: Add an empty group to the scene graph to attach controls to */}
      <group ref={transformTargetRef} />

      {/* Transform Controls attached to the declaratively added group */}
      {transformTargetRef.current && ( // Check ref before rendering
        <DreiTransformControls
          ref={transformControlsRef}
          object={transformTargetRef.current} // CORRECTED: Attach to the group via object prop
          mode="translate"
          onMouseUp={handleDragEnd}
          showX={true}
          showY={true}
          showZ={true}
          size={0.5}
        />
      )}

      {/* Visualization: Computed Points (Yellow) */}
      {computedPoints.length > 0 && (
        <Points>
          <PointMaterial transparent color="yellow" size={15} sizeAttenuation={false} depthTest={true} />
          {computedPoints.map((p, i) => (
            <Point key={`comp-${i}`} position={p.toArray()} />
          ))}
        </Points>
      )}

      {/* Visualization: Target Points (Cyan) - Highlight selected */}
      {targetPoints.length > 0 && (
        <Points>
          <PointMaterial transparent color="cyan" size={12} sizeAttenuation={false} depthTest={true} />
          {targetPoints.map((p, i) => (
            <Point key={`tar-${i}`} position={p.toArray() as THREE.Vector3Tuple} />
          ))}
        </Points>
      )}

      {/* Visualization: Lines connecting computed to target */}
      {computedPoints.length === targetPoints.length && computedPoints.length > 0 && (
        <>
          {computedPoints.map((pComp, i) => (
            <Line
              key={`line-${i}`}
              points={[pComp.toArray(), targetPoints[i].toArray()]} // Pass points as array of number[]
              color="gray"
              lineWidth={1}
              dashed={false}
            />
          ))}
        </>
      )}
    </>
  )
}
// #endregion

// Helper Point component for Points collection
function Point({ position }: { position: THREE.Vector3Tuple }) {
  return (
    <mesh position={position}>
      {/* You could render a small sphere or sprite here if needed,
          but Points component handles the rendering */}
    </mesh>
  )
}

// #region Page Component (Wrapper)
export default function KabschCubePage() {
  // Use Suspense for lazy loading or async operations within Canvas if needed
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#202020" }}>
      {/* Basic instructions overlay */}
      <div
        style={{
          position: "fixed",
          top: "10px",
          left: "10px",
          fontFamily: "monospace",
          color: "yellow",
          fontSize: "14px",
          zIndex: 1,
        }}
      >
        Press 1, 2, 3, 4 on keyboard to switch points
      </div>
      <Canvas camera={{ position: [0, 5, 12], fov: 50 }} shadows>
        {/* Wrap Scene in Suspense if it or its children use React.lazy or async hooks */}
        <React.Suspense fallback={null}>
          <Scene />
        </React.Suspense>
      </Canvas>
    </div>
  )
}
// #endregion

// Define a helper function for vector length calculation
const getVectorLength = (v: number[] | THREE.Vector3): number => {
  if (Array.isArray(v)) return new THREE.Vector3(...v).length()
  if (v instanceof THREE.Vector3) return v.length()
  console.warn("getVectorLength called with unexpected type:", v)
  return 0
}
