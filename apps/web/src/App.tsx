import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/ui';
import { useAuth } from './lib/auth';
import { AtRiskPage } from './pages/AtRisk';
import { AuthPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { DishesPage, IngredientsPage } from './pages/Catalog';
import { Landing } from './pages/Landing';
import { SpecialsPage } from './pages/Specials';
import { StockPage } from './pages/Stock';
import { TeamPage } from './pages/Team';
import type { ReactNode } from 'react';

function Protected({ children, ownerOnly }: { children: ReactNode; ownerOnly?: boolean }) {
  const { user, loading, isOwner } = useAuth();
  if (loading) return <Spinner label="Loading your workspace" />;
  if (!user) return <Navigate to="/login" replace />;
  if (ownerOnly && !isOwner) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route
        path="/app"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="at-risk" element={<AtRiskPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="specials" element={<SpecialsPage />} />
        <Route path="ingredients" element={<Protected ownerOnly><IngredientsPage /></Protected>} />
        <Route path="dishes" element={<Protected ownerOnly><DishesPage /></Protected>} />
        <Route path="team" element={<Protected ownerOnly><TeamPage /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
