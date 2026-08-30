import { describe, expect, it } from 'vitest'
import { embedUrl, parseVideoId, thumbnailUrl, watchUrl } from './youtube'

const ID = 'dQw4w9WgXcQ'

describe('parseVideoId', () => {
  it('accepts watch urls, including extra query params', () => {
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}&list=PL123&t=42s`)).toBe(ID)
    expect(parseVideoId(`https://youtube.com/watch?app=desktop&v=${ID}`)).toBe(ID)
    expect(parseVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('accepts short, shorts, embed and live urls', () => {
    expect(parseVideoId(`https://youtu.be/${ID}`)).toBe(ID)
    expect(parseVideoId(`https://youtu.be/${ID}?t=30`)).toBe(ID)
    expect(parseVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
    expect(parseVideoId(`https://www.youtube.com/embed/${ID}?rel=0`)).toBe(ID)
    expect(parseVideoId(`https://www.youtube.com/live/${ID}`)).toBe(ID)
    expect(parseVideoId(`https://m.youtube.com/shorts/${ID}`)).toBe(ID)
  })

  it('accepts a bare id and ignores surrounding whitespace', () => {
    expect(parseVideoId(ID)).toBe(ID)
    expect(parseVideoId(`  ${ID}\n`)).toBe(ID)
    expect(parseVideoId(`  https://youtu.be/${ID}  `)).toBe(ID)
  })

  it('accepts scheme-less pastes', () => {
    expect(parseVideoId(`youtu.be/${ID}`)).toBe(ID)
    expect(parseVideoId(`www.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('rejects anything that is not a youtube video reference', () => {
    expect(parseVideoId('')).toBeNull()
    expect(parseVideoId('   ')).toBeNull()
    expect(parseVideoId('https://vimeo.com/123456')).toBeNull()
    expect(parseVideoId(`https://example.com/watch?v=${ID}`)).toBeNull()
    expect(parseVideoId('https://www.youtube.com/results?search_query=cats')).toBeNull()
    expect(parseVideoId('dQw4w9Wg')).toBeNull()
    expect(parseVideoId('dQw4w9WgXcQXX')).toBeNull()
    expect(parseVideoId('dQw4w9Wg!cQ')).toBeNull()
    expect(parseVideoId('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(parseVideoId('not a url at all')).toBeNull()
  })
})

describe('url builders', () => {
  it('builds thumbnail, watch and embed urls', () => {
    expect(thumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`)
    expect(watchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(embedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?rel=0`)
    expect(embedUrl(ID, { autoplay: true })).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?rel=0&autoplay=1`,
    )
  })
})
