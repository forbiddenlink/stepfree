import {defineField, defineType} from 'sanity'

export const equipment = defineType({
  name: 'equipment',
  title: 'Elevator / escalator',
  type: 'document',
  description:
    'One elevator or escalator. Outages reference it. `alternativeRoute` is the MTA-written detour ' +
    'to use when it is out of service.',
  fields: [
    defineField({
      name: 'equipmentNo',
      type: 'string',
      description: 'MTA equipment code, e.g. "EL293". Join key to outages and availability history.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'kind',
      type: 'string',
      options: {list: ['elevator', 'escalator']},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'complex',
      type: 'reference',
      to: [{type: 'stationComplex'}],
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'lines', type: 'array', of: [{type: 'reference', to: [{type: 'line'}]}]}),
    defineField({name: 'serving', type: 'string', description: 'Where it goes, e.g. "Street to Brooklyn-bound platform".'}),
    defineField({name: 'shortDescription', type: 'string'}),
    defineField({name: 'isAda', type: 'boolean', description: 'Part of an ADA-accessible path.'}),
    defineField({name: 'isActive', type: 'boolean'}),
    defineField({
      name: 'isRedundant',
      type: 'boolean',
      description: 'Another unit serves the same path, so one outage does not break step-free access.',
    }),
    defineField({name: 'operatedByNyct', type: 'boolean'}),
    defineField({
      name: 'alternativeRoute',
      type: 'text',
      rows: 5,
      description: 'MTA-written detour when this unit is out. Prose; searched semantically.',
    }),
    defineField({
      name: 'reliability',
      type: 'object',
      description: 'Precomputed from the MTA monthly availability dataset (since 2015).',
      fields: [
        defineField({name: 'monthsTracked', type: 'number'}),
        defineField({name: 'availability12mo', type: 'number', description: 'Mean 24h availability, last 12 months (0-1).'}),
        defineField({name: 'amPeakAvailability12mo', type: 'number'}),
        defineField({name: 'unscheduledOutages12mo', type: 'number'}),
        defineField({name: 'entrapments12mo', type: 'number'}),
        defineField({name: 'entrapmentsAllTime', type: 'number'}),
        defineField({name: 'monthsSinceMajorImprovement', type: 'number'}),
      ],
    }),
    defineField({name: 'history', type: 'array', of: [{type: 'availabilityMonth'}]}),
  ],
  preview: {
    select: {no: 'equipmentNo', serving: 'serving', station: 'complex.name'},
    prepare: ({no, serving, station}) => ({title: `${no} · ${station ?? ''}`, subtitle: serving}),
  },
})
