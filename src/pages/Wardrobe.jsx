import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { deleteClothingImage } from '../lib/storage'
import ClothingCard from '../components/ClothingCard'
import UploadItem from '../components/UploadItem'

export default function Wardrobe() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    loadItems()
  }, [user])

  async function loadItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clothing_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  async function handleDelete(item) {
    if (!confirm('Delete this item from your wardrobe?')) return
    try {
      await deleteClothingImage(item.image_path)
      const { error } = await supabase.from('clothing_items').delete().eq('id', item.id)
      if (error) throw error
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
      setError(err.message)
    }
  }

  function handleEdit(item) {
    setEditingItem(item)
  }

  const categories = ['all', ...new Set(items.map((i) => i.category))]
  const visibleItems =
    categoryFilter === 'all' ? items : items.filter((i) => i.category === categoryFilter)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Your wardrobe</h1>
        <button onClick={() => setShowUpload(true)}>+ Add item</button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {items.length > 0 && (
        <div className="filter-row">
          {categories.map((c) => (
            <button
              key={c}
              className={`chip ${categoryFilter === c ? 'chip-active' : ''}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="status-line">Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>Your wardrobe is empty. Add your first item to get started.</p>
        </div>
      ) : (
        <div className="clothing-grid">
          {visibleItems.map((item) => (
            <ClothingCard key={item.id} item={item} onDelete={handleDelete} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadItem
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false)
            loadItems()
          }}
        />
      )}

      {editingItem && (
        <UploadItem
          editItem={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null)
            loadItems()
          }}
        />
      )}
    </div>
  )
}
