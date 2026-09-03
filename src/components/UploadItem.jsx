import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { compressImage, blobToBase64 } from '../lib/imageUtils'
import { uploadClothingImage, getSignedUrl } from '../lib/storage'

const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory']
const SEASONS = ['spring', 'summer', 'fall', 'winter']

const EMPTY_FORM = {
  category: 'top',
  subcategory: '',
  primary_color: '',
  secondary_colors: '',
  pattern: '',
  seasons: [],
  style_tags: '',
  material: '',
  notes: '',
}

export default function UploadItem({ onClose, onSaved, editItem }) {
  const { user } = useAuth()
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('idle') // idle | analyzing | ready | saving | camera
  const [error, setError] = useState('')
  const [stream, setStream] = useState(null)
  const [countdown, setCountdown] = useState(null)

  useEffect(() => {
    if (editItem) {
      setForm({
        category: editItem.category,
        subcategory: editItem.subcategory || '',
        primary_color: editItem.primary_color || '',
        secondary_colors: (editItem.secondary_colors || []).join(', '),
        pattern: editItem.pattern || '',
        seasons: editItem.seasons || [],
        style_tags: (editItem.style_tags || []).join(', '),
        material: editItem.material || '',
        notes: editItem.notes || '',
      })
      setStatus('ready')
      getSignedUrl(editItem.image_path).then(setPreviewUrl).catch(() => {})
    }
  }, [editItem])

  async function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    await processImage(selected)
  }

  async function processImage(imageFile) {
    setError('')
    setFile(imageFile)
    setStatus('analyzing')

    try {
      const compressed = await compressImage(imageFile)
      setBlob(compressed)
      setPreviewUrl(URL.createObjectURL(compressed))

      const base64 = await blobToBase64(compressed)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')

      setForm({
        category: data.category || 'top',
        subcategory: data.subcategory || '',
        primary_color: data.primary_color || '',
        secondary_colors: (data.secondary_colors || []).join(', '),
        pattern: data.pattern || '',
        seasons: data.seasons || [],
        style_tags: (data.style_tags || []).join(', '),
        material: data.material || '',
        notes: '',
      })
      setStatus('ready')
    } catch (err) {
      setError(`Auto-scan failed: ${err.message}. You can still fill the details in by hand.`)
      setStatus('ready')
    }
  }

  async function startCamera() {
    setError('')

    // Check if camera is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported on this device or browser.')
      return
    }

    try {
      // Request camera permission explicitly
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
      })
      setStream(mediaStream)
      setStatus('camera')
    } catch (err) {
      console.error('Camera error:', err)

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings and try again.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is already in use by another app.')
      } else if (err.name === 'OverconstrainedError') {
        // Try again with relaxed constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true
          })
          setStream(fallbackStream)
          setStatus('camera')
          return
        } catch (fallbackErr) {
          setError('Could not access camera with available settings.')
        }
      } else {
        setError(`Camera error: ${err.message}`)
      }
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setCountdown(null)
    setStatus('idle')
  }

  async function startCountdown() {
    setCountdown(3)

    await new Promise((resolve) => {
      let count = 3
      const interval = setInterval(() => {
        count--
        if (count > 0) {
          setCountdown(count)
        } else {
          clearInterval(interval)
          resolve()
        }
      }, 1000)
    })

    setCountdown(null)
    await capturePhoto()
  }

  async function capturePhoto() {
    const video = document.getElementById('camera-preview')
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(async (capturedBlob) => {
      stopCamera()
      const file = new File([capturedBlob], 'camera-photo.jpg', { type: 'image/jpeg' })
      await processImage(file)
    }, 'image/jpeg', 0.95)
  }

  function toggleSeason(season) {
    setForm((f) => ({
      ...f,
      seasons: f.seasons.includes(season)
        ? f.seasons.filter((s) => s !== season)
        : [...f.seasons, season],
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!editItem && !blob) {
      setError('Choose a photo first.')
      return
    }
    setStatus('saving')
    setError('')
    try {
      const itemData = {
        category: form.category,
        subcategory: form.subcategory || null,
        primary_color: form.primary_color || null,
        secondary_colors: splitList(form.secondary_colors),
        pattern: form.pattern || null,
        seasons: form.seasons,
        style_tags: splitList(form.style_tags),
        material: form.material || null,
        notes: form.notes || null,
      }

      if (editItem) {
        // Update existing item
        if (blob) {
          // New photo uploaded, replace image
          const path = await uploadClothingImage(user.id, blob)
          itemData.image_path = path
        }
        const { error: updateError } = await supabase
          .from('clothing_items')
          .update(itemData)
          .eq('id', editItem.id)
        if (updateError) throw updateError
      } else {
        // Create new item
        const path = await uploadClothingImage(user.id, blob)
        const { error: insertError } = await supabase.from('clothing_items').insert({
          user_id: user.id,
          image_path: path,
          ...itemData,
        })
        if (insertError) throw insertError
      }
      onSaved()
    } catch (err) {
      setError(err.message)
      setStatus('ready')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editItem ? 'Edit clothing item' : 'Add clothing item'}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {!file && !editItem && status !== 'camera' && (
          <div className="upload-options">
            <label className="file-drop">
              Choose a photo
              <input type="file" accept="image/*" onChange={handleFileChange} hidden />
            </label>
            <button type="button" className="camera-button" onClick={startCamera}>
              📷 Take photo
            </button>
          </div>
        )}

        {status === 'camera' && (
          <div className="camera-view">
            <div className="camera-container">
              <video
                id="camera-preview"
                autoPlay
                playsInline
                ref={(video) => {
                  if (video && stream) video.srcObject = stream
                }}
              />
              {countdown !== null && <div className="countdown-overlay">{countdown}</div>}
            </div>
            <div className="camera-controls">
              <button
                type="button"
                onClick={startCountdown}
                className="capture-button"
                disabled={countdown !== null}
              >
                {countdown !== null ? 'Taking photo...' : 'Capture (3s)'}
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="cancel-button"
                disabled={countdown !== null}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {previewUrl && (
          <div className="upload-preview">
            <img src={previewUrl} alt="Selected clothing" />
          </div>
        )}

        {status === 'analyzing' && <p className="status-line">Scanning photo…</p>}
        {error && <p className="auth-error">{error}</p>}

        {(status === 'ready' || status === 'saving') && (
          <form onSubmit={handleSave} className="item-form">
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Subcategory
              <input
                value={form.subcategory}
                onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                placeholder="e.g. t-shirt"
              />
            </label>

            <label>
              Primary color
              <input
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                placeholder="e.g. navy blue"
              />
            </label>

            <label>
              Secondary colors
              <input
                value={form.secondary_colors}
                onChange={(e) => setForm({ ...form, secondary_colors: e.target.value })}
                placeholder="comma-separated"
              />
            </label>

            <label>
              Pattern
              <input
                value={form.pattern}
                onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                placeholder="e.g. striped, floral, solid"
              />
            </label>

            <fieldset className="season-fieldset">
              <legend>Seasons</legend>
              {SEASONS.map((season) => (
                <label key={season} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.seasons.includes(season)}
                    onChange={() => toggleSeason(season)}
                  />
                  {season}
                </label>
              ))}
            </fieldset>

            <label>
              Style tags
              <input
                value={form.style_tags}
                onChange={(e) => setForm({ ...form, style_tags: e.target.value })}
                placeholder="comma-separated, e.g. casual, sporty"
              />
            </label>

            <label>
              Material
              <input
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
                placeholder="e.g. cotton"
              />
            </label>

            <label>
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </label>

            <button type="submit" disabled={status === 'saving'}>
              {status === 'saving' ? 'Saving…' : 'Save item'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function splitList(value) {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}
