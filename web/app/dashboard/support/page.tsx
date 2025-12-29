"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Send, Mail, Phone, MessageSquare, Search, Filter, ChevronRight, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  message: string;
  status: string;
  response: string | null;
  respondedAt: Date | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function SupportPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("new");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    subject: "",
    category: "",
    priority: "",
    message: "",
  });

  useEffect(() => {
    if (activeTab === "history") {
      fetchTickets();
    }
  }, [activeTab, page, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      if (statusFilter) params.append("status", statusFilter);
      if (categoryFilter) params.append("category", categoryFilter);
      if (priorityFilter) params.append("priority", priorityFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(`/api/support?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch tickets");
      }

      setTickets(data.tickets || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to fetch tickets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      open: { variant: "default", icon: AlertCircle, label: "Open" },
      in_progress: { variant: "secondary", icon: Clock, label: "In Progress" },
      resolved: { variant: "default", icon: CheckCircle2, label: "Resolved" },
      closed: { variant: "outline", icon: XCircle, label: "Closed" },
    };
    const config = variants[status] || { variant: "secondary", icon: null, label: status };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant}>
        {Icon && <Icon className="h-3 w-3 mr-1" />}
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      low: { variant: "outline", label: "Low" },
      medium: { variant: "secondary", label: "Medium" },
      high: { variant: "default", label: "High" },
      urgent: { variant: "destructive", label: "Urgent" },
    };
    const config = variants[priority] || { variant: "secondary", label: priority };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit support ticket");
      }

      toast({
        title: "Success",
        description: `Support ticket ${data.ticket.ticketNumber} created successfully! Our team will get back to you within 24 hours.`,
      });

      // Reset form
      setFormData({
        subject: "",
        category: "",
        priority: "",
        message: "",
      });

      // Switch to history tab and refresh
      setActiveTab("history");
      fetchTickets();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit support ticket",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-primary">Contact Support</h1>
        <p className="text-muted-foreground mt-2">Get help from our expert support team</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="new">New Ticket</TabsTrigger>
          <TabsTrigger value="history">Ticket History</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact Information */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Support Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-foreground">Monday - Friday</p>
                <p className="text-muted-foreground">9:00 AM - 6:00 PM EST</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Weekend</p>
                <p className="text-muted-foreground">10:00 AM - 4:00 PM EST</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Other Ways to Reach Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-accent mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Email</p>
                  <p className="text-muted-foreground">support@auraswif.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-accent mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Phone</p>
                  <p className="text-muted-foreground">1-800-AURASWIF</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageSquare className="w-4 h-4 text-accent mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Live Chat</p>
                  <p className="text-muted-foreground">Available on website</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Submit a Support Ticket</CardTitle>
              <CardDescription>Fill out the form below and we'll get back to you as soon as possible</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Brief description of your issue"
                    value={formData.subject}
                    onChange={(e) => handleInputChange("subject", e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => handleInputChange("category", value)}
                      required
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Technical Issue</SelectItem>
                        <SelectItem value="billing">Billing Question</SelectItem>
                        <SelectItem value="license">License Key Issue</SelectItem>
                        <SelectItem value="installation">Installation Help</SelectItem>
                        <SelectItem value="feature">Feature Request</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => handleInputChange("priority", value)}
                      required
                    >
                      <SelectTrigger id="priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Please describe your issue in detail..."
                    value={formData.message}
                    onChange={(e) => handleInputChange("message", e.target.value)}
                    rows={12}
                    className="min-h-[300px] w-full"
                    required
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSubmitting} size="lg">
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Support Tickets</CardTitle>
              <CardDescription>View and track all your support requests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tickets..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="license">License</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={(value) => { setPriorityFilter(value); setPage(1); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tickets List */}
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading tickets...</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No tickets found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{ticket.ticketNumber}</h3>
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                          </div>
                          <p className="font-medium mb-1">{ticket.subject}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">{ticket.message}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{ticket.category}</span>
                            <span>•</span>
                            <span>{format(new Date(ticket.createdAt), "MMM dd, yyyy")}</span>
                            {ticket.respondedAt && (
                              <>
                                <span>•</span>
                                <span>Responded {format(new Date(ticket.respondedAt), "MMM dd")}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ticket Detail Modal */}
          {selectedTicket && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedTicket.ticketNumber}</CardTitle>
                    <CardDescription>{selectedTicket.subject}</CardDescription>
                  </div>
                  <Button variant="ghost" onClick={() => setSelectedTicket(null)}>Close</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedTicket.status)}
                  {getPriorityBadge(selectedTicket.priority)}
                  <Badge variant="outline">{selectedTicket.category}</Badge>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Your Message</h4>
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted {format(new Date(selectedTicket.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                  </p>
                </div>
                {selectedTicket.response && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Support Response</h4>
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket.response}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedTicket.respondedAt
                        ? `Responded ${format(new Date(selectedTicket.respondedAt), "MMM dd, yyyy 'at' h:mm a")}`
                        : "No response yet"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
