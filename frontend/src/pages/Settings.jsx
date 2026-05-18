import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useNavigate } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import API_BASE, { apiFetch } from '../api.js'
import UserAvatar from '../components/UserAvatar.jsx'

const THEME_CONFIG = {
  dark: { label: 'Dark', icon: '🌙', swatch: '#0ea5e9', bg: '#020617' },
  light: { label: 'Light', icon: '☀️', swatch: '#0ea5e9', bg: '#f1f5f9' },
  ocean: { label: 'Ocean', icon: '🌊', swatch: '#06b6d4', bg: '#0d1f3c' },
  rose: { label: 'Rose', icon: '🌸', swatch: '#ec4899', bg: '#1a0a0f' },
  purple: { label: 'Purple', icon: '💜', swatch: '#8b5cf6', bg: '#0d0a1e' },
}

const BANKS = [
  'State Bank of India', 'Indian Bank','HDFC Bank', 'ICICI Bank', 'Axis Bank',
  'Kotak Mahindra Bank', 'Punjab National Bank', 'Bank of Baroda',
  'Canara Bank', 'Union Bank of India', 'IndusInd Bank',
  'Yes Bank', 'IDFC First Bank', 'Federal Bank', 'South Indian Bank',
  'Other'
]

const emptyForm = { accountHolderName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '', bankName: '', accountType: 'SAVINGS' }

export default function Settings() {
  const { user, logout, updateUser } = useAuth()
  const { theme, changeTheme } = useTheme()
  const { language, languages, changeLanguage, t } = useLanguage()
  const navigate = useNavigate()
  const { setToast } = useOutletContext()

  // Bank accounts
  const [accounts, setAccounts] = useState([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [showAddBank, setShowAddBank] = useState(false)
  const [bankForm, setBankForm] = useState(emptyForm)
  const [addingBank, setAddingBank] = useState(false)
  const [bankError, setBankError] = useState('')
  const [removingId, setRemovingId] = useState(null)

  // Transaction PIN
  const [pinSet, setPinSet] = useState(false)
  const [showPinForm, setShowPinForm] = useState(false)
  const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' })
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState('')

  const [photoLoading, setPhotoLoading] = useState(false)
  const [contacts, setContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [contactForm, setContactForm] = useState({ recipientIdentifier: '', nickname: '' })
  const [contactError, setContactError] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  const fetchAccounts = () => {
    if (!user?.id) return
    apiFetch(`/bank/accounts/${user.id}`)
      .then(r => r.json())
      .then(d => setAccounts(Array.isArray(d) ? d : []))
      .catch(() => setAccounts([]))
      .finally(() => setAccountsLoading(false))
  }

  useEffect(() => { fetchAccounts() }, [user?.id])

  const fetchContacts = () => {
    if (!user?.id) return
    apiFetch('/contacts')
      .then(r => r.ok ? r.json() : [])
      .then(d => setContacts(Array.isArray(d) ? d : []))
      .catch(() => setContacts([]))
      .finally(() => setContactsLoading(false))
  }

  useEffect(() => { fetchContacts() }, [user?.id])

  // Fetch PIN status
  useEffect(() => {
    if (!user?.id) return
    apiFetch('/user/pin-status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPinSet(!!d.pinSet) })
      .catch(() => {})
  }, [user?.id])

  const handleSavePin = async (e) => {
    e.preventDefault()
    setPinError('')
    setPinSuccess('')
    if (!pinForm.newPin.match(/^\d{4,6}$/)) { setPinError('PIN must be 4-6 digits.'); return }
    if (pinForm.newPin !== pinForm.confirmPin) { setPinError('PINs do not match.'); return }
    setPinLoading(true)
    try {
      const body = { newPin: pinForm.newPin }
      if (pinSet) body.currentPin = pinForm.currentPin
      const res = await apiFetch('/user/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) { setPinError(d.error || 'Failed to set PIN.'); return }
      setPinSet(true)
      setPinSuccess(pinSet ? 'PIN changed successfully!' : 'Transaction PIN set successfully!')
      setPinForm({ currentPin: '', newPin: '', confirmPin: '' })
      setShowPinForm(false)
      setToast({ type: 'success', icon: '🔐', message: pinSet ? 'Transaction PIN updated!' : 'Transaction PIN set!', duration: 3000 })
    } catch {
      setPinError('Failed to set PIN. Try again.')
    } finally {
      setPinLoading(false)
    }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const handleProfilePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setToast({ type: 'error', message: 'Choose an image file.' })
      return
    }
    if (file.size > 550 * 1024) {
      setToast({ type: 'error', message: 'Choose an image under 550 KB.' })
      return
    }

    setPhotoLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const res = await apiFetch('/user/profile-picture', {
          method: 'PUT',
          body: JSON.stringify({ profilePictureUrl: reader.result }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to update picture.')
        updateUser(data)
        setToast({ type: 'success', message: 'Profile picture updated!' })
      } catch (err) {
        setToast({ type: 'error', message: err.message })
      } finally {
        setPhotoLoading(false)
        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveProfilePhoto = async () => {
    setPhotoLoading(true)
    try {
      const res = await apiFetch('/user/profile-picture', {
        method: 'PUT',
        body: JSON.stringify({ profilePictureUrl: '' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to remove picture.')
      updateUser(data)
      setToast({ type: 'info', message: 'Profile picture removed.' })
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleAddContact = async (e) => {
    e.preventDefault()
    setContactError('')
    if (!contactForm.recipientIdentifier.trim()) {
      setContactError('Enter a recipient ID, email, or phone.')
      return
    }
    setSavingContact(true)
    try {
      const res = await apiFetch('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          recipientIdentifier: contactForm.recipientIdentifier.trim(),
          nickname: contactForm.nickname.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save favourite.')
      setContactForm({ recipientIdentifier: '', nickname: '' })
      setToast({ type: 'success', message: 'Favourite saved!' })
      fetchContacts()
    } catch (err) {
      setContactError(err.message)
    } finally {
      setSavingContact(false)
    }
  }

  const handleRemoveContact = async (id) => {
    try {
      const res = await apiFetch(`/contacts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove favourite.')
      setContacts(prev => prev.filter(c => c.id !== id))
      setToast({ type: 'info', message: 'Favourite removed.' })
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    }
  }

  const handleAddBank = async (e) => {
    e.preventDefault()
    setBankError('')
    if (bankForm.accountNumber !== bankForm.confirmAccountNumber) {
      setBankError('Account numbers do not match.')
      return
    }
    setAddingBank(true)
    try {
      const res = await apiFetch('/bank/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountHolderName: bankForm.accountHolderName,
          accountNumber: bankForm.accountNumber,
          ifscCode: bankForm.ifscCode,
          bankName: bankForm.bankName,
          accountType: bankForm.accountType,
          userId: user.id
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.success === false) {
        setBankError(d.message || d.error || 'Failed to add account')
        return
      }
      setToast({ type: 'success', icon: '🏦', message: 'Bank account added successfully!', duration: 3000 })
      setBankForm(emptyForm)
      setShowAddBank(false)
      fetchAccounts()
    } catch {
      setBankError('Failed to add account. Try again.')
    } finally {
      setAddingBank(false)
    }
  }

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete your account? This action cannot be undone.");

    if (!confirmDelete) return;

    try {
      const res = await apiFetch(`/user/${user.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      setToast({ type: 'success', message: 'Account deleted successfully' });

      logout();               // logout user
      navigate('/register');  // redirect
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to delete account' });
    }
  };
  const handleRemove = async (id) => {
    setRemovingId(id)
    try {
      await apiFetch(`/bank/remove/${id}`, { method: 'DELETE' })
      setAccounts(prev => prev.filter(a => a.id !== id))
      setToast({ type: 'info', icon: '🗑️', message: 'Bank account removed.' })
    } catch {
      setToast({ type: 'error', message: 'Failed to remove account.' })
    } finally {
      setRemovingId(null)
    }
  }

  const handleSetPrimary = async (accountId) => {
    try {
      await apiFetch(`/bank/primary/${user.id}/${accountId}`, { method: 'PUT' })
      setAccounts(prev => prev.map(a => ({ ...a, primary: a.id === accountId })))
      setToast({ type: 'success', icon: '⭐', message: 'Primary account updated!' })
    } catch {
      setToast({ type: 'error', message: 'Failed to update primary account.' })
    }
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>⚙️ Settings</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Manage your account and preferences</p>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">{t('settings.language')}</div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
            {t('settings.languageHelp')}
          </p>
          <div className="language-grid">
            {Object.entries(languages).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                className={`language-btn ${language === key ? 'selected' : ''}`}
                onClick={() => {
                  changeLanguage(key)
                  setToast({ type: 'info', message: cfg.nativeLabel + ' - ' + t('settings.languageApplied'), duration: 2200 })
                }}
              >
                <span style={{ fontWeight: 800 }}>{cfg.nativeLabel}</span>
                <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>{cfg.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="settings-section">
        <div className="settings-section-header">👤 Profile</div>
        <div style={{ padding: '1.5rem', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
          <UserAvatar user={user} size="4rem" fontSize="1.25rem" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{user?.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
              <label className="btn-secondary" style={{ width: 'auto', padding: '0.45rem 0.875rem', fontSize: '0.8rem' }}>
                {photoLoading ? 'Uploading...' : 'Upload Photo'}
                <input type="file" accept="image/*" onChange={handleProfilePhoto} disabled={photoLoading} style={{ display: 'none' }} />
              </label>
              {user?.profilePictureUrl && (
                <button type="button" className="btn-secondary" onClick={handleRemoveProfilePhoto} disabled={photoLoading} style={{ width: 'auto', padding: '0.45rem 0.875rem', fontSize: '0.8rem' }}>
                  Remove
                </button>
              )}
            </div>
            {user?.phoneNumber && (
              <div style={{ color: 'var(--text-faint)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                📱 {user.phoneNumber}
              </div>
            )}
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-info">ID #{user?.id}</span>
              {user?.referralCode && (
                <span className="badge badge-success" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                  🔗 {user.referralCode}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ BANK ACCOUNTS ════════════ */}
      <div className="settings-section" style={{ marginBottom: '1rem' }}>
        <div className="settings-section-header">Contacts & Favourites</div>
        <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gap: '1rem' }}>
          <form onSubmit={handleAddContact} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label className="label">Recipient ID, Email, or Phone</label>
              <input className="input-field" value={contactForm.recipientIdentifier} onChange={e => setContactForm(f => ({ ...f, recipientIdentifier: e.target.value }))} placeholder="e.g. 12 or user@email.com" />
            </div>
            <div>
              <label className="label">Nickname</label>
              <input className="input-field" value={contactForm.nickname} onChange={e => setContactForm(f => ({ ...f, nickname: e.target.value }))} placeholder="Optional" />
            </div>
            <button className="btn-primary" type="submit" disabled={savingContact} style={{ width: 'auto', whiteSpace: 'nowrap' }}>
              {savingContact ? 'Saving...' : 'Save'}
            </button>
          </form>
          {contactError && <div className="alert-error">{contactError}</div>}
          {contactsLoading ? (
            <div style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>Loading favourites...</div>
          ) : contacts.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: '0.875rem', background: 'var(--bg-input)', borderRadius: '0.875rem', padding: '1rem' }}>
              Save frequent recipients here, then pick them instantly while sending money or creating splits.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.625rem' }}>
              {contacts.map(contact => (
                <div key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '0.875rem', padding: '0.75rem' }}>
                  <UserAvatar name={contact.name} src={contact.profilePictureUrl} size="2.25rem" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{contact.nickname || contact.name || `User #${contact.contactUserId}`}</div>
                    <div style={{ color: 'var(--text-faint)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ID #{contact.contactUserId}{contact.email ? ` - ${contact.email}` : ''}
                    </div>
                  </div>
                  <button type="button" className="btn-danger" onClick={() => handleRemoveContact(contact.id)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="settings-section" style={{ marginBottom: '1rem' }}>
        <div className="settings-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🏦 Bank Accounts</span>
          <button
            onClick={() => { setShowAddBank(v => !v); setBankError('') }}
            style={{
              background: showAddBank ? 'rgba(239,68,68,0.15)' : 'var(--accent-glow)',
              color: showAddBank ? '#f87171' : 'var(--accent-light)',
              border: `1px solid ${showAddBank ? 'rgba(239,68,68,0.3)' : 'var(--accent)'}`,
              borderRadius: '0.5rem', padding: '0.25rem 0.75rem',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
            }}
          >
            {showAddBank ? '✕ Cancel' : '+ Add Account'}
          </button>
        </div>

        <div style={{ padding: '0.5rem 1.5rem 1.25rem' }}>
          {/* Existing accounts */}
          {accountsLoading ? (
            <div style={{ color: 'var(--text-faint)', fontSize: '0.875rem', padding: '0.5rem 0' }}>Loading...</div>
          ) : accounts.length === 0 && !showAddBank ? (
            <div style={{
              textAlign: 'center', padding: '1.5rem',
              background: 'var(--bg-input)', borderRadius: '0.875rem',
              color: 'var(--text-faint)', fontSize: '0.875rem'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏦</div>
              No bank accounts linked yet.<br />
              <span style={{ fontSize: '0.8rem' }}>Add one to enable bank transfers.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: showAddBank ? '1.25rem' : 0 }}>
              {accounts.map(acc => (
                <div key={acc.id} style={{
                  background: 'var(--bg-input)', borderRadius: '0.875rem',
                  padding: '1rem 1.25rem',
                  border: `1px solid ${acc.primary ? 'var(--accent)' : 'var(--border-color)'}`,
                  position: 'relative',
                }}>
                  {acc.primary && (
                    <span style={{
                      position: 'absolute', top: '0.75rem', right: '0.75rem',
                      background: 'var(--accent-glow)', color: 'var(--accent-light)',
                      border: '1px solid var(--accent)',
                      fontSize: '0.625rem', fontWeight: 700, borderRadius: '99px',
                      padding: '0.125rem 0.5rem', textTransform: 'uppercase'
                    }}>⭐ Primary</span>
                  )}
                  <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem',
                      background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.5rem', flexShrink: 0,
                      border: '1px solid var(--border-color)'
                    }}>🏦</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{acc.bankName}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                        {acc.accountNumber}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
                        {acc.accountHolderName} · {acc.accountType} · {acc.ifscCode}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem' }}>
                    {!acc.primary && (
                      <button
                        onClick={() => handleSetPrimary(acc.id)}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', width: 'auto' }}
                      >⭐ Set Primary</button>
                    )}
                    <button
                      onClick={() => handleRemove(acc.id)}
                      disabled={removingId === acc.id}
                      style={{
                        fontSize: '0.75rem', padding: '0.3rem 0.75rem', width: 'auto',
                        background: 'rgba(239,68,68,0.1)', color: '#f87171',
                        border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem',
                        cursor: 'pointer', fontWeight: 500
                      }}
                    >
                      {removingId === acc.id ? '...' : '🗑 Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add bank account form */}
          {showAddBank && (
            <form onSubmit={handleAddBank} style={{
              background: 'var(--bg-input)', borderRadius: '1rem',
              padding: '1.25rem', border: '1px solid var(--border-color)',
              display: 'flex', flexDirection: 'column', gap: '1rem'
            }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Add New Bank Account</h3>

              {bankError && (
                <div className="alert-error animate-slide-up">{bankError}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label">Account Holder Name</label>
                  <input
                    className="input-field"
                    placeholder="As on passbook"
                    value={bankForm.accountHolderName}
                    onChange={e => setBankForm(f => ({ ...f, accountHolderName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Bank Name</label>
                  <select
                    className="input-field"
                    value={bankForm.bankName}
                    onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))}
                    required
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">Select bank</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Account Number</label>
                  <input
                    className="input-field"
                    placeholder="Enter account number"
                    value={bankForm.accountNumber}
                    onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))}
                    maxLength={18}
                    required
                  />
                </div>
                <div>
                  <label className="label">Confirm Account Number</label>
                  <input
                    className="input-field"
                    placeholder="Re-enter account number"
                    value={bankForm.confirmAccountNumber}
                    onChange={e => setBankForm(f => ({ ...f, confirmAccountNumber: e.target.value.replace(/\D/g, '') }))}
                    onPaste={e => e.preventDefault()}
                    maxLength={18}
                    required
                  />
                </div>
                <div>
                  <label className="label">IFSC Code</label>
                  <input
                    className="input-field"
                    placeholder="e.g. SBIN0001234"
                    value={bankForm.ifscCode}
                    onChange={e => setBankForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                    maxLength={11}
                    required
                    style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                  />
                </div>
                <div>
                  <label className="label">Account Type</label>
                  <select
                    className="input-field"
                    value={bankForm.accountType}
                    onChange={e => setBankForm(f => ({ ...f, accountType: e.target.value }))}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="SAVINGS">Savings</option>
                    <option value="CURRENT">Current</option>
                  </select>
                </div>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', margin: 0 }}>
                🔒 Your account details are encrypted and only the last 4 digits are stored visibly.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-primary" type="submit" disabled={addingBank} style={{ flex: 1 }}>
                  {addingBank ? <><span className="animate-spin">⟳</span> Saving...</> : '🏦 Add Bank Account'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowAddBank(false); setBankForm(emptyForm); setBankError('') }}
                  style={{ width: 'auto', padding: '0 1.25rem' }}
                >Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ════════════ TRANSACTION PIN ════════════ */}
      <div className="settings-section" style={{ marginBottom: '1rem' }}>
        <div className="settings-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🔐 Transaction PIN</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {pinSet && (
              <span style={{
                background: 'rgba(16,185,129,0.15)', color: '#34d399',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '99px', padding: '0.125rem 0.625rem',
                fontSize: '0.7rem', fontWeight: 700
              }}>✓ PIN Active</span>
            )}
            <button
              onClick={() => { setShowPinForm(v => !v); setPinError(''); setPinSuccess('') }}
              style={{
                background: showPinForm ? 'rgba(239,68,68,0.15)' : 'var(--accent-glow)',
                color: showPinForm ? '#f87171' : 'var(--accent-light)',
                border: `1px solid ${showPinForm ? 'rgba(239,68,68,0.3)' : 'var(--accent)'}`,
                borderRadius: '0.5rem', padding: '0.25rem 0.75rem',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              {showPinForm ? '✕ Cancel' : pinSet ? '🔄 Change PIN' : '+ Set PIN'}
            </button>
          </div>
        </div>

        <div style={{ padding: '0.5rem 1.5rem 1.25rem' }}>
          {!showPinForm && !pinSet && (
            <div style={{
              textAlign: 'center', padding: '1.5rem',
              background: 'var(--bg-input)', borderRadius: '0.875rem',
              color: 'var(--text-faint)', fontSize: '0.875rem'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔐</div>
              No Transaction PIN set.<br />
              <span style={{ fontSize: '0.8rem' }}>Add a PIN to secure every payment.</span>
            </div>
          )}

          {pinSuccess && !showPinForm && (
            <div className="alert-success animate-slide-up">{pinSuccess}</div>
          )}

          {showPinForm && (
            <form onSubmit={handleSavePin} style={{
              background: 'var(--bg-input)', borderRadius: '1rem',
              padding: '1.25rem', border: '1px solid var(--border-color)',
              display: 'flex', flexDirection: 'column', gap: '1rem'
            }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>
                {pinSet ? '🔄 Change Transaction PIN' : '🔐 Set Transaction PIN'}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', margin: 0 }}>
                You'll enter this PIN every time you send money.
              </p>

              {pinError && <div className="alert-error animate-slide-up">{pinError}</div>}

              {pinSet && (
                <div>
                  <label className="label">Current PIN</label>
                  <input
                    id="settings-current-pin"
                    className="input-field"
                    type="password"
                    inputMode="numeric"
                    placeholder="Enter current PIN"
                    maxLength={6}
                    value={pinForm.currentPin}
                    onChange={e => setPinForm(f => ({ ...f, currentPin: e.target.value.replace(/\D/g, '') }))}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label">New PIN (4-6 digits)</label>
                  <input
                    id="settings-new-pin"
                    className="input-field"
                    type="password"
                    inputMode="numeric"
                    placeholder="e.g. 1234"
                    maxLength={6}
                    value={pinForm.newPin}
                    onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value.replace(/\D/g, '') }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Confirm New PIN</label>
                  <input
                    id="settings-confirm-pin"
                    className="input-field"
                    type="password"
                    inputMode="numeric"
                    placeholder="Re-enter PIN"
                    maxLength={6}
                    onPaste={e => e.preventDefault()}
                    value={pinForm.confirmPin}
                    onChange={e => setPinForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '') }))}
                    required
                  />
                </div>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', margin: 0 }}>
                🔒 Your PIN is encrypted with BCrypt and never stored in plain text.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-primary" type="submit" disabled={pinLoading} style={{ flex: 1 }}>
                  {pinLoading ? <><span className="animate-spin">⟳</span> Saving...</> : '🔐 Save PIN'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowPinForm(false); setPinForm({ currentPin: '', newPin: '', confirmPin: '' }); setPinError('') }}
                  style={{ width: 'auto', padding: '0 1.25rem' }}
                >Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Theme */}
      <div className="settings-section">
        <div className="settings-section-header">🎨 Theme</div>
        <div style={{ padding: '0.75rem 1.5rem 1.25rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Choose your preferred look. Changes apply instantly.
          </p>
          <div className="theme-grid">
            {Object.entries(THEME_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                id={`theme-${key}`}
                className={`theme-btn ${theme === key ? 'selected' : ''}`}
                onClick={() => {
                  changeTheme(key)
                  setToast({ type: 'info', icon: cfg.icon, message: `${cfg.label} theme applied!`, duration: 2000 })
                }}
              >
                <div
                  className="theme-swatch"
                  style={{
                    background: `linear-gradient(135deg, ${cfg.bg} 50%, ${cfg.swatch} 50%)`,
                    border: `2px solid ${theme === key ? cfg.swatch : 'var(--border-input)'}`,
                  }}
                />
                <span className="theme-name">{cfg.icon} {cfg.label}</span>
                {theme === key && (
                  <span style={{ fontSize: '0.625rem', color: 'var(--accent)', fontWeight: 700 }}>✓ Active</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="settings-section">
        <div className="settings-section-header">💼 Account Details</div>
        {[
          { label: 'Account Type', value: 'Standard' },
          { label: 'Member Since', value: '2026' },
          
          { label: 'Referral Code', value: user?.referralCode || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="settings-item">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{label}</span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', fontFamily: label === 'Referral Code' ? 'monospace' : 'inherit' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Danger zone */}
      <div className="settings-section" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
        <div className="settings-section-header" style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}>
          ⚠️ Account Actions
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <button
            id="logout-btn"
            onClick={handleLogout}
            style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: 'white', border: 'none', borderRadius: '0.75rem',
              padding: '0.875rem 1.5rem', fontWeight: 600, fontSize: '0.9375rem',
              cursor: 'pointer', width: '100%',
              boxShadow: '0 4px 14px rgba(220,38,38,0.35)',
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(220,38,38,0.45)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(220,38,38,0.35)' }}
          >
            🚪 Logout from PayFlow
          </button>
          <button
            onClick={handleDeleteAccount}
            style={{
              marginTop: '1rem',
              background: 'rgba(239,68,68,0.1)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '0.75rem',
              padding: '0.875rem 1.5rem',
              fontWeight: 600,
              width: '100%',
              cursor: 'pointer'
            }}
          >
            🗑 Delete Account Permanently
          </button>
          <p style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
            You'll need to sign in again after logging out.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.75rem', marginTop: '2rem' }}>
        PayFlow v2.0.0 · Made with ⚡
      </div>
    </div>
  )
}
