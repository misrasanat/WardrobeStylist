import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import ClothingCard from '../components/ClothingCard'

export default function Outfits() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [occasion, setOccasion] = useState('')
  const [season, setSeason] = useState('')
  const [outfits, setOutfits] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState({ liked: [], disliked: [] })
  const [likedOutfits, setLikedOutfits] = useState(new Set())

  useEffect(() => {
    Promise.all([
      supabase.from('clothing_items').select('*'),
      supabase.from('outfit_feedback').select('*'),
    ]).then(([itemsRes, feedbackRes]) => {
      if (itemsRes.error) setError(itemsRes.error.message)
      else setItems(itemsRes.data)

      if (feedbackRes.data) {
        const liked = feedbackRes.data.filter(f => f.liked)
        const disliked = feedbackRes.data.filter(f => !f.liked)
        setFeedback({ liked, disliked })
        setLikedOutfits(new Set(liked.map(f => f.item_ids.sort().join(','))))
      }
      setLoading(false)
    })
  }, [])

  async function handleSuggest(e) {
    e.preventDefault()
    setSuggesting(true)
    setError('')
    setOutfits(null)
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, occasion, season, feedback }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Suggestion failed')
      setOutfits(data.outfits)
    } catch (err) {
      setError(err.message)
    } finally {
      setSuggesting(false)
    }
  }

  async function handleFeedback(outfit, liked) {
    const sortedIds = [...outfit.item_ids].sort()
    const key = sortedIds.join(',')

    try {
      // Upsert feedback
      const { error } = await supabase.from('outfit_feedback').upsert({
        user_id: user.id,
        item_ids: sortedIds,
        liked,
      })

      if (error) throw error

      // Update local state
      const newFeedback = { ...feedback }
      const existing = [...newFeedback.liked, ...newFeedback.disliked].find(
        f => f.item_ids.sort().join(',') === key
      )

      if (existing) {
        // Remove from both lists
        newFeedback.liked = newFeedback.liked.filter(f => f.item_ids.sort().join(',') !== key)
        newFeedback.disliked = newFeedback.disliked.filter(f => f.item_ids.sort().join(',') !== key)
      }

      // Add to appropriate list
      if (liked) {
        newFeedback.liked.push({ item_ids: sortedIds, liked: true })
        setLikedOutfits(new Set([...likedOutfits, key]))
      } else {
        newFeedback.disliked.push({ item_ids: sortedIds, liked: false })
        likedOutfits.delete(key)
        setLikedOutfits(new Set(likedOutfits))
      }

      setFeedback(newFeedback)
    } catch (err) {
      setError(err.message)
    }
  }

  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))

  return (
    <div className="page">
      <div className="page-header">
        <h1>Outfit suggestions</h1>
      </div>

      {loading ? (
        <p className="status-line">Loading wardrobe…</p>
      ) : items.length < 2 ? (
        <div className="empty-state">
          <p>Add at least a couple of items to your wardrobe before requesting outfits.</p>
        </div>
      ) : (
        <>
          <form className="suggest-form" onSubmit={handleSuggest}>
            <label>
              Occasion (optional)
              <input
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="e.g. work, date night, weekend brunch"
              />
            </label>
            <label>
              Season (optional)
              <select value={season} onChange={(e) => setSeason(e.target.value)}>
                <option value="">Any</option>
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="fall">Fall</option>
                <option value="winter">Winter</option>
              </select>
            </label>
            <button type="submit" disabled={suggesting}>
              {suggesting ? 'Styling…' : 'Suggest outfits'}
            </button>
          </form>

          {error && <p className="auth-error">{error}</p>}

          {outfits && (
            <div className="outfit-list">
              {outfits.length === 0 && <p>No outfit ideas came back — try again or add more items.</p>}
              {outfits.map((outfit, i) => {
                const key = [...outfit.item_ids].sort().join(',')
                const isLiked = likedOutfits.has(key)
                return (
                  <div className="outfit-card" key={i}>
                    <div className="outfit-header">
                      <h3>{outfit.title}</h3>
                      <div className="outfit-actions">
                        <button
                          className={`feedback-button ${isLiked ? 'liked' : ''}`}
                          onClick={() => handleFeedback(outfit, true)}
                          title="Love this outfit"
                        >
                          👍
                        </button>
                        <button
                          className={`feedback-button ${isLiked === false ? 'disliked' : ''}`}
                          onClick={() => handleFeedback(outfit, false)}
                          title="Not my style"
                        >
                          👎
                        </button>
                      </div>
                    </div>
                    <p className="outfit-rationale">{outfit.rationale}</p>
                    <div className="clothing-grid">
                      {outfit.item_ids.map((id) =>
                        itemsById[id] ? <ClothingCard key={id} item={itemsById[id]} /> : null
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
