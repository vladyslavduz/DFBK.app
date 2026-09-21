import AuthModal from '../components/AuthModal';
import { navigate } from '../lib/router';

export default function LoginPage() {
  return <div className="app-gate-background"><div className="app-gate-preview" aria-hidden="true"><img src="/brand/dfbk-logo.svg" alt="" /><div /><div /><div /></div><AuthModal open initialMode="login" onClose={() => navigate('/')} onAuthenticated={() => navigate('/app')} /></div>;
}
