import React from 'react'
import ReactDOM from 'react-dom'
import { ExtensionProvider } from '@looker/extension-sdk-react'
import { App } from './App'
import './index.css'

const rootElement = document.createElement('div')
rootElement.id = 'root'
document.body.appendChild(rootElement)

const Extension = () => (
  <ExtensionProvider>
    <App />
  </ExtensionProvider>
)

ReactDOM.render(<Extension />, rootElement) 