import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import {
  getSavedLinks,
  deleteSavedLink,
  type SavedLinkItem,
} from '../lib/savedLinks';
import { t } from '../lib/i18n';

interface SavedLinksListProps {
  currentActiveId?: string;
  onSelect: (item: SavedLinkItem) => void;
  lang: string;
  filterType?: 'bg' | 'music';
}

export const SavedLinksList: React.FC<SavedLinksListProps> = ({
  currentActiveId,
  onSelect,
  lang,
  filterType,
}) => {
  const [links, setLinks] = useState<SavedLinkItem[]>(() => getSavedLinks());

  useEffect(() => {
    const handleUpdate = () => {
      setLinks(getSavedLinks());
    };
    window.addEventListener('peakus:saved-links-updated', handleUpdate);
    window.addEventListener('peakus:saved-links-local-ui-updated', handleUpdate);
    return () => {
      window.removeEventListener('peakus:saved-links-updated', handleUpdate);
      window.removeEventListener('peakus:saved-links-local-ui-updated', handleUpdate);
    };
  }, []);

  const filtered = links.filter(item => {
    if (!filterType) return true;
    return item.type === filterType || item.type === 'both';
  });

  if (filtered.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '12.5px',
        }}
      >
        {t('savedLinksEmpty', lang as any)}
      </div>
    );
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSavedLink(id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {filtered.map(item => {
        const isSelected =
          (item.youtubeId && item.youtubeId === currentActiveId) ||
          item.url === currentActiveId;

        const thumbUrl = item.youtubeId
          ? `https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg`
          : null;

        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: isSelected
                ? 'var(--accent-soft)'
                : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${
                isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.06)'
              }`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              if (!isSelected) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              }
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              }
            }}
          >
            {/* Thumbnail */}
            <div
              style={{
                width: '64px',
                height: '38px',
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: '#1b1b22',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt={item.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy"
                />
              ) : (
                <Icon
                  name="video"
                  style={{ width: '18px', height: '18px', color: 'var(--muted)' }}
                />
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#fff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '2px',
                  fontSize: '11px',
                  color: 'var(--muted)',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: item.youtubeId ? '#ef4444' : 'var(--accent-text)',
                  }}
                >
                  <Icon name={item.youtubeId ? 'youtube' : 'video'} />
                  {item.youtubeId ? 'YouTube' : 'Video'}
                </span>
                <span>•</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'rgba(255, 255, 255, 0.75)',
                  }}
                >
                  <Icon name="cloud" style={{ width: '12px', height: '12px', color: 'var(--accent)' }} />
                  Synced with Cloud
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn small"
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  backgroundColor: isSelected
                    ? 'var(--accent)'
                    : 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  borderColor: isSelected ? 'var(--accent)' : 'transparent',
                }}
                onClick={e => {
                  e.stopPropagation();
                  onSelect(item);
                }}
              >
                {isSelected ? 'Active' : 'Apply'}
              </button>

              <button
                type="button"
                className="del"
                aria-label={`Remove ${item.title}`}
                title="Remove from saved links"
                onClick={e => handleDelete(e, item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'grid',
                  placeItems: 'center',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--muted)';
                  e.currentTarget.style.background = 'none';
                }}
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
