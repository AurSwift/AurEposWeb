import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, User, HeadphonesIcon, Terminal } from "lucide-react";

export function QuickLinksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Links</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link href="/dashboard/terminals">
          <Button variant="outline" className="w-full justify-start bg-transparent">
            <Terminal className="w-4 h-4 mr-2" />
            Manage Terminals
          </Button>
        </Link>
        <Link href="/dashboard/billing-history">
          <Button variant="outline" className="w-full justify-start bg-transparent">
            <FileText className="w-4 h-4 mr-2" />
            View Billing History
          </Button>
        </Link>
        <Link href="/dashboard/profile">
          <Button variant="outline" className="w-full justify-start bg-transparent">
            <User className="w-4 h-4 mr-2" />
            Update Company Profile
          </Button>
        </Link>
        <Link href="/dashboard/support">
          <Button variant="outline" className="w-full justify-start bg-transparent">
            <HeadphonesIcon className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
