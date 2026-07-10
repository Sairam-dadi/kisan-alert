import { useState } from 'react';
import { Search, PhoneCall, Menu } from 'lucide-react';

export default function Topbar({
  pageTitle,
  pageSubtitle,
  language,
  onLanguageChange,
  languages,
  onSearchLocation,
  onRequestCall,
  callRequesting,
  phoneNumber,
  onOpenMobileMenu,
}) {
  const [searchValue, setSearchValue] = useState('');

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (searchValue.trim()) {
      onSearchLocation(searchValue.trim());
    }
  }

  return (
    <header className="topbar">
      <button className="mobile-nav-toggle" onClick={onOpenMobileMenu} aria-label="Open menu">
        <Menu size={18} />
      </button>

      <div className="topbar-titles">
        <h1 className="topbar-title">{pageTitle}</h1>
        {pageSubtitle && <p className="topbar-subtitle">{pageSubtitle}</p>}
      </div>

      <div className="topbar-actions">
        <form className="topbar-search" onSubmit={handleSearchSubmit}>
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Check weather for a location…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </form>

        <select
          className="topbar-lang"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <button
          className="topbar-call-btn"
          onClick={onRequestCall}
          disabled={!phoneNumber || callRequesting}
          title={!phoneNumber ? 'Set your phone number first' : 'Request a call'}
        >
          <PhoneCall size={14} />
          {callRequesting ? 'Calling…' : 'Request a call'}
        </button>
      </div>
    </header>
  );
}
