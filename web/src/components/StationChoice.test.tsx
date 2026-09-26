import {describe, expect, it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {ElevatorStatusCard} from './ElevatorStatusCard'
import {choiceMessage, type StationCandidate} from './StationChoice'

const q: StationCandidate = {name: '72 St', complexId: '1', lines: ['Q'], borough: 'Manhattan', label: '72 St (Q in Manhattan)'}

describe('choiceMessage', () => {
  it('names the ambiguous end and carries the exact station id', () => {
    expect(choiceMessage('from', q)).toBe('Start at 72 St (Q in Manhattan) (station id 1)')
    expect(choiceMessage('to', q)).toBe('Go to 72 St (Q in Manhattan) (station id 1)')
    expect(choiceMessage('station', q)).toBe('Check 72 St (Q in Manhattan) (station id 1)')
  })
})

describe('station status ambiguity', () => {
  it('offers candidates instead of reporting "not found"', () => {
    const html = renderToStaticMarkup(
      <ElevatorStatusCard status={{ok: false, ambiguous: true, query: '72 St', candidates: [q, {...q, complexId: '2', lines: ['1']}]}} />,
    )
    expect(html).toContain('Which “72 St” do you mean?')
    expect(html).not.toContain('Station not found')
  })
})
