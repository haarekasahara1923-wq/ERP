import React, { useState } from 'react';
import Script from 'next/script';

export function StudentIdCard({ student, school }: any) {
  const [isPdfReady, setIsPdfReady] = useState(false);

  const downloadPDF = () => {
    const element = document.getElementById(`id-card-${student.id}`);
    if (!element) return;
    const opt = {
      margin: 0,
      filename: `${student.fullName}_ID_Card.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true },
      jsPDF: { unit: 'in', format: [2.125, 3.375], orientation: 'portrait' } // CR-80 standard ID size
    };
    // @ts-ignore
    window.html2pdf().set(opt).from(element).save();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" onLoad={() => setIsPdfReady(true)} />
      
      {/* ID Card Display */}
      <div 
        id={`id-card-${student.id}`} 
        style={{ 
          width: '2.125in', 
          height: '3.375in', 
          background: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          fontFamily: 'sans-serif',
          color: '#0f172a'
        }}
      >
        {/* Header Branding */}
        <div style={{ 
          background: school.themeColor || '#6366f1', 
          color: 'white', 
          padding: '10px 8px 8px 8px', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px'
        }}>
          {school.logo ? (
            <img src={school.logo} alt="Logo" style={{ height: '28px', maxWidth: '80px', objectFit: 'contain' }} crossOrigin="anonymous" />
          ) : (
            <div style={{ fontSize: '18px' }}>🏫</div>
          )}
          <div style={{ fontSize: '11px', fontWeight: '800', lineHeight: 1.15 }}>{school.name}</div>
          {((school.registrationCode || school.schoolCode) || school.diseCode) && (
            <div style={{ fontSize: '7px', opacity: 0.95, fontWeight: '700', display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {(school.registrationCode || school.schoolCode) && <span>ID: {school.registrationCode || school.schoolCode}</span>}
              {(school.registrationCode || school.schoolCode) && school.diseCode && <span>•</span>}
              {school.diseCode && <span>DISE: {school.diseCode}</span>}
            </div>
          )}
        </div>

        {/* Student Info */}
        <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '6px', 
            background: '#e2e8f0', 
            overflow: 'hidden',
            border: `2px solid ${school.themeColor || '#6366f1'}`
          }}>
            {student.photo ? (
              <img src={student.photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🧑‍🎓</div>
            )}
          </div>
          
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: school.themeColor || '#6366f1', marginBottom: '1px' }}>{student.fullName}</div>
            <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '600' }}>{student.course?.name || student.courseName || 'Class'} {student.batch?.name ? `(${student.batch.name})` : (student.batchName ? `(${student.batchName})` : '')}</div>
          </div>

          <div style={{ width: '100%', marginTop: 'auto', display: 'grid', gridTemplateColumns: '46px 1fr', gap: '3px', fontSize: '8.5px' }}>
            <div style={{ fontWeight: '700', color: '#64748b' }}>Scholar:</div>
            <div style={{ fontWeight: '700', color: '#0f172a' }}>{student.scholarNo || 'N/A'}</div>

            <div style={{ fontWeight: '700', color: '#64748b' }}>F.Name:</div>
            <div style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.fatherName || 'N/A'}</div>
            
            <div style={{ fontWeight: '700', color: '#64748b' }}>DOB:</div>
            <div style={{ fontWeight: '600' }}>{student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : 'N/A'}</div>
            
            <div style={{ fontWeight: '700', color: '#64748b' }}>ID No:</div>
            <div style={{ fontWeight: '600' }}>{student.studentId || (student.id ? student.id.slice(0, 8).toUpperCase() : 'N/A')}</div>
            
            <div style={{ fontWeight: '700', color: '#64748b' }}>Phone:</div>
            <div style={{ fontWeight: '600' }}>{student.phone || student.parentPhone || 'N/A'}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', padding: '5px 4px', textAlign: 'center', fontSize: '6.5px', color: '#64748b', borderTop: '1px solid #e2e8f0', lineHeight: 1.2 }}>
          <div>{school.address || 'Valid for current academic year only.'}</div>
          <div>{school.phone ? `Ph: ${school.phone}` : ''}{school.phone && school.email ? ' | ' : ''}{school.email ? school.email : ''}</div>
        </div>
      </div>

      <button
        onClick={downloadPDF}
        style={{
          background: school.themeColor || '#6366f1',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '8px',
          fontWeight: '700',
          fontSize: '13px',
          cursor: 'pointer',
          opacity: isPdfReady ? 1 : 0.6
        }}
      >
        🖨️ Download ID Card
      </button>
    </div>
  );
}
