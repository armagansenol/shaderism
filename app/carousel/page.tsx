import SpiralCarousel from "@/components/spiral-carousel"

export default function Page() {
  return (
    <div style={{ height: "100vh" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <SpiralCarousel />
      </div>
    </div>
  )
}
