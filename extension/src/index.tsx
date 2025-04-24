import React from 'react'
import ReactDOM from 'react-dom'
import { ExtensionProvider } from '@looker/extension-sdk-react'
import { ComponentsProvider } from '@looker/components'
import { App } from './App'

document.addEventListener('DOMContentLoaded', () => {
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)

  ReactDOM.render(
    <ExtensionProvider>
      <ComponentsProvider>
        <App />
      </ComponentsProvider>
    </ExtensionProvider>,
    root
  )
}) 