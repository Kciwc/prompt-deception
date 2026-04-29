import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import LobbyBrowser from './pages/LobbyBrowser';
import TVHost from './pages/TVHost';
import PlayerRoom from './pages/PlayerRoom';
import HostRemote from './pages/HostRemote';
import Admin from './pages/Admin';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LobbyBrowser />} />
          <Route path="/screen" element={<TVHost />} />
          <Route path="/screen/remote" element={<HostRemote />} />
          <Route path="/room/:code" element={<PlayerRoom />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
