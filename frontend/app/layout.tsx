import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import Navbar from "@/components/Navbar";
import DemoDataSeeder from "@/components/DemoDataSeeder";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MedBridge — AI Medical History Bridge",
  description: "Transform fragmented medical history into a verified clinical bridge. AI-powered document extraction, timeline, medication safety, triage cards and FHIR export.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProvider>
          <DemoDataSeeder />
          <Navbar />
          <main className="pt-16">{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
