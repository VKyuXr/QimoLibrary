import { Box } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout: React.FC = () => {
  return (
    <Box className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Sidebar />
      <Box className="flex-1 h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
