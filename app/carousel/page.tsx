import { BarrelCarousel } from "@/components/barrel-carousel"

export default function Page() {
  return (
    <>
      <div className='w-screen h-screen bg-black flex items-center justify-center'>
        <span className='text-white text-4xl font-bold'>BMW</span>
      </div>
      <BarrelCarousel />
      <div className='w-screen h-screen bg-black flex items-center justify-center'>
        <span className='text-white text-4xl font-bold'>BMW</span>
      </div>
    </>
  )
}
