"use client";

import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const pageWindow = (page: number, totalPages: number): (number | "...")[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (page > 3) pages.push("...");
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p);
  if (page < totalPages - 2) pages.push("...");
  pages.push(totalPages);
  return pages;
};

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  return (
    <nav className="flex items-center justify-between gap-2" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeftIcon /> Previous
      </Button>
      <div className="flex items-center gap-1">
        {pageWindow(page, totalPages).map((item, index) =>
          item === "..." ? (
            <span key={`ellipsis-${index}`} className="px-1 text-muted-foreground">
              <MoreHorizontalIcon className="h-4 w-4" />
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onChange(item)}
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "h-9 w-9 rounded-md text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                item === page && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {item}
            </button>
          ),
        )}
      </div>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next <ChevronRightIcon />
      </Button>
    </nav>
  );
}
