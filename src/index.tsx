import React from 'react'
import ReactDOM from 'react-dom'
import { ExtensionProvider } from '@looker/extension-sdk-react'
import { App } from './App'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('No root element found')
}

ReactDOM.render(
  <React.StrictMode>
    <ExtensionProvider>
      <App />
    </ExtensionProvider>
  </React.StrictMode>,
  rootElement
) 