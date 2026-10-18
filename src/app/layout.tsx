import type { Metadata } from "next";
import "./globals.css";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
    { media: "(prefers-color-scheme: light)", color: "#f97316" },
  ],
};

export const metadata: Metadata = {
  title: "Scalevo — Multitenant School ERP Platform",
  description: "Scalevo is a complete multitenant School ERP platform — manage students, fees, attendance, exams, transport and parent communication. Register your school for free.",
  keywords: "Scalevo, School ERP, School Management System, student portal, fee management, multitenant school software",
  manifest: "/manifest.json?v=3",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Scalevo",
    startupImage: [
      { url: "/icons/icon-512x512.png?v=3" },
    ],
  },
  openGraph: {
    title: "Scalevo — School ERP Platform",
    description: "Complete multitenant School ERP — Register your school free on Scalevo",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/icons/icon-96x96.png?v=3", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-192x192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png?v=3", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png?v=3", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png?v=3", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icons/icon-192x192.png?v=3",
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

        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json?v=3" />
        <meta name="application-name" content="Scalevo" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Scalevo" />
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png?v=3" />
        <meta name="msapplication-config" content="/browserconfig.xml?v=3" />

        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png?v=3" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png?v=3" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png?v=3" />

        {/* Favicons */}
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png?v=3" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png?v=3" />
      </head>
      <body suppressHydrationWarning>
        {/* Screenshot / Screen-capture shield overlay */}
        <div id="screenshot-shield" className="screenshot-shield" aria-hidden="true" />

        {children}

        {/* PWA Install Prompt */}
        <PWAInstallPrompt />

        {/* Screenshot prevention script */}
        <script dangerouslySetInnerHTML={{ __html: `
(function() {
  var shield = document.getElementById('screenshot-shield');
  function showShield() {
    if (shield) shield.classList.add('active');
    setTimeout(function() { if (shield) shield.classList.remove('active'); }, 800);
  }
  // Block Print Screen and common screenshot shortcuts
  document.addEventListener('keydown', function(e) {
    // PrtSc / PrintScreen
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      showShield();
      e.preventDefault();
      // Corrupt clipboard
      try { navigator.clipboard.writeText(''); } catch(_) {}
    }
    // Windows Snipping: Win+Shift+S (keyCode 83 + metaKey/shiftKey) — best effort
    if (e.key === 'S' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
      showShield();
    }
    // macOS: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
    if (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) {
      showShield();
    }
    // Block Ctrl+P (print)
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      showShield();
    }
  });
  // Block right-click context menu (prevents "Save image as")
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  // Block drag (prevents drag-to-copy content)
  document.addEventListener('dragstart', function(e) {
    e.preventDefault();
  });
  // Screen Capture API — detect screen sharing
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', function() {});
  }
  // visibilitychange — when tab is hidden (often happens during screen record)
  document.addEventListener('visibilitychange', function() {
    if (document.hidden && shield) {
      shield.classList.add('active');
    } else if (shield) {
      shield.classList.remove('active');
    }
  });
})();
        ` }} />
      </body>
    </html>
  );
}
