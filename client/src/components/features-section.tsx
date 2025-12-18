import { BarChart3, Package, Users, Heart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description:
      "Track sales, inventory, and customer behavior with powerful dashboards and insights that help you make data-driven decisions.",
  },
  {
    icon: Package,
    title: "Inventory Management",
    description:
      "Manage stock levels, automate reordering, and never miss a sale with intelligent inventory tracking across all locations.",
  },
  {
    icon: Users,
    title: "Staff Scheduling",
    description:
      "Optimize workforce management with integrated scheduling, time tracking, and performance analytics for your team.",
  },
  {
    icon: Heart,
    title: "Customer Loyalty Tools",
    description:
      "Build lasting relationships with built-in loyalty programs, customer profiles, and personalized marketing campaigns.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
            Everything you need to run your business
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            Powerful features designed to streamline operations and drive growth
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card key={index} className="border-border bg-card hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10 mb-4">
                  <feature.icon className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-2">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
