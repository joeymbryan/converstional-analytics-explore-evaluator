import React from 'react'
import ReactDOM from 'react-dom'
import { ExtensionProvider, ExtensionProviderProps } from '@looker/extension-sdk-react'
import { App } from './App'
import './index.css'

const initialize = () => {
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)
  
  const extensionProviderProps: ExtensionProviderProps = {
    loadingComponent: <div>Loading ExploreWise...</div>,
    requiredLookerVersion: '>=22.0.0',
    onInitializeError: (error) => {
      console.error('Extension initialization error:', error)
      return <div>Error initializing extension: {error.message}</div>
    }
  }

  ReactDOM.render(
    <ExtensionProvider {...extensionProviderProps}>
      <App />
    </ExtensionProvider>,
    root
  )
}

// Initialize the extension
initialize()

// Export the initialization function for Looker
export default initialize 