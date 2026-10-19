"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as LucideIcons from "lucide-react";

// Popular icons for features
const POPULAR_ICONS = [
  "Sparkles",
  "Zap",
  "Rocket",
  "Star",
  "Heart",
  "Shield",
  "Lock",
  "Unlock",
  "Key",
  "Bell",
  "Download",
  "Upload",
  "RefreshCw",
  "Settings",
  "Filter",
  "Search",
  "Users",
  "User",
  "Mail",
  "Phone",
  "Calendar",
  "Clock",
  "ChartBar",
  "TrendingUp",
  "Database",
  "Server",
  "Cloud",
  "Package",
  "Layers",
  "Grid",
  "List",
  "BarChart",
  "PieChart",
  "Activity",
  "Target",
  "Award",
  "Gift",
  "Flag",
];

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIcons = search
    ? POPULAR_ICONS.filter((icon) =>
        icon.toLowerCase().includes(search.toLowerCase())
      )
    : POPULAR_ICONS;

  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  const Icon = icons[value] || LucideIcons.Sparkles;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
        >
          <Icon className="h-4 w-4 mr-2" />
          {value || "Select icon"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ScrollArea className="h-64">
            <div className="grid grid-cols-6 gap-2">
              {filteredIcons.map((iconName) => {
                const IconComponent = icons[iconName];
                return (
                  <Button
                    key={iconName}
                    type="button"
                    variant={value === iconName ? "default" : "ghost"}
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => {
                      onChange(iconName);
                      setOpen(false);
                    }}
                  >
                    <IconComponent className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
