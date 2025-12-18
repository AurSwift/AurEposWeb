import { Sparkles } from "lucide-react"

interface WelcomeBannerProps {
  companyName: string
}

export function WelcomeBanner({ companyName }: WelcomeBannerProps) {
  return (
    <div className="bg-gradient-to-r from-primary to-accent rounded-xl p-8 text-white">
      <div className="flex items-center gap-3">
        <Sparkles className="w-8 h-8" />
        <div>
          <h2 className="text-3xl font-bold">Welcome back, {companyName}!</h2>
          <p className="text-white/90 mt-1">Your EPOS system is ready to go</p>
        </div>
      </div>
    </div>
  )
}
