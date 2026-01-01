"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Key, Copy, Check } from "lucide-react"

interface LicenseKeyCardProps {
  licenseKey: string
}

export function LicenseKeyCard({ licenseKey }: LicenseKeyCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(licenseKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Key className="w-5 h-5 text-accent" />
          Your License Key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Use this key to activate your aurswift software</p>

        <div className="bg-neutral-light border border-border rounded-lg p-4">
          <p className="font-mono text-lg font-bold text-center text-foreground tracking-wider">{licenseKey}</p>
        </div>

        <Button onClick={handleCopy} variant="outline" className="w-full bg-transparent">
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy License Key
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
