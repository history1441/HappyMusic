import { Outlet } from 'react-router'
import { Disc3 } from 'lucide-react'

export default function AuthLayout() {
  return (
    <div className="h-full flex items-center justify-center bg-bg">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Disc3 size={32} className="text-primary" />
          <span className="text-2xl font-bold text-primary">HappyMusic</span>
        </div>

        <Outlet />
      </div>
    </div>
  )
}
