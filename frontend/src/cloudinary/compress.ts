// Client-side image resizing/compression, run right before a file is handed to
// uploadImage() (see ./upload.ts). There's no backend here to do this server-side — see
// ARCHITECTURE.md's migration note — so it happens in the browser via <canvas>, which every
// target browser supports.
//
// Why this exists: a photo straight off a phone camera is routinely 3000-4000px wide and
// several MB, but this app only ever displays it at a few hundred px wide. Downscaling to a
// sane display size and re-encoding at a reasonable JPEG quality typically shrinks a file by
// 80-90% with no visible quality loss at normal viewing sizes, and keeps uploads fast and
// Cloudinary's free-tier quota (storage + bandwidth, shared across every business on this
// platform) from getting eaten by full-resolution originals nobody needed.

export class ImageTooLargeError extends Error {}

/** Cloudinary's free-tier per-file cap. Kept as our own hard limit too, so a file that's
 *  still too big after compression fails fast with a clear message instead of hitting
 *  Cloudinary and surfacing whatever raw error it sends back. */
const HARD_SIZE_LIMIT_BYTES = 10 * 1024 * 1024

/** Longest edge a compressed image is resized down to. Comfortably sharp for this app's
 *  storefront/dashboard image sizes (nothing here displays a photo anywhere close to this
 *  wide) while cutting most phone-camera originals down dramatically. */
const MAX_DIMENSION = 1600

/** JPEG quality for the re-encode. ~0.82 is the well-known "sweet spot" — visually
 *  indistinguishable from the source at normal viewing sizes, but meaningfully smaller. */
const JPEG_QUALITY = 0.82

/** Skip re-encoding a file that's already small and correctly sized — avoids a pointless
 *  quality-losing re-compression of an image that's already fine. */
const SKIP_THRESHOLD_BYTES = 400 * 1024

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function tooLargeMessage(bytes: number): string {
  return `This photo is too large (${formatMB(bytes)}MB) even after compression — please choose a smaller photo.`
}

/**
 * Resizes and re-encodes an image file for upload. Returns the original file unchanged
 * when it's already small enough, or when it's a format compression shouldn't touch (SVG,
 * a vector format that <canvas> would rasterize). Throws ImageTooLargeError — with a
 * message meant to be shown to the user as-is — when the file isn't a recognizable image,
 * or is still over the hard size limit after every attempt to shrink it.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new ImageTooLargeError('That file doesn’t look like a photo — please choose an image (JPG, PNG, etc.).')
  }

  if (file.type === 'image/svg+xml') {
    if (file.size > HARD_SIZE_LIMIT_BYTES) throw new ImageTooLargeError(tooLargeMessage(file.size))
    return file
  }

  if (file.size <= SKIP_THRESHOLD_BYTES) {
    return file
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Some formats (notably HEIC/HEIF from iPhones, in browsers that can't decode it) can't
    // be read via createImageBitmap — fall back to just enforcing the size limit on the
    // original rather than silently skipping compression.
    if (file.size > HARD_SIZE_LIMIT_BYTES) {
      throw new ImageTooLargeError(
        `This photo (${formatMB(file.size)}MB) couldn’t be automatically shrunk — please choose a smaller photo, or a JPG/PNG instead.`,
      )
    }
    return file
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const targetWidth = Math.round(bitmap.width * scale)
    const targetHeight = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      if (file.size > HARD_SIZE_LIMIT_BYTES) throw new ImageTooLargeError(tooLargeMessage(file.size))
      return file
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) {
      if (file.size > HARD_SIZE_LIMIT_BYTES) throw new ImageTooLargeError(tooLargeMessage(file.size))
      return file
    }

    if (blob.size > HARD_SIZE_LIMIT_BYTES) {
      throw new ImageTooLargeError(tooLargeMessage(blob.size))
    }

    // Only use the re-encoded version if it's actually smaller — a tiny or already-JPEG
    // source can occasionally come back larger after re-encoding.
    if (blob.size >= file.size) {
      return file
    }

    const newName = file.name.replace(/\.[^./]+$/, '') + '.jpg'
    return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}
