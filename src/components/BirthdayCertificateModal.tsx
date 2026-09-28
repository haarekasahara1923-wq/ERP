import React, { useEffect, useState } from 'react';
import Script from 'next/script';

export function BirthdayCertificateModal({ isOpen, onClose, student, school }: any) {
  const [isPdfReady, setIsPdfReady] = useState(false);

  if (!isOpen || !student || !school) return null;

  const downloadPDF = () => {
    const element = document.getElementById(`birthday-certificate-${student.id}`);
    if (!element) return;
    const opt = {
      margin: 0,
      filename: `${student.fullName}_Birthday_Certificate.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    // @ts-ignore
    window.html2pdf().set(opt).from(element).save();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" onLoad={() => setIsPdfReady(true)} />
      
      <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '-40px', right: '0',
            background: 'none', border: 'none', color: 'white',
            fontSize: '30px', cursor: 'pointer'
          }}
        >
          &times;
        </button>

        {/* Certificate Wrapper for PDF */}
        <div 
          id={`birthday-certificate-${student.id}`}
          style={{
            width: '10in', // approx letter landscape
            height: '7.5in',
            background: '#ffffff',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(243,244,246,1) 100%)',
            border: `10px solid ${school.themeColor || '#6366f1'}`,
            padding: '40px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'serif',
            color: '#1f2937',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}
        >
          {/* Decorative Corner Ornaments */}
          <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '60px', color: school.themeColor || '#6366f1', opacity: 0.2 }}>🎉</div>
          <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '60px', color: school.themeColor || '#6366f1', opacity: 0.2 }}>🎉</div>
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', fontSize: '60px', color: school.themeColor || '#6366f1', opacity: 0.2 }}>🎈</div>
          <div style={{ position: 'absolute', bottom: '10px', right: '10px', fontSize: '60px', color: school.themeColor || '#6366f1', opacity: 0.2 }}>🎈</div>

          {/* School Branding */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
            {school.logo && <img src={school.logo} alt="School Logo" style={{ height: '80px', objectFit: 'contain' }} crossOrigin="anonymous" />}
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: school.themeColor || '#6366f1', textTransform: 'uppercase' }}>
              {school.name}
            </h1>
          </div>

          <h2 style={{ fontSize: '48px', color: '#f59e0b', margin: '0 0 20px 0', fontWeight: 'bold', textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
            Happy Birthday!
          </h2>

          <p style={{ fontSize: '24px', margin: '20px 0', fontStyle: 'italic', color: '#4b5563' }}>
            This special birthday wish is presented to
          </p>

          <h3 style={{ fontSize: '42px', margin: '10px 0', color: '#111827', textDecoration: 'underline', textDecorationColor: school.themeColor || '#6366f1' }}>
            {student.fullName}
          </h3>

          <div style={{ fontSize: '20px', margin: '30px 0', textAlign: 'center', color: '#374151', lineHeight: '1.5', maxWidth: '80%' }}>
            <p style={{ margin: '5px 0' }}>Child of <strong>{student.fatherName || student.parentLinks?.[0]?.name || 'Parents'}</strong></p>
            <p style={{ margin: '5px 0' }}>Born on <strong>{student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : 'this day'}</strong></p>
          </div>

          <p style={{ fontSize: '22px', margin: '10px 0', color: '#4b5563', maxWidth: '600px', textAlign: 'center' }}>
            Wishing you a fantastic day filled with joy, laughter, and a wonderful year ahead!
          </p>

          <div style={{ marginTop: 'auto', display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'flex-end' }}>
             <div style={{ borderTop: '2px solid #9ca3af', width: '200px', textAlign: 'center', paddingTop: '10px', fontSize: '18px' }}>
                Class Teacher
             </div>
             <div style={{ borderTop: '2px solid #9ca3af', width: '200px', textAlign: 'center', paddingTop: '10px', fontSize: '18px' }}>
                Principal
             </div>
          </div>
        </div>

        {/* Download Action */}
        <button
          onClick={downloadPDF}
          style={{
            marginTop: '20px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '16px',
            cursor: 'pointer',
            opacity: isPdfReady ? 1 : 0.6
          }}
        >
          🎁 Download Certificate
        </button>
      </div>
    </div>
  );
}
