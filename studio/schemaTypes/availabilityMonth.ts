import {defineField, defineType} from 'sanity'

// Embedded in equipment, not a document: 707 units x ~140 months would blow past the
// Free plan document limit. The newest 24 months live here; all-time stats are
// precomputed into equipment.reliability.
export const availabilityMonth = defineType({
  name: 'availabilityMonth',
  title: 'Monthly availability',
  type: 'object',
  fields: [
    defineField({name: 'month', type: 'date'}),
    defineField({name: 'availability24h', type: 'number', description: '0-1 share of hours in service.'}),
    defineField({name: 'amPeakAvailability', type: 'number'}),
    defineField({name: 'pmPeakAvailability', type: 'number'}),
    defineField({name: 'totalOutages', type: 'number'}),
    defineField({name: 'unscheduledOutages', type: 'number'}),
    defineField({name: 'entrapments', type: 'number', description: 'Times a rider was stuck inside.'}),
  ],
  preview: {
    select: {month: 'month', a: 'availability24h'},
    prepare: ({month, a}) => ({title: `${month}: ${a == null ? '?' : Math.round(a * 1000) / 10}%`}),
  },
})
