import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LobbyBrowser from './pages/LobbyBrowser';
import TVHost from './pages/TVHost';
import PlayerRoom from './pages/PlayerRoom';
import Admin from './pages/Admin';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LobbyBrowser />} />
        <Route path="/screen" element={<TVHost />} />
        <Route path="/room/:code" element={<PlayerRoom />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
