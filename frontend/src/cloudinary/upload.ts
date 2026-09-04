// Image uploads — Cloudinary's free tier, called directly from the browser. No backend
// involved (this build has none — see ARCHITECTURE.md's migration note): Cloudinary's
// "unsigned upload preset" mechanism is purpose-built for exactly this, and needs no
// secret key in the client, only a cloud name (public, identifies the account) and a
// preset name (public, but scoped server-side by Cloudinary to a folder/size/format —
// configured once in the Cloudinary dashboard, not in this code).
//
// Trade-off, documented honestly (same spirit as the Firestore Rules trade-offs in
// ARCHITECTURE.md section 3.3): the preset name isn't a secret — anyone who inspects this
// app's network requests could see it and, in principle, upload their own files against
// your Cloudinary account, consuming your free quota. The preset's own format/size limits
// (set in the Cloudinary dashboard, not here) are what actually bound the damage. This is
// an accepted, standard trade-off for a small, low-traffic storefront staying card-free —
// see the Cloudinary setup steps in README.md.

import { compressImage, ImageTooLargeError } from './compress'

export class ImageUploadError extends Error {}

export interface UploadedImage {
  url: string
  /** Cloudinary's asset identifier — kept in case a later feature needs it (e.g. asking
   *  Cloudinary to re-transform an image). Deleting the underlying asset isn't done from
   *  here: Cloudinary's delete API requires a signed (secret-holding) request, so removing
   *  an image from a product just removes it from that product's `images` array — the
   *  file itself stays in Cloudinary, a known, accepted limitation of staying serverless. */
  publicId: string
}

function getConfig() {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined
  if (!cloudName || !uploadPreset) {
    throw new ImageUploadError(
      'Image uploads aren’t configured yet — add your Cloudinary cloud name and upload preset to frontend/.env (see .env.example).',
    )
  }
  return { cloudName, uploadPreset }
}

/**
 * Uploads one image file to Cloudinary and returns its public URL. `folder` is purely
 * organizational (e.g. `products/{businessId}/{productId}`) — it does not itself restrict
 * who can upload; that's the preset's job (configured in the Cloudinary dashboard).
 */
export async function uploadImage(file: File, folder: string): Promise<UploadedImage> {
  const { cloudName, uploadPreset } = getConfig()

  // Resize/re-encode before this ever leaves the browser — see ./compress.ts for why.
  // ImageTooLargeError's message is written to be shown to the user as-is (each call site
  // already does `setError(getFirebaseErrorMessage(err))`, which falls through to
  // `err.message` for any plain Error).
  let toUpload: File
  try {
    toUpload = await compressImage(file)
  } catch (err) {
    if (err instanceof ImageTooLargeError) throw new ImageUploadError(err.message)
    throw err
  }

  const form = new FormData()
  form.append('file', toUpload)
  form.append('upload_preset', uploadPreset)
  form.append('folder', folder)

  let res: Response
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    })
  } catch {
    throw new ImageUploadError('Could not reach the image upload service. Please check your connection and try again.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ImageUploadError(body?.error?.message || 'Image upload failed. Please try again.')
  }

  const data = await res.json()
  return { url: data.secure_url as string, publicId: data.public_id as string }
}
