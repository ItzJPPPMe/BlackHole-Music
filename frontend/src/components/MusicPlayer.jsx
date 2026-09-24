import React from 'react';

export default function MusicPlayer({ currentTrack, isPlaying, onPlay, onPause, onNext, onPrev }) {
  if (!currentTrack) return null;

  return (
    <div className="music-player">
      <div className="player-info">
        <span className="player-title">{currentTrack.title || 'Çalınmıyor'}</span>
        <span className="player-artist">{currentTrack.artist || ''}</span>
      </div>
      <div className="player-controls">
        <button className="ctrl-btn" onClick={onPrev}>⏮</button>
        <button className="ctrl-btn play-btn" onClick={isPlaying ? onPause : onPlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="ctrl-btn" onClick={onNext}>⏭</button>
      </div>
    </div>
  );
}
