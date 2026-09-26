import {describe, expect, it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {MarkdownText} from './MarkdownText'

describe('MarkdownText', () => {
  it('renders markdown links as clickable anchor tags with target _blank', () => {
    const html = renderToStaticMarkup(
      <MarkdownText content="Check [MTA Elevator Status](https://new.mta.info/elevators) for details." />
    )
    expect(html).toContain('<a href="https://new.mta.info/elevators"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('MTA Elevator Status</a>')
  })

  it('renders bold text inside strong tags', () => {
    const html = renderToStaticMarkup(<MarkdownText content="Elevator **EL293** is operational." />)
    expect(html).toContain('<strong class="font-semibold text-foreground">EL293</strong>')
  })

  it('renders bullet lists properly', () => {
    const html = renderToStaticMarkup(
      <MarkdownText content={"- Take the L train to Union Sq\n- Transfer to the 4/5/6 via elevator"} />
    )
    expect(html).toContain('<ul class="list-disc')
    expect(html).toContain('<li>Take the L train to Union Sq</li>')
    expect(html).toContain('<li>Transfer to the 4/5/6 via elevator</li>')
  })

  it('renders blockquotes properly', () => {
    const html = renderToStaticMarkup(
      <MarkdownText content="> MTA Detour: Take the M14A bus to 4th Ave." />
    )
    expect(html).toContain('<blockquote')
    expect(html).toContain('MTA Detour: Take the M14A bus to 4th Ave.')
  })
})

describe('MarkdownText same-origin links', () => {
  it('links a root-relative document but not a protocol-relative URL', () => {
    const html = renderToStaticMarkup(<MarkdownText content={'[PDF](/docs/a.pdf) and [x](//evil.example)'} />)
    expect(html).toContain('href="/docs/a.pdf"')
    expect(html).not.toContain('href="//evil.example"')
  })
})
