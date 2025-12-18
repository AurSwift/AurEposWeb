import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet, CreditCard } from "lucide-react"

interface PaymentMethodCardProps {
  paymentMethod: {
    lastFour: string
    expiry: string
  }
}

export function PaymentMethodCard({ paymentMethod }: PaymentMethodCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="w-5 h-5 text-accent" />
          Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-8 rounded bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-mono text-sm font-medium">•••• •••• •••• {paymentMethod.lastFour}</p>
            <p className="text-xs text-muted-foreground">Expires {paymentMethod.expiry}</p>
          </div>
        </div>

        <Button variant="outline" className="w-full bg-transparent">
          Update Payment Method
        </Button>
      </CardContent>
    </Card>
  )
}
