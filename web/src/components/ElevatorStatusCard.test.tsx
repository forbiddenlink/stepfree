import {describe, expect, it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {ElevatorStatusCard} from './ElevatorStatusCard'

describe('ElevatorStatusCard', () => {
  it('renders operational elevators with 12-mo reliability', () => {
    const html = renderToStaticMarkup(
      <ElevatorStatusCard
        status={{
          ok: true,
          station: '161 St-Yankee Stadium',
          adaStatus: 'full',
          lines: ['4', 'B', 'D'],
          elevators: [
            {
              equipmentNo: 'EL201',
              serving: 'Street to mezzanine',
              isOut: false,
              availability12mo: 0.985,
            },
          ],
          hasOutages: false,
          sourceUpdatedAt: '2026-09-23T18:00:00Z',
        }}
      />
    )
    expect(html).toContain('161 St-Yankee Stadium')
    expect(html).toContain('EL201')
    expect(html).toContain('Street to mezzanine')
    expect(html).toContain('No outages reported for tracked elevators')
    expect(html).toContain('99% 12-mo reliability')
  })

  it('renders active outage with reason and MTA detour', () => {
    const html = renderToStaticMarkup(
      <ElevatorStatusCard
        status={{
          ok: true,
          station: '1 Av',
          lines: ['L'],
          elevators: [
            {
              equipmentNo: 'EL293',
              serving: 'Street to Brooklyn-bound platform',
              isOut: true,
              outageReason: 'Motor replacement',
              alternativeRoute: 'Take the M14A bus to 4th Ave.',
            },
          ],
          hasOutages: true,
        }}
      />
    )
    expect(html).toContain('Outage Reported')
    expect(html).toContain('EL293')
    expect(html).toContain('OUT OF SERVICE')
    expect(html).toContain('Motor replacement')
    expect(html).toContain('Official MTA Detour:')
    expect(html).toContain('Take the M14A bus to 4th Ave.')
  })

  it('renders not found state when station is invalid', () => {
    const html = renderToStaticMarkup(
      <ElevatorStatusCard
        status={{
          ok: false,
          reason: 'No station matched "Narnia Station".',
        }}
      />
    )
    expect(html).toContain('Station not found')
    expect(html).toContain('Narnia Station')
  })
})


describe('station accessibility evidence', () => {
  const render = (adaStatus?: 'full' | 'partial' | 'none') => renderToStaticMarkup(
    <ElevatorStatusCard status={{ok: true, station: 'Synthetic station', adaStatus, elevators: [], hasOutages: false}} />
  )
  it('does not turn an empty equipment list into an operational guarantee', () => {
    const html = render('full')
    expect(html).toContain('Elevator status unknown')
    expect(html).toContain('No accessible elevator equipment is indexed for this station.')
    expect(html).not.toContain('All Elevators Operational')
  })
  it('distinguishes non-accessible stations from partial accessibility', () => {
    const html = render('none')
    expect(html).toContain('Not listed as ADA accessible')
    expect(html).not.toContain('Partial Accessibility')
  })
  it('explains that partial access does not cover every platform', () => {
    const html = render('partial')
    expect(html).toContain('Partial Accessibility')
    expect(html).toContain('Step-free access is not confirmed for every platform or direction.')
  })
  it('makes missing accessibility classification explicit', () => {
    expect(render()).toContain('Station accessibility unknown')
  })
})
