import Link from "next/link"

export default function Page() {
  return (
    <main className='min-h-screen flex items-center justify-center p-8'>
      <div className='text-center'>
        <ul className='mt-8 space-y-3'>
          <li>
            <Link href='/dithering' className='text-blue-500 hover:underline'>
              Dithering
            </Link>
          </li>
          <li>
            <Link href='/kabsch-cube' className='text-blue-500 hover:underline'>
              Kabsch Cube
            </Link>
          </li>
          <li>
            <Link href='/space' className='text-blue-500 hover:underline'>
              Space
            </Link>
          </li>
        </ul>
      </div>
    </main>
  )
}
