import { Store, Coffee, ShoppingBag, UtensilsCrossed } from "lucide-react"

const industries = [
  { icon: Store, name: "Retail" },
  { icon: Coffee, name: "Cafes" },
  { icon: ShoppingBag, name: "Fashion" },
  { icon: UtensilsCrossed, name: "Restaurants" },
]

export function SocialProofSection() {
  return (
    <section className="py-16 bg-muted/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground mb-8">
          Trusted by 5,000+ Businesses Worldwide
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center">
          {industries.map((industry, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity"
            >
              <industry.icon className="h-10 w-10 text-foreground" strokeWidth={1.5} />
              <span className="text-sm font-medium text-foreground">{industry.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
