import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snaplyst",
  description: "Image upload and management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
