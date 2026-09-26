import {describe, expect, it} from 'vitest'
import {validateOutageFeed} from '../../../ingest/feed'

const row = {
  equipment: 'EL1', outagedate: '09/23/2026 10:00:00 AM',
  estimatedreturntoservice: '', reason: 'Repair', isupcomingoutage: 'N', ismaintenanceoutage: 'N',
}
const known = new Set(['EL1'])

describe('outage feed validation', () => {
  it('accepts a recognized outage with an unknown repair estimate', () => {
    expect(() => validateOutageFeed([row], known)).not.toThrow()
  })
  it.each([[], [{}], [null], [{...row, outagedate: 'invalid'}], [{...row, isupcomingoutage: 'unknown'}]].map((feed) => ({feed})))(
    'rejects a malformed feed before it can resolve existing outages: $feed', ({feed}) => {
      expect(() => validateOutageFeed(feed, known)).toThrow()
    },
  )
  it('rejects a feed when none of its equipment can be matched', () => {
    expect(() => validateOutageFeed([{...row, equipment: 'UNKNOWN'}], known)).toThrow()
  })
  it('rejects the entire snapshot if only one row is malformed', () => {
    expect(() => validateOutageFeed([row, {}], known)).toThrow()
  })
})
