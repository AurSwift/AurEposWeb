"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X } from "lucide-react";
import { ImageUploader } from "@/components/admin/image-uploader";
import { IconPicker } from "@/components/admin/icon-picker";
import Link from "next/link";

const releaseFormSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in format X.Y.Z"),
  releaseDate: z.string(),
  title: z.string().min(1).max(255),
  summary: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  isMajor: z.boolean().optional(),
  type: z.enum(["major", "minor", "patch"]),
  features: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      icon: z.string().min(1),
    })
  ),
  improvements: z.array(
    z.object({
      description: z.string().min(1),
    })
  ),
  fixes: z.array(
    z.object({
      description: z.string().min(1),
    })
  ),
  published: z.boolean().optional(),
});

type ReleaseFormValues = z.infer<typeof releaseFormSchema>;

interface ReleaseFormProps {
  initialData?: {
    id: string;
    version: string;
    releaseDate: string | Date;
    title: string;
    summary: string;
    imageUrl: string | null;
    isMajor: boolean;
    type: string;
    features: unknown;
    improvements: unknown;
    fixes: unknown;
    published: boolean;
  };
}

export function ReleaseForm({ initialData }: ReleaseFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReleaseFormValues>({
    resolver: zodResolver(releaseFormSchema),
    defaultValues: initialData
      ? {
          version: initialData.version,
          releaseDate: initialData.releaseDate
            ? new Date(initialData.releaseDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          title: initialData.title,
          summary: initialData.summary,
          imageUrl: initialData.imageUrl || "",
          isMajor: initialData.isMajor || false,
          type: initialData.type === "major" || initialData.type === "patch"
            ? initialData.type
            : "minor",
          features: Array.isArray(initialData.features) && initialData.features.length > 0
            ? initialData.features
            : [],
          improvements: Array.isArray(initialData.improvements) && initialData.improvements.length > 0
            ? initialData.improvements
            : [],
          fixes: Array.isArray(initialData.fixes) && initialData.fixes.length > 0
            ? initialData.fixes
            : [],
          published: initialData.published || false,
        }
      : {
          version: "",
          releaseDate: new Date().toISOString().split("T")[0],
          title: "",
          summary: "",
          imageUrl: "",
          isMajor: false,
          type: "minor",
          features: [],
          improvements: [],
          fixes: [],
          published: false,
        },
  });

  const {
    fields: featureFields,
    append: appendFeature,
    remove: removeFeature,
  } = useFieldArray({
    control: form.control,
    name: "features",
  });

  const {
    fields: improvementFields,
    append: appendImprovement,
    remove: removeImprovement,
  } = useFieldArray({
    control: form.control,
    name: "improvements",
  });

  const {
    fields: fixFields,
    append: appendFix,
    remove: removeFix,
  } = useFieldArray({
    control: form.control,
    name: "fixes",
  });

  const onSubmit = async (data: ReleaseFormValues) => {
    setIsSubmitting(true);

    try {
      const url = initialData
        ? `/api/admin/releases/${initialData.id}`
        : "/api/admin/releases";
      const method = initialData ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save release");
      }

      toast({
        title: "Success",
        description: `Release ${initialData ? "updated" : "created"} successfully`,
      });

      router.push("/admin/releases");
      router.refresh();
    } catch (error) {
      console.error("Error saving release:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save release",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Version *</FormLabel>
                    <FormControl>
                      <Input placeholder="1.39.0" {...field} />
                    </FormControl>
                    <FormDescription>Semantic version (X.Y.Z)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="releaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Release Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Smarter Updates & Better Stability"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Summary *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief 1-2 sentence description of this release..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Release Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="major">Major</SelectItem>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="patch">Patch</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isMajor"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Mark as Major Release</FormLabel>
                      <FormDescription>
                        Featured prominently in release notes
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hero Image</FormLabel>
                  <FormControl>
                    <ImageUploader
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional image for this release (max 5MB)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Features Section */}
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {featureFields.map((field, index) => (
              <div key={field.id} className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Feature {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFeature(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name={`features.${index}.icon`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <FormControl>
                        <IconPicker value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`features.${index}.title`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Feature title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`features.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Feature description"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                appendFeature({ title: "", description: "", icon: "Sparkles" })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Feature
            </Button>
          </CardContent>
        </Card>

        {/* Improvements Section */}
        <Card>
          <CardHeader>
            <CardTitle>Improvements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {improvementFields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <FormField
                  control={form.control}
                  name={`improvements.${index}.description`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="Improvement description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeImprovement(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => appendImprovement({ description: "" })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Improvement
            </Button>
          </CardContent>
        </Card>

        {/* Bug Fixes Section */}
        <Card>
          <CardHeader>
            <CardTitle>Bug Fixes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fixFields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <FormField
                  control={form.control}
                  name={`fixes.${index}.description`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="Bug fix description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFix(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => appendFix({ description: "" })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Bug Fix
            </Button>
          </CardContent>
        </Card>

        {/* Publishing */}
        <Card>
          <CardContent className="pt-6">
            <FormField
              control={form.control}
              name="published"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Publish Release</FormLabel>
                    <FormDescription>
                      Make this release visible to customers
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initialData ? "Update Release" : "Create Release"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/releases">Cancel</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
