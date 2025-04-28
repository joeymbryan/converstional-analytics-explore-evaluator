import React from 'react'
import { ComponentsProvider, Page } from '@looker/components'
import { ExploreAnalyzer } from './components/ExploreAnalyzer'

export const App: React.FC = () => {
  return (
    <ComponentsProvider>
      <Page>
        <ExploreAnalyzer />
      </Page>
    </ComponentsProvider>
  )
} 