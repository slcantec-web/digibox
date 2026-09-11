import React, { useEffect, useState } from 'react';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OperatorDashboard } from './components/OperatorDashboard';
import { OperatorLogin } from './components/OperatorLogin';
import { PublicFeedbackBox } from './components/PublicFeedbackBox';
import { Operator, Organization } from './types';

export default function App() {
  const [view, setView] = useState<'public' | 'operator-login' | 'operator-dashboard'>('public');
  const [currentBoxCode, setCurrentBoxCode] = useState<string>('CTP-CANTEEN');
  const [token, setToken] = useState<string | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Register service worker for PWA support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .catch((err) => console.log('SW registration error', err));
    }
  }, []);

  // Parse path or search params
  useEffect(() => {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    // Check box code from path /s/CTP-CANTEEN or ?box=CTP-CANTEEN
    if (pathname.startsWith('/s/')) {
      const code = pathname.replace('/s/', '').trim().toUpperCase();
      if (code) {
        setCurrentBoxCode(code);
        setView('public');
      }
    } else if (searchParams.get('box')) {
      setCurrentBoxCode(searchParams.get('box')!.toUpperCase());
      setView('public');
    } else if (pathname.startsWith('/operator/dashboard')) {
      setView('operator-dashboard');
    } else if (pathname.startsWith('/operator')) {
      setView('operator-login');
    }
  }, []);

  // Check saved session token
  useEffect(() => {
    async function verifySession() {
      const savedToken = localStorage.getItem('cb_operator_token');
      if (savedToken) {
        try {
          const res = await fetch('/api/operator/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            setToken(savedToken);
            setOperator(data.operator);
            setOrganization(data.organization);
            if (window.location.pathname.startsWith('/operator')) {
              setView('operator-dashboard');
            }
          } else {
            localStorage.removeItem('cb_operator_token');
          }
        } catch {
          // Keep offline or unauthenticated
        }
      }
      setCheckingAuth(false);
    }
    verifySession();
  }, []);

  const handleLoginSuccess = (newToken: string, newOp: Operator, newOrg: Organization) => {
    setToken(newToken);
    setOperator(newOp);
    setOrganization(newOrg);
    setView('operator-dashboard');
    window.history.pushState({}, '', '/operator/dashboard');
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/operator/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    localStorage.removeItem('cb_operator_token');
    setToken(null);
    setOperator(null);
    setOrganization(null);
    setView('operator-login');
    window.history.pushState({}, '', '/operator/login');
  };

  const handleOpenPublicView = (boxCode?: string) => {
    if (boxCode) {
      setCurrentBoxCode(boxCode);
    }
    setView('public');
    window.history.pushState({}, '', boxCode ? `/s/${boxCode}` : '/');
  };

  const handleNavigateToOperator = () => {
    if (token && operator && organization) {
      setView('operator-dashboard');
      window.history.pushState({}, '', '/operator/dashboard');
    } else {
      setView('operator-login');
      window.history.pushState({}, '', '/operator/login');
    }
  };

  return (
    <>
      <OfflineIndicator />

      {view === 'public' && (
        <PublicFeedbackBox
          initialBoxCode={currentBoxCode}
          onNavigateToOperator={handleNavigateToOperator}
        />
      )}

      {view === 'operator-login' && (
        <OperatorLogin
          onLoginSuccess={handleLoginSuccess}
          onBackToPublic={() => handleOpenPublicView()}
        />
      )}

      {view === 'operator-dashboard' && operator && organization && token && (
        <OperatorDashboard
          token={token}
          operator={operator}
          organization={organization}
          onLogout={handleLogout}
          onOpenPublicView={handleOpenPublicView}
        />
      )}

      {/* Fallback if directly opened /operator/dashboard while not logged in */}
      {view === 'operator-dashboard' && (!token || !operator) && !checkingAuth && (
        <OperatorLogin
          onLoginSuccess={handleLoginSuccess}
          onBackToPublic={() => handleOpenPublicView()}
        />
      )}
    </>
  );
}
