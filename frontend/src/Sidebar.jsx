import { Home, Sprout, CloudRain, Stethoscope, PhoneCall, Leaf, X } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'advisor', label: 'Crop Advisor', icon: Sprout },
  { key: 'weather', label: 'Weather Alerts', icon: CloudRain },
  { key: 'doctor', label: 'Crop Doctor', icon: Stethoscope },
  { key: 'call', label: 'Call Support', icon: PhoneCall },
];

export default function Sidebar({ activePage, onNavigate, phoneNumber, location, mobileOpen, onCloseMobile }) {
  function handleNavigate(key) {
    onNavigate(key);
    onCloseMobile();
  }

  return (
    <>
      <div
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={onCloseMobile}
      />
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Leaf size={22} color="#EDF0E4" />
          </div>
          <div>
            <p className="sidebar-brand-name">Kisan Alert</p>
            <p className="sidebar-brand-tagline">Profit-first farming</p>
          </div>
          <button className="sidebar-close-btn" onClick={onCloseMobile} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`sidebar-nav-item ${activePage === key ? 'active' : ''}`}
              onClick={() => handleNavigate(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="sidebar-profile-avatar">
              {phoneNumber ? phoneNumber.slice(-2) : '—'}
            </div>
            <div>
              <p className="sidebar-profile-name">{location || 'Location not set'}</p>
              <p className="sidebar-profile-phone">{phoneNumber || 'Phone not set'}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
