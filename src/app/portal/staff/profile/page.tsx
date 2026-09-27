'use client'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect } from 'react'

export default function StaffProfile() {
  const { user, token } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  
  useEffect(() => {
    if (!token || !user) return
    // Match teacher profile by email
    fetch('/api/teachers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const myProfile = d.data.find((t: any) => t.email === user.email || t.phone === user.phone)
          if (myProfile) setProfile(myProfile)
        }
      })
  }, [token, user])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '800', color: 'white', margin: 0 }}>?? My Profile</h1>
      
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '24px', display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', color: 'white', fontWeight: 'bold' }}>
          {user?.name?.charAt(0) || 'T'}
        </div>
        
        <div style={{ flex: 1, minWidth: '250px' }}>
          <h2 style={{ fontSize: '24px', margin: '0 0 8px 0', color: 'white' }}>{user?.name}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#94a3b8', fontSize: '14px' }}>
            <div>?? Email: {user?.email}</div>
            <div>?? Phone: {user?.phone || profile?.phone || 'N/A'}</div>
            <div>??? Role: {user?.role}</div>
            
            {profile && (
              <>
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
                  <div style={{ color: 'white', fontWeight: 'bold', marginBottom: '8px' }}>Teacher Details</div>
                  <div>?? Joined: {new Date(profile.joinDate).toLocaleDateString('en-IN')}</div>
                  <div>?? Subjects: {profile.subject?.join(', ') || 'None'}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

