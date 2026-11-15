import {describe, expect, it, vi} from 'vitest'

vi.mock('next/font/google', () => {
  const font = () => ({variable: '', className: ''})
  return {Atkinson_Hyperlegible_Next: font, Azeret_Mono: font}
})

describe('share image metadata', () => {
  it('uses a raster PNG for og:image and twitter:image, not an SVG', async () => {
    const {metadata} = await import('./layout')
    const og = metadata.openGraph?.images as {url: string}[]
    expect(og[0].url).toBe('/og-image.png')
    expect(metadata.twitter?.images).toEqual(['/og-image.png'])
  })
})
