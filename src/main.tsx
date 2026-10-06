import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { UserAreaProvider } from './contexts/UserAreaContext';
import { SocialPublishingProvider } from './contexts/SocialPublishingContext';
import './styles/global.css';
import './styles/auth-v2.css';
import './styles/user-area.css';
import './styles/pricing.css';
import './styles/image-optimization.css';
import './styles/admin.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <UserAreaProvider>
        <SocialPublishingProvider>
          <App />
        </SocialPublishingProvider>
      </UserAreaProvider>
    </AuthProvider>
  </React.StrictMode>
);
