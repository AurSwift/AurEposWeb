import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-primary pt-16 pb-24 sm:pt-24 sm:pb-32">
      <div className="absolute inset-0 bg-[url('/modern-retail-business-owner-using-tablet-in-store.jpg')] bg-cover bg-center opacity-10" />
      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary-foreground sm:text-6xl lg:text-7xl text-balance">
            The EPOS System That Grows With You
          </h1>
          <p className="mt-6 text-lg leading-8 text-primary-foreground/90 sm:text-xl text-balance">
            Smart Commerce, Simplified. Run your retail or hospitality business with confidence using our powerful,
            intuitive EPOS software.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto">
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="w-full sm:w-auto bg-transparent text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="#pricing">View Plans</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
