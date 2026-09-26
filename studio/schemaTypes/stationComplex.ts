import {defineField, defineType} from 'sanity'

export const stationComplex = defineType({
  name: 'stationComplex',
  title: 'Station complex',
  type: 'document',
  description:
    'A station complex (MTA "MRN"). Transfers inside a complex happen without leaving the station. ' +
    'Equipment references its complex; step-free routing walks the adaNeighbors edges.',
  fields: [
    defineField({name: 'name', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'complexId',
      type: 'string',
      description: 'MTA station complex MRN, the join key across every MTA dataset.',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'borough', type: 'string'}),
    defineField({name: 'location', type: 'geopoint'}),
    defineField({
      name: 'lines',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'line'}]}],
    }),
    defineField({
      name: 'adaStatus',
      type: 'string',
      options: {list: ['full', 'partial', 'none']},
      description: 'Full = step-free to every platform. Partial = some directions only.',
    }),
    defineField({
      name: 'adaNeighbors',
      type: 'array',
      of: [{type: 'adaNeighbor'}],
      description: 'Step-free graph edges to the next accessible complex per line and direction.',
    }),
    defineField({
      name: 'stopNames',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Names of the stations inside this complex, as riders know them (e.g. "Atlantic Av-Barclays Ctr").',
    }),
    defineField({name: 'busConnections', type: 'array', of: [{type: 'string'}]}),
    defineField({name: 'gtfsStopIds', type: 'array', of: [{type: 'string'}]}),
  ],
  preview: {select: {title: 'name', subtitle: 'complexId'}},
})
