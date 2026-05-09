import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import ReaderPage from './pages/ReaderPage';
import SettingsPage from './pages/SettingsPage';
import StandaloneReader from './pages/StandaloneReader';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'library',
        element: <LibraryPage />,
      },
      {
        path: 'reader',
        element: <ReaderPage />,
      },
      {
        path: 'standalone-reader',
        element: <StandaloneReader />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
]);
