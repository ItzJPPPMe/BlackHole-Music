import React from 'react';

export default function SearchBar({ value, onChange }) {
  return (
    <div className="search-bar">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        placeholder="Ara..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
