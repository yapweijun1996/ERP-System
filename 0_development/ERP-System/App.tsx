

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { MainLayout } from './components/Layout/MainLayout';
import { PageRouter } from './components/Router/PageRouter';
import { LoginPage } from './pages/auth/LoginPage';
import { OnboardingWizard } from './pages/auth/OnboardingWizard';
import { DatabaseSetupGuard } from './components/Setup/DatabaseSetupGuard';
import { ToastContainer } from './components/UI/Toast';
import { OfflineIndicator } from './components/UI/OfflineIndicator';
import { AppSplash } from './components/UI/AppSplash';
import metadata from './metadata.json';


const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, activeClient } = useApp();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [detailId, setDetailId] = useState<string | null>(null);

  const handleNavigate = (page: string, id?: string) => {
    setCurrentPage(page);
    if (id !== undefined) setDetailId(id);
    else if (!page.includes('detail')) setDetailId(null);
  };

  if (isLoading) {
    return (
      <>
        <AppSplash
          appName={metadata?.name || 'Nexus ERP'}
          subtitle="系统启动中"
          message="正在恢复登录状态..."
        />
        <ToastContainer />
        <OfflineIndicator />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
        <OfflineIndicator />
      </>
    );
  }

  // New Onboarding Interceptor
  if (activeClient?.status === 'Onboarding') {
    return (
      <>
        <OnboardingWizard />
        <ToastContainer />
        <OfflineIndicator />
      </>
    );
  }

  return (
    <MainLayout currentPage={currentPage} onNavigate={handleNavigate}>
      <PageRouter
        currentPage={currentPage}
        detailId={detailId}
        onNavigate={handleNavigate}
      />
    </MainLayout>
  );
};

const App: React.FC = () => {
  return (
    <DatabaseSetupGuard>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </DatabaseSetupGuard>
  );
};

export default App;
