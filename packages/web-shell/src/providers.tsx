"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "@repo/ui";
import { SessionProvider } from "@repo/web-shared";

export const Providers = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
