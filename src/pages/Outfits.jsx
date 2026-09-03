import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ClothingCard from '../components/ClothingCard'

export default function Outfits() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [occasion, setOccasion] = useState('')
  const [season, setSeason] = useState('')
  const [outfits, setOutfits] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('clothing_items')
      .select('*')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setItems(data)
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
        body: JSON.stringify({ items, occasion, season }),
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
              {outfits.map((outfit, i) => (
                <div className="outfit-card" key={i}>
                  <h3>{outfit.title}</h3>
                  <p className="outfit-rationale">{outfit.rationale}</p>
                  <div className="clothing-grid">
                    {outfit.item_ids.map((id) =>
                      itemsById[id] ? <ClothingCard key={id} item={itemsById[id]} /> : null
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
