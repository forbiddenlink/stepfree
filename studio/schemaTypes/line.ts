import {defineField, defineType} from 'sanity'

export const line = defineType({
  name: 'line',
  title: 'Line',
  type: 'document',
  description: 'A subway (or connecting rail) service, e.g. "L" or "A". Stations and equipment reference lines.',
  fields: [
    defineField({
      name: 'code',
      type: 'string',
      description: 'Service bullet as the MTA writes it: "1", "A", "SIR", "LIRR".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'isSubway',
      type: 'boolean',
      description: 'False for connecting services (LIRR, Metro-North) that share a station complex.',
    }),
  ],
  preview: {select: {title: 'code'}},
})
