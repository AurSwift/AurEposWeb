import { Link } from "react-router-dom"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, ArrowLeft } from "lucide-react"

export default function BillingHistoryPage() {
  const companyName = "Acme Retail Co."

  // Mock invoice data
  const invoices = [
    {
      id: "INV-2024-12",
      date: "2024-12-15",
      amount: 99.0,
      status: "Paid",
      plan: "Pro Plan",
      period: "Dec 15, 2024 - Jan 15, 2025",
    },
    {
      id: "INV-2024-11",
      date: "2024-11-15",
      amount: 99.0,
      status: "Paid",
      plan: "Pro Plan",
      period: "Nov 15, 2024 - Dec 15, 2024",
    },
    {
      id: "INV-2024-10",
      date: "2024-10-15",
      amount: 99.0,
      status: "Paid",
      plan: "Pro Plan",
      period: "Oct 15, 2024 - Nov 15, 2024",
    },
    {
      id: "INV-2024-09",
      date: "2024-09-15",
      amount: 49.0,
      status: "Paid",
      plan: "Standard Plan",
      period: "Sep 15, 2024 - Oct 15, 2024",
    },
    {
      id: "INV-2024-08",
      date: "2024-08-15",
      amount: 49.0,
      status: "Paid",
      plan: "Standard Plan",
      period: "Aug 15, 2024 - Sep 15, 2024",
    },
  ]

  const handleDownloadInvoice = (invoiceId: string) => {
    // Generate dummy PDF download
    const invoiceData = invoices.find((inv) => inv.id === invoiceId)
    if (!invoiceData) return

    // Create a simple invoice text content
    const invoiceContent = `
AURASWIF EPOS SOLUTIONS
Invoice: ${invoiceData.id}
Date: ${invoiceData.date}

Bill To:
${companyName}

Description: ${invoiceData.plan}
Billing Period: ${invoiceData.period}

Amount: $${invoiceData.amount.toFixed(2)}
Status: ${invoiceData.status}

Thank you for your business!
    `.trim()

    // Create a blob and download it
    const blob = new Blob([invoiceContent], { type: "text/plain" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${invoiceId}.txt`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <div className="min-h-screen bg-neutral-light">
      <DashboardHeader companyName={companyName} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link to="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-primary">Billing History</h1>
          <p className="text-muted-foreground mt-2">View and download your past invoices</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>All your billing history in one place</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{invoice.id}</h3>
                        <Badge variant={invoice.status === "Paid" ? "default" : "secondary"}>{invoice.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{invoice.plan}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{invoice.period}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Issued:{" "}
                        {new Date(invoice.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary">${invoice.amount.toFixed(2)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadInvoice(invoice.id)}
                      className="whitespace-nowrap"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

