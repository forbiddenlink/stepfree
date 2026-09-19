import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '19mt1buh',
    dataset: 'production'
  },
  deployment: {
    appId: 'tardfr4dx639irjo8vliypfl',
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
  },
})
