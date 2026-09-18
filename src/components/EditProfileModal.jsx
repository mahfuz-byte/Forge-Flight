import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Icon } from './IconSprite';

export default function EditProfileModal({ open, onClose }) {
  const { currentUser, updateCurrentUser } = useApp();
  
  const [section, setSection] = useState('general');
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // General fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);

  // Collaborator fields
  const [skills, setSkills] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [resumeFile, setResumeFile] = useState(null);

  // Investor fields
  const [investorType, setInvestorType] = useState('');
  const [investmentBudget, setInvestmentBudget] = useState('');
  const [investmentInterests, setInvestmentInterests] = useState('');

  // Sync state when modal opens
  useEffect(() => {
    if (open && currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setBio(currentUser.bio || '');
      setHeadline(currentUser.headline || '');
      setLocation(currentUser.location || '');
      setSkills(currentUser.skills || '');
      setExperienceLevel(currentUser.experience_level || '');
      setPortfolioLink(currentUser.portfolio_link || '');
      setInvestorType(currentUser.investor_type || '');
      setInvestmentBudget(currentUser.investment_budget || '');
      setInvestmentInterests(currentUser.investment_interests || '');
      
      setAvatarFile(null);
      setResumeFile(null);
      setSection('general');
      setSaved(false);
    }
  }, [open, currentUser]);

  if (!open) return null;

  async function handleSave(e) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      let patch;
      if (avatarFile || resumeFile) {
        patch = new FormData();
        const [first, ...rest] = name.trim().split(' ');
        patch.append('first_name', first || '');
        patch.append('last_name', rest.join(' '));
        patch.append('email', email);
        patch.append('bio', bio);
        patch.append('headline', headline);
        patch.append('location', location);
        patch.append('skills', skills);
        patch.append('experience_level', experienceLevel);
        patch.append('portfolio_link', portfolioLink);
        patch.append('investor_type', investorType);
        patch.append('investment_budget', investmentBudget);
        patch.append('investment_interests', investmentInterests);
        if (avatarFile) patch.append('avatar', avatarFile);
        if (resumeFile) patch.append('resume', resumeFile);
      } else {
        patch = {
          name, email, bio, headline, location, 
          skills, experience_level: experienceLevel, portfolio_link: portfolioLink,
          investor_type: investorType, investment_budget: investmentBudget, investment_interests: investmentInterests
        };
      }
      await updateCurrentUser(patch);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      alert('Failed to save profile. Please check the inputs.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ maxWidth: '600px', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
        <div className="modal-head" style={{ padding: '24px 24px 0', marginBottom: 0, borderBottom: '1px solid var(--border)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Edit Profile</h3>
            <button className="btn-icon" onClick={onClose}><Icon name="x" /></button>
          </div>
          
          <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '12px' }}>
            <button 
              className={`settings-nav-item ${section === 'general' ? 'active' : ''}`} 
              onClick={() => setSection('general')}
              style={{ background: 'none', border: 'none', padding: 0, color: section === 'general' ? 'var(--text)' : 'var(--text-faint)', fontWeight: section === 'general' ? 600 : 400, borderBottom: section === 'general' ? '2px solid var(--accent)' : '2px solid transparent', paddingBottom: '4px' }}
            >General Info</button>
            <button 
              className={`settings-nav-item ${section === 'collaborator' ? 'active' : ''}`} 
              onClick={() => setSection('collaborator')}
              style={{ background: 'none', border: 'none', padding: 0, color: section === 'collaborator' ? 'var(--text)' : 'var(--text-faint)', fontWeight: section === 'collaborator' ? 600 : 400, borderBottom: section === 'collaborator' ? '2px solid var(--accent)' : '2px solid transparent', paddingBottom: '4px' }}
            >Collaborator Profile</button>
            <button 
              className={`settings-nav-item ${section === 'investor' ? 'active' : ''}`} 
              onClick={() => setSection('investor')}
              style={{ background: 'none', border: 'none', padding: 0, color: section === 'investor' ? 'var(--text)' : 'var(--text-faint)', fontWeight: section === 'investor' ? 600 : 400, borderBottom: section === 'investor' ? '2px solid var(--accent)' : '2px solid transparent', paddingBottom: '4px' }}
            >Investor Profile</button>
          </div>
        </div>
        
        <div style={{ overflowY: 'auto', padding: '24px' }}>
          <form id="edit-profile-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {section === 'general' && (
              <>
                <div className="field">
                  <label>Profile Picture</label>
                  <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} className="input" />
                </div>
                <div className="field">
                  <label>Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input" />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" />
                </div>
                <div className="field">
                  <label>Headline (e.g. Senior Backend Engineer)</label>
                  <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} className="input" />
                </div>
                <div className="field">
                  <label>Location</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input" />
                </div>
                <div className="field">
                  <label>Bio</label>
                  <textarea rows="4" value={bio} onChange={(e) => setBio(e.target.value)} className="input" />
                </div>
              </>
            )}

            {section === 'collaborator' && (
              <>
                <p className="settings-hint">Details to help founders understand your skills and experience.</p>
                <div className="field">
                  <label>Resume (PDF/Doc)</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResumeFile(e.target.files[0])} className="input" />
                </div>
                <div className="field">
                  <label>Skills (comma separated)</label>
                  <input type="text" placeholder="React, Python, Design..." value={skills} onChange={(e) => setSkills(e.target.value)} className="input" />
                </div>
                <div className="field">
                  <label>Experience Level</label>
                  <select className="input" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                    <option value="">Select level...</option>
                    <option value="Junior">Junior</option>
                    <option value="Mid-Level">Mid-Level</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead/Executive">Lead/Executive</option>
                  </select>
                </div>
                <div className="field">
                  <label>Portfolio / Website Link</label>
                  <input type="url" placeholder="https://..." value={portfolioLink} onChange={(e) => setPortfolioLink(e.target.value)} className="input" />
                </div>
              </>
            )}

            {section === 'investor' && (
              <>
                <p className="settings-hint">Details for startups seeking funding.</p>
                <div className="field">
                  <label>Investor Type</label>
                  <select className="input" value={investorType} onChange={(e) => setInvestorType(e.target.value)}>
                    <option value="">Select type...</option>
                    <option value="Angel Investor">Angel Investor</option>
                    <option value="Venture Capitalist">Venture Capitalist</option>
                    <option value="Syndicate">Syndicate</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>
                <div className="field">
                  <label>Typical Investment Budget</label>
                  <input type="text" placeholder="e.g. $10k - $50k" value={investmentBudget} onChange={(e) => setInvestmentBudget(e.target.value)} className="input" />
                </div>
                <div className="field">
                  <label>Investment Interests (Sectors)</label>
                  <input type="text" placeholder="e.g. AI, CleanTech, SaaS" value={investmentInterests} onChange={(e) => setInvestmentInterests(e.target.value)} className="input" />
                </div>
              </>
            )}
            
          </form>
        </div>

        <div className="modal-actions" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', margin: 0 }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="submit" form="edit-profile-form" className="btn btn-accent" disabled={isSubmitting}>
            {saved ? <><Icon name="check" /> Saved</> : (isSubmitting ? 'Saving...' : 'Save Profile')}
          </button>
        </div>
      </div>
    </div>
  );
}
