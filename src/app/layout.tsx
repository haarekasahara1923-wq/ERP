import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Scalevo — Multitenant School ERP Platform",
  description: "Scalevo is a complete multitenant School ERP platform — manage students, fees, attendance, exams, transport and parent communication. Register your school for free.",
  keywords: "Scalevo, School ERP, School Management System, student portal, fee management, multitenant school software",
  openGraph: {
    title: "Scalevo — School ERP Platform",
    description: "Complete multitenant School ERP — Register your school free on Scalevo",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
