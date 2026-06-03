// ============================================================
// App — Root component with routing
// ============================================================
import { useEffect, useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppProvider, useApp } from './store/AppContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import QuestPage from './pages/QuestPage';
import GamePage from './pages/GamePage';
import ProgressPage from './pages/ProgressPage';
import WordBookPage from './pages/WordBookPage';
import InventoryPage from './pages/InventoryPage';
import SettingsPage from './pages/SettingsPage';
import './styles/minecraft.css';

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'quest', element: <QuestPage /> },
      { path: 'game/:modeId', element: <GamePage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'words', element: <WordBookPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

function AppBootstrap() {
  const { initializeApp, mergeVocabulary } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        await initializeApp();

        // Load vocabulary data
        try {
          const response = await fetch('./data/vocabulary.json');
          if (response.ok) {
            const manifest = await response.json();
            if (manifest.entries && manifest.entries.length > 0) {
              mergeVocabulary(manifest);
            }
          }
        } catch {
          console.log('No vocabulary data found. Add .md files to vocabulary/ and run parse.');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to initialize app');
      }
      setLoading(false);
    }

    bootstrap();
  }, [initializeApp, mergeVocabulary]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1A1A1A',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 48, animation: 'pulse 1s ease-in-out infinite' }}>⛏️</div>
        <span className="pixel-text" style={{ color: '#80FF20', fontSize: 12 }}>
          Loading English Craft...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1A1A1A',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <span style={{ fontSize: 48 }}>😞</span>
        <span className="pixel-text" style={{ color: '#FF5252', fontSize: 12 }}>
          Oops! Something went wrong.
        </span>
        <span style={{ color: '#AAA', fontSize: 12 }}>{error}</span>
        <button className="minecraft-button btn-stone" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <AppProvider>
      <AppBootstrap />
    </AppProvider>
  );
}
