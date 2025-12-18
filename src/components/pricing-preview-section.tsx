import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Basic",
    description: "Perfect for small businesses",
    price: "$29",
    period: "/month",
    features: ["Up to 2 terminals", "Basic reporting", "Email support", "Cloud backup"],
  },
  {
    name: "Pro",
    description: "Most popular for growing businesses",
    price: "$79",
    period: "/month",
    featured: true,
    features: ["Unlimited terminals", "Advanced analytics", "Priority support", "Staff management", "Customer loyalty"],
  },
  {
    name: "Enterprise",
    description: "For large operations",
    price: "Custom",
    period: "",
    features: [
      "Multi-location support",
      "Custom integrations",
      "Dedicated account manager",
      "Advanced security",
      "Custom training",
    ],
  },
]

export function PricingPreviewSection() {
  return (
    <section id="pricing" className="py-20 sm:py-28 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            Choose the plan that's right for your business
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-3 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={plan.featured ? "border-2 border-secondary shadow-xl relative" : "border-border"}
            >
              {plan.featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-card-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant={plan.featured ? "default" : "outline"} asChild>
                  <Link href="/signup">Select Plan</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Button variant="link" asChild>
            <Link href="/pricing" className="text-secondary">
              See full pricing details →
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
