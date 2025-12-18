import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Monitor } from "lucide-react"

export function DownloadCard() {
  return (
    <Card className="border-2 border-accent/30 bg-accent/5">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Monitor className="w-5 h-5 text-accent" />
          Software Download
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Download the latest version of Auraswif EPOS software for Windows or macOS
        </p>

        <div className="space-y-2">
          <Button className="w-full" size="lg">
            <Download className="w-5 h-5 mr-2" />
            Download Auraswif Software
          </Button>
          <p className="text-xs text-center text-muted-foreground">Version 3.2.1 • Released Dec 10, 2024</p>
        </div>
      </CardContent>
    </Card>
  )
}
