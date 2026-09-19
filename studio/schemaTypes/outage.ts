import {defineField, defineType} from 'sanity'

// Written by the ingest job, never by hand. _id is deterministic
// (outage-<equipmentNo>-<start epoch>) so re-running ingest is idempotent.
export const outage = defineType({
  name: 'outage',
  title: 'Outage',
  type: 'document',
  description:
    'One elevator/escalator outage from the live MTA feed. Current and upcoming outages come from the ' +
    'feed; resolvedAt is set when an outage disappears from it, which builds per-outage history.',
  fields: [
    defineField({
      name: 'equipment',
      type: 'reference',
      to: [{type: 'equipment'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      type: 'string',
      options: {list: ['upcoming', 'active', 'resolved']},
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'reason', type: 'string', description: 'MTA reason, e.g. "Repair", "Capital Replacement".'}),
    defineField({name: 'isPlannedMaintenance', type: 'boolean'}),
    defineField({name: 'startsAt', type: 'datetime'}),
    defineField({name: 'estimatedReturnAt', type: 'datetime'}),
    defineField({name: 'firstSeenAt', type: 'datetime'}),
    defineField({name: 'lastSeenAt', type: 'datetime'}),
    defineField({
      name: 'resolvedAt',
      type: 'datetime',
      description: 'First ingest run where the outage was gone from the feed.',
    }),
  ],
  orderings: [{title: 'Newest', name: 'startsAtDesc', by: [{field: 'startsAt', direction: 'desc'}]}],
  preview: {
    select: {no: 'equipment.equipmentNo', station: 'equipment.complex.name', status: 'status', reason: 'reason'},
    prepare: ({no, station, status, reason}) => ({title: `${no} · ${station ?? ''}`, subtitle: `${status} · ${reason ?? ''}`}),
  },
})
