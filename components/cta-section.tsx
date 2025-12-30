import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-20 bg-primary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl text-balance">
            Ready to Streamline Your Business?
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/90 text-balance">
            Get started in minutes. No credit card required for your free trial.
          </p>
          <div className="mt-8">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/signup">Get Started Now</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
