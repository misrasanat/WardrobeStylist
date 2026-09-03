import { supabase } from './supabaseClient'

const BUCKET = 'clothing-images'

export async function uploadClothingImage(userId, blob) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
  })
  if (error) throw error
  return path
}

export async function getSignedUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export async function deleteClothingImage(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
