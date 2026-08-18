import type { Metadata } from "next";
import { Providers } from "@repo/web-shell";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SLM ERP — Invoicing",
    template: "%s · SLM ERP",
  },
  description: "Mini ERP invoicing system",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
