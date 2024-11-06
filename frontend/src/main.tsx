import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './Locales/i18n';
import { GoogleOAuthProvider } from "@react-oauth/google"
createRoot(document.getElementById('root')!).render(
  <GoogleOAuthProvider clientId='1095650684943-htf3297va7i5jcfl1ipmfmgo5963kbsi.apps.googleusercontent.com'>

  
    <StrictMode>
      <App />
    </StrictMode>,
  </GoogleOAuthProvider>
)
