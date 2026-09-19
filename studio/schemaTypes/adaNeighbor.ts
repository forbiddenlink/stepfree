import {defineField, defineType} from 'sanity'

// One edge in the step-free graph: from a station complex, riding these lines in this
// direction, the next station complex with an accessible elevator is `complex`.
// Source: the MTA equipment feed's nextadanorth / nextadasouth fields.
export const adaNeighbor = defineType({
  name: 'adaNeighbor',
  title: 'Next accessible station',
  type: 'object',
  fields: [
    defineField({
      name: 'direction',
      type: 'string',
      options: {list: ['north', 'south']},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'complex',
      type: 'reference',
      to: [{type: 'stationComplex'}],
      weak: true,
      description: 'The next station complex in this direction that has an ADA elevator.',
    }),
    defineField({
      name: 'lines',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'line'}]}],
      description: 'Lines that make this hop.',
    }),
  ],
  preview: {
    select: {direction: 'direction', to: 'complex.name'},
    prepare: ({direction, to}) => ({title: `${direction} → ${to ?? 'unknown'}`}),
  },
})
