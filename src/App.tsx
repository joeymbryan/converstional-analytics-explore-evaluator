import React, { useEffect, useState } from 'react'
import { ExtensionContext } from '@looker/extension-sdk-react'
import { useContext } from 'react'

const styles = {
  container: {
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  heading: {
    color: '#262D33',
  },
  text: {
    color: '#4A5568',
  },
  userInfo: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  }
}

export const App: React.FC = () => {
  const [userInfo, setUserInfo] = useState<string>('')
  const extensionContext = useContext(ExtensionContext)
  
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const sdk = extensionContext.core40SDK
        const me = await sdk.ok(sdk.me())
        setUserInfo(`Logged in as: ${me.display_name}`)
      } catch (error) {
        console.error('Error fetching user info:', error)
        setUserInfo('Error fetching user info')
      }
    }

    fetchUser()
  }, [extensionContext])

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Looker Extension</h1>
      <p style={styles.text}>Your extension is now running!</p>
      <div style={styles.userInfo}>
        <p style={styles.text}>{userInfo}</p>
      </div>
    </div>
  )
} 