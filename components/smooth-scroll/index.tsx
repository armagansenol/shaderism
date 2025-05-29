"use client"

import "lenis/dist/lenis.css"

import { LenisRef, ReactLenis } from "lenis/react"
import { useRef } from "react"
import { useTempus } from "tempus/react"

export function SmoothScroll({ root }: { root: boolean }) {
  const lenisRef = useRef<LenisRef>(null)

  // useFrame((time: number) => {
  //   if (!lenisRef.current) return
  //   lenisRef.current.lenis?.raf(time)
  // }, 0)

  // useEffect(() => {
  //   function update(time: number) {
  //     lenisRef.current?.lenis?.raf(time * 1000)
  //   }
  //   gsap.ticker.add(update)

  //   gsap.ticker.lagSmoothing(0)

  //   return () => gsap.ticker.remove(update)
  // }, [])

  useTempus((time: number) => {
    if (lenisRef.current?.lenis) {
      lenisRef.current.lenis.raf(time)
    }
  })

  return (
    <ReactLenis
      ref={lenisRef}
      root={root}
      options={{
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        autoRaf: false,
      }}
    />
  )
}
