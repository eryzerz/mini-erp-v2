"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface DatePickerProps {
  id?: string;
  value?: string;
  placeholder?: string;
  onChange: (isoDate: string) => void;
}

export function DatePicker({ id, value, placeholder = "Pick a date", onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [timeZone, setTimeZone] = useState<string | undefined>(undefined);
  const date = value ? new Date(`${value}T00:00:00`) : undefined;

  // The timezone is detected client-side so the calendar selects and
  // highlights dates in the user's local timezone, and so SSR never sees it.
  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd MMM yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selected: Date | undefined) => {
            if (selected) {
              // Local date, not UTC: toISOString() would shift the day back
              // for timezones east of UTC (e.g. WIB, UTC+7).
              onChange(format(selected, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
          timeZone={timeZone}
          weekStartsOn={1}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
