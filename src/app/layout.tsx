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
      <body suppressHydrationWarning>
        {/* Screenshot / Screen-capture shield overlay */}
        <div id="screenshot-shield" className="screenshot-shield" aria-hidden="true" />

        {children}

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
