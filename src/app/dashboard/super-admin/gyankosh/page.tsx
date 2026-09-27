'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminGyankosh() {
    const { token } = useAuth()
    const [products, setProducts] = useState<any[]>([])
    const [orders, setOrders] = useState<any[]>([])
    const [withdrawals, setWithdrawals] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'withdrawals'>('products')
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [formData, setFormData] = useState({
        title: '', description: '', category: 'COURSE_MATERIAL',
        price: 0, discount: 0, imageUrl: '', fileUrl: '',
        bonuses: [] as any[],
        orderBumps: [] as any[]
    })

    const authHeaders = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [pRes, wRes] = await Promise.all([
                fetch('/api/super-admin/gyankosh/products', { headers: authHeaders }),
                fetch('/api/super-admin/gyankosh/withdrawals', { headers: authHeaders })
            ])
            const pData = await pRes.json()
            const wData = await wRes.json()
            if (pData.products) { setProducts(pData.products); setOrders(pData.orders || []) }
            if (Array.isArray(wData)) setWithdrawals(wData)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const handleFileUpload = async (file: File) => {
        const uploadForm = new FormData()
        uploadForm.append('file', file)
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: uploadForm
        })
        const data = await res.json()
        if (data.url) return data.url
        throw new Error(data.error || 'Upload failed')
    }

    const handleSaveProduct = async () => {
        if (!formData.title || formData.price <= 0) { alert('Title and Price are required.'); return }
        try {
            const body = editingId ? { ...formData, id: editingId, action: 'edit' } : formData
            const method = editingId ? 'PUT' : 'POST'
            const res = await fetch('/api/super-admin/gyankosh/products', {
                method, headers: authHeaders, body: JSON.stringify(body)
            })
            if (res.ok) {
                alert(editingId ? 'Product updated!' : 'Product created!')
                setShowModal(false)
                setEditingId(null)
                setFormData({ title: '', description: '', category: 'COURSE_MATERIAL', price: 0, discount: 0, imageUrl: '', fileUrl: '', bonuses: [], orderBumps: [] })
                fetchData()
            }
            else alert('Failed to save product.')
        } catch (e) { console.error(e) }
    }

    const handleToggleProduct = async (id: string, isActive: boolean) => {
        try {
            await fetch('/api/super-admin/gyankosh/products', {
                method: 'PUT', headers: authHeaders,
                body: JSON.stringify({ id, isActive, action: 'toggle' })
            })
            fetchData()
        } catch (e) { console.error(e) }
    }

    const handleWithdrawalStatus = async (id: string, status: string) => {
        if (!window.confirm(`Mark this withdrawal as ${status}?`)) return
        try {
            const res = await fetch('/api/super-admin/gyankosh/withdrawals', {
                method: 'PUT', headers: authHeaders,
                body: JSON.stringify({ id, status })
            })
            if (res.ok) { alert('Updated!'); fetchData() }
        } catch (e) { console.error(e) }
    }

    const addBonus = () => {
        if (formData.bonuses.length >= 5) { alert('Maximum 5 bonuses allowed'); return }
        setFormData({ ...formData, bonuses: [...formData.bonuses, { title: '', description: '', imageUrl: '', fileUrl: '', originalPrice: 0 }] })
    }

    const updateBonus = (index: number, field: string, value: any) => {
        const newBonuses = [...formData.bonuses]
        newBonuses[index] = { ...newBonuses[index], [field]: value }
        setFormData({ ...formData, bonuses: newBonuses })
    }

    const removeBonus = (index: number) => {
        setFormData({ ...formData, bonuses: formData.bonuses.filter((_, i) => i !== index) })
    }

    const addOrderBump = () => {
        if (formData.orderBumps.length >= 3) { alert('Maximum 3 order bumps allowed'); return }
        setFormData({ ...formData, orderBumps: [...formData.orderBumps, { title: '', description: '', imageUrl: '', fileUrl: '', originalPrice: 0, discountedPrice: 0 }] })
    }

    const updateOrderBump = (index: number, field: string, value: any) => {
        const newBumps = [...formData.orderBumps]
        newBumps[index] = { ...newBumps[index], [field]: value }
        setFormData({ ...formData, orderBumps: newBumps })
    }

    const removeOrderBump = (index: number) => {
        setFormData({ ...formData, orderBumps: formData.orderBumps.filter((_, i) => i !== index) })
    }

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>

    const tabs = [
        { key: 'products', label: '📦 Products', count: products.length },
        { key: 'orders', label: '🧾 Orders', count: orders.length },
        { key: 'withdrawals', label: '💸 Withdrawals', count: withdrawals.length },
    ]

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>🛒 Gyankosh Administration</h2>
                <button className="btn btn-primary" onClick={() => { setEditingId(null); setFormData({ title: '', description: '', category: 'COURSE_MATERIAL', price: 0, discount: 0, imageUrl: '', fileUrl: '', bonuses: [], orderBumps: [] }); setShowModal(true); }}>+ Add Product</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', border: 'none',
                            background: activeTab === tab.key ? 'var(--primary)' : 'var(--surface)',
                            color: activeTab === tab.key ? 'white' : 'var(--text-secondary)'
                        }}>
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {/* Products Tab */}
            {activeTab === 'products' && (
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr><th>Title</th><th>Category</th><th>Price</th><th>Discount</th><th>Drive Link</th><th>Status</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                {products.map(p => (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: '600' }}>{p.title}</td>
                                        <td><span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>{p.category.replace('_', ' ')}</span></td>
                                        <td>₹{p.price}</td>
                                        <td>{p.discount}%</td>
                                        <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p.fileUrl ? <a href={p.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '12px' }}>🔗 View Link</a> : '—'}
                                        </td>
                                        <td>
                                            <span className={`badge ${p.isActive ? 'badge-success' : 'badge-danger'}`}>{p.isActive ? 'Active' : 'Inactive'}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn btn-sm btn-primary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => { setEditingId(p.id); setFormData({ title: p.title, description: p.description || '', category: p.category, price: p.price, discount: p.discount, imageUrl: p.imageUrl || '', fileUrl: p.fileUrl || '', bonuses: p.bonuses || [], orderBumps: p.orderBumps || [] }); setShowModal(true); }}>
                                                    ✏️ Edit
                                                </button>
                                                <button className="btn btn-sm btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => handleToggleProduct(p.id, p.isActive)}>
                                                    {p.isActive ? '⛔ Disable' : '✅ Enable'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {products.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No products yet. Click "+ Add Product" to create one.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr><th>Buyer</th><th>Product</th><th>Amount</th><th>Commission</th><th>Affiliate</th><th>Status</th><th>Date</th></tr>
                            </thead>
                            <tbody>
                                {orders.map(o => (
                                    <tr key={o.id}>
                                        <td>
                                            <div style={{ fontWeight: '600', fontSize: '14px' }}>{o.studentName}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{o.email} | {o.phone}</div>
                                        </td>
                                        <td style={{ fontSize: '14px' }}>{o.product?.title || '—'}</td>
                                        <td style={{ fontWeight: '700', color: '#10b981' }}>₹{o.amount}</td>
                                        <td style={{ fontWeight: '600', color: '#f59e0b' }}>₹{o.commissionAmount}</td>
                                        <td style={{ fontSize: '12px' }}>{o.affiliateTenantId || '—'}</td>
                                        <td><span className={`badge ${o.status === 'SUCCESS' ? 'badge-success' : o.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>{o.status}</span></td>
                                        <td style={{ fontSize: '12px' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                                {orders.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No orders yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Withdrawals Tab */}
            {activeTab === 'withdrawals' && (
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr><th>Coaching</th><th>Amount</th><th>Status</th><th>Requested</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {withdrawals.map(w => (
                                    <tr key={w.id}>
                                        <td>
                                            <div style={{ fontWeight: '600' }}>{w.tenant?.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>UPI: {w.tenant?.upiId || 'N/A'} | A/C: {w.tenant?.bankAccountNo || 'N/A'}</div>
                                        </td>
                                        <td style={{ fontWeight: '700' }}>₹{w.amount}</td>
                                        <td><span className={`badge ${w.status === 'PENDING' ? 'badge-warning' : w.status === 'PAID' ? 'badge-success' : 'badge-danger'}`}>{w.status}</span></td>
                                        <td style={{ fontSize: '12px' }}>{new Date(w.requestedAt).toLocaleDateString()}</td>
                                        <td>
                                            {w.status === 'PENDING' && (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button style={{ padding: '4px 10px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                                        onClick={() => handleWithdrawalStatus(w.id, 'PAID')}>✅ Paid</button>
                                                    <button style={{ padding: '4px 10px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                                        onClick={() => handleWithdrawalStatus(w.id, 'REJECTED')}>❌ Reject</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {withdrawals.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No withdrawal requests.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add/Edit Product Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditingId(null); } }}>
                    <div className="modal" style={{ width: '700px', maxWidth: '95vw' }}>
                        <div className="modal-header">
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>{editingId ? '✏️ Edit Digital Product' : '📦 Add New Digital Product'}</h2>
                            <button onClick={() => { setShowModal(false); setEditingId(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: 'calc(95vh - 120px)', overflowY: 'auto' }}>
                            {/* Main Product Info */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Primary Details</h3>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Product Title *</label>
                                    <input type="text" className="input" style={{ width: '100%' }} value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., NEET Physics Complete Notes" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Description</label>
                                    <textarea className="input" style={{ width: '100%', minHeight: '60px' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Category</label>
                                        <select className="input" style={{ width: '100%' }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                            <option value="COURSE_MATERIAL">Course Material</option>
                                            <option value="MOCK_TEST">Mock Test</option>
                                            <option value="QUESTION_BANK">Question Bank</option>
                                            <option value="OLD_PAPER">Old Paper</option>
                                            <option value="INFOGRAPHIC">Infographic</option>
                                            <option value="EBOOK">E-Book</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Price (₹) *</label>
                                            <input type="number" className="input" style={{ width: '100%' }} value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Discount (%)</label>
                                            <input type="number" className="input" style={{ width: '100%' }} value={formData.discount} onChange={e => setFormData({ ...formData, discount: Number(e.target.value) })} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>📷 Cover Image *</label>
                                    <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }}
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0]
                                            if (!file) return
                                            setUploading(true)
                                            try {
                                                const url = await handleFileUpload(file)
                                                if (url) setFormData(prev => ({ ...prev, imageUrl: url }))
                                            } catch (err) { console.error(err); alert('Upload failed.') }
                                            setUploading(false)
                                        }}
                                    />
                                    {formData.imageUrl ? (
                                        <div style={{ position: 'relative' }}>
                                            <img src={formData.imageUrl} alt="Cover" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                            <button onClick={() => { setFormData({ ...formData, imageUrl: '' }); if (fileInputRef.current) fileInputRef.current.value = '' }}
                                                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                                        </div>
                                    ) : (
                                        <div onClick={() => !uploading && fileInputRef.current?.click()}
                                            style={{ border: '2px dashed var(--border)', borderRadius: '8px', padding: '16px', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer', background: 'rgba(99,102,241,0.03)' }}>
                                            {uploading ? '⏳ Uploading...' : '📷 Click to upload main cover'}
                                        </div>
                                    )}
                                </div>

                                <div style={{ background: 'rgba(16,185,129,0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#10b981' }}>📁 Main Product Drive Link *</label>
                                    <input type="text" className="input" style={{ width: '100%' }} value={formData.fileUrl} onChange={e => setFormData({ ...formData, fileUrl: e.target.value })} placeholder="https://drive.google.com/..." />
                                </div>
                            </div>

                            {/* BONUS PRODUCTS */}
                            <div style={{ padding: '16px', background: 'rgba(16,185,129,0.03)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: 'bold' }}>🎁 Bonus Products (Max 5)</h3>
                                    <button className="btn btn-sm btn-success" onClick={addBonus}>+ Add Bonus</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {formData.bonuses?.map((bonus: any, idx: number) => (
                                        <div key={idx} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border)', position: 'relative' }}>
                                            <button onClick={() => removeBonus(idx)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                                <input type="text" className="input" placeholder="Bonus Title" value={bonus.title} onChange={e => updateBonus(idx, 'title', e.target.value)} />
                                                <input type="number" className="input" placeholder="Original Price (₹)" value={bonus.originalPrice} onChange={e => updateBonus(idx, 'originalPrice', Number(e.target.value))} />
                                            </div>
                                            <textarea className="input" placeholder="Bonus Description" style={{ marginBottom: '10px', minHeight: '40px' }} value={bonus.description} onChange={e => updateBonus(idx, 'description', e.target.value)} />
                                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px' }}>
                                                <input type="file" accept="image/*" id={`bonus-img-${idx}`} style={{ display: 'none' }} 
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            const url = await handleFileUpload(file)
                                                            if (url) updateBonus(idx, 'imageUrl', url)
                                                        }
                                                    }}
                                                />
                                                <div onClick={() => document.getElementById(`bonus-img-${idx}`)?.click()} style={{ width: '100%', height: '80px', border: '1px dashed var(--border)', borderRadius: '6px', cursor: 'pointer', overflow: 'hidden' }}>
                                                    {bonus.imageUrl ? <img src={bonus.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '10px' }}>Upload Img</div>}
                                                </div>
                                                <input type="text" className="input" placeholder="Bonus Drive Link" value={bonus.fileUrl} onChange={e => updateBonus(idx, 'fileUrl', e.target.value)} />
                                            </div>
                                        </div>
                                    ))}
                                    {formData.bonuses?.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No bonuses added yet.</p>}
                                </div>
                            </div>

                            {/* ORDER BUMPS */}
                            <div style={{ padding: '16px', background: 'rgba(99,102,241,0.03)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: 'bold' }}>🚀 Order Bump Products (Max 3)</h3>
                                    <button className="btn btn-sm btn-primary" onClick={addOrderBump}>+ Add Bump</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {formData.orderBumps?.map((bump: any, idx: number) => (
                                        <div key={idx} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border)', position: 'relative' }}>
                                            <button onClick={() => removeOrderBump(idx)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                                            <input type="text" className="input" placeholder="Bump Title" style={{ marginBottom: '8px' }} value={bump.title} onChange={e => updateOrderBump(idx, 'title', e.target.value)} />
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                                                <input type="number" className="input" placeholder="Orig. Price (₹)" value={bump.originalPrice} onChange={e => updateOrderBump(idx, 'originalPrice', Number(e.target.value))} />
                                                <input type="number" className="input" placeholder="Disc. Price (₹)" value={bump.discountedPrice} onChange={e => updateOrderBump(idx, 'discountedPrice', Number(e.target.value))} />
                                            </div>
                                            <textarea className="input" placeholder="Bump Description" style={{ marginBottom: '8px', minHeight: '40px' }} value={bump.description} onChange={e => updateOrderBump(idx, 'description', e.target.value)} />
                                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px' }}>
                                                <input type="file" accept="image/*" id={`bump-img-${idx}`} style={{ display: 'none' }} 
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            const url = await handleFileUpload(file)
                                                            if (url) updateOrderBump(idx, 'imageUrl', url)
                                                        }
                                                    }}
                                                />
                                                <div onClick={() => document.getElementById(`bump-img-${idx}`)?.click()} style={{ width: '100%', height: '80px', border: '1px dashed var(--border)', borderRadius: '6px', cursor: 'pointer', overflow: 'hidden' }}>
                                                    {bump.imageUrl ? <img src={bump.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '10px' }}>Upload Img</div>}
                                                </div>
                                                <input type="text" className="input" placeholder="Bump Drive Link" value={bump.fileUrl} onChange={e => updateOrderBump(idx, 'fileUrl', e.target.value)} />
                                            </div>
                                        </div>
                                    ))}
                                    {formData.orderBumps?.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No order bumps added yet.</p>}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingId(null); }}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveProduct}>{editingId ? 'Update Product' : 'Save Product'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
