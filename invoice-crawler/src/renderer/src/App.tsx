import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, Settings, Sliders, Snowflake } from 'lucide-react';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import FieldEditorPage from './pages/FieldEditorPage';
import ProcessingPage from './pages/ProcessingPage';
import ResultsPage from './pages/ResultsPage';
import clsx from 'clsx';

export default function App() {
  const location = useLocation();
  const isFullScreen = ['/processing', '/results'].includes(location.pathname);

  return (
    <div className="flex h-full w-full">
      {!isFullScreen && <Sidebar />}
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="h-full"
          >
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/fields" element={<FieldEditorPage />} />
              <Route path="/processing" element={<ProcessingPage />} />
              <Route path="/results" element={<ResultsPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="w-60 border-r border-ice-border bg-ice-surface/40 backdrop-blur-ice flex flex-col">
      <div className="px-5 py-6 flex items-center gap-3 border-b border-ice-border">
        <div className="w-9 h-9 rounded-lg bg-ice-accent-soft border border-ice-accent/40 flex items-center justify-center shadow-glow-sm">
          <Snowflake className="w-5 h-5 text-ice-accent" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Invoice Crawler</div>
          <div className="text-[10px] text-ice-text-dim uppercase tracking-wider">v2.0</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        <NavItem to="/" icon={<Home className="w-4 h-4" />} label="Home" />
        <NavItem to="/fields" icon={<Sliders className="w-4 h-4" />} label="Fields" />
        <NavItem to="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" />
      </nav>
      <div className="p-4 text-[11px] text-ice-text-dim border-t border-ice-border">
        Built for accountancy firms
      </div>
    </aside>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
          isActive
            ? 'bg-ice-accent-soft border border-ice-accent/40 text-ice-text shadow-glow-sm'
            : 'text-ice-text-muted border border-transparent hover:bg-ice-surface-2 hover:text-ice-text',
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
