'use client'

import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)

  // Register Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope)
          setSwRegistration(reg)

          // Check for SW updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdateBanner(true)
              }
            })
          })
        })
        .catch((err) => console.error('[PWA] SW registration failed:', err))
    }

    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as { standalone?: boolean }).standalone === true) {
      setIsInstalled(true)
    }
  }, [])

  // Capture beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      // Show prompt after 30s delay (not immediately)
      const dismissed = sessionStorage.getItem('pwa-prompt-dismissed')
      const installed = localStorage.getItem('pwa-installed')
      if (!dismissed && !installed) {
        setTimeout(() => setShowPrompt(true), 30000)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Detect successful install
  useEffect(() => {
    const handler = () => {
      setIsInstalled(true)
      setShowPrompt(false)
      localStorage.setItem('pwa-installed', 'true')
    }
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
      localStorage.setItem('pwa-installed', 'true')
    }
    setDeferredPrompt(null)
    setShowPrompt(false)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShowPrompt(false)
    sessionStorage.setItem('pwa-prompt-dismissed', 'true')
  }, [])

  const handleUpdate = useCallback(() => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    setShowUpdateBanner(false)
    window.location.reload()
  }, [swRegistration])

  if (isInstalled) return null

  return (
    <>
      {/* ── Update Banner ── */}
      {showUpdateBanner && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: '#fff',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 2px 20px rgba(99,102,241,0.4)',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔄</span>
            <span>A new version of Scalevo is available!</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleUpdate}
              style={{
                background: '#fff',
                color: '#6366f1',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Update Now
            </button>
            <button
              onClick={() => setShowUpdateBanner(false)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* ── Install Prompt Card ── */}
      {showPrompt && deferredPrompt && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99998,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '360px',
          width: 'calc(100vw - 48px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.2)',
          fontFamily: 'Inter, sans-serif',
          animation: 'slideInUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}>
          {/* Close button */}
          <button
            onClick={handleDismiss}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Dismiss install prompt"
          >
            ×
          </button>

          {/* Icon + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              flexShrink: 0,
              boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
            }}>
              🏫
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', lineHeight: 1.2 }}>
                Install Scalevo
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
                School ERP Platform
              </div>
            </div>
          </div>

          {/* Description */}
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            lineHeight: 1.6,
            marginBottom: '20px',
          }}>
            Install Scalevo on your desktop for faster access, offline support, and a native app-like experience — no browser needed!
          </p>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {[
              ['⚡', 'Instant launch from desktop'],
              ['📴', 'Works offline with cached data'],
              ['🔔', 'Push notifications support'],
              ['🖥️', 'Full-screen native experience'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px' }}>{icon}</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleInstall}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(99,102,241,0.6)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)'
              }}
            >
              📲 Install App
            </button>
            <button
              onClick={handleDismiss}
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  )
}
