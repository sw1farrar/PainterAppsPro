import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SettingsModalProvider } from "@/components/settings/settings-modal-provider";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "PainterApps Pro",
  description: "Local-first paint job estimating for professional contractors",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full`}
    >
      <body className="flex h-full min-h-screen overflow-hidden antialiased">
        <TooltipProvider delay={200}>
          <SettingsModalProvider>
            <AppSidebar />
            <main className="flex min-w-0 flex-1 flex-col overflow-auto p-3">
              {children}
            </main>
            <Toaster position="bottom-right" richColors closeButton />
          </SettingsModalProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
