import { useEffect, useState } from 'react'
import { getSignedUrl } from '../lib/storage'

export default function ClothingCard({ item, onDelete, onEdit, selectable, selected, onToggleSelect }) {
  const [imageUrl, setImageUrl] = useState(null)

  useEffect(() => {
    let cancelled = false
    getSignedUrl(item.image_path)
      .then((url) => {
        if (!cancelled) setImageUrl(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [item.image_path])

  return (
    <div
      className={`clothing-card ${selected ? 'selected' : ''}`}
      onClick={selectable ? () => onToggleSelect(item.id) : undefined}
    >
      <div className="clothing-image">
        {imageUrl ? <img src={imageUrl} alt={item.subcategory || item.category} /> : <div className="image-placeholder" />}
      </div>
      <div className="clothing-info">
        <p className="clothing-title">{item.subcategory || item.category}</p>
        <p className="clothing-sub">
          {item.primary_color}
          {item.pattern ? ` · ${item.pattern}` : ''}
        </p>
        <div className="tag-row">
          {(item.style_tags || []).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </div>
      {(onDelete || onEdit) && (
        <div className="card-actions">
          {onEdit && (
            <button
              className="icon-button edit-button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(item)
              }}
              aria-label="Edit item"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              className="icon-button delete-button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(item)
              }}
              aria-label="Delete item"
            >
              🗑
            </button>
          )}
        </div>
      )}
    </div>
  )
}
