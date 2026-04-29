import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LobbyBrowser from './pages/LobbyBrowser';
import TVHost from './pages/TVHost';
import PlayerRoom from './pages/PlayerRoom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LobbyBrowser />} />
        <Route path="/screen" element={<TVHost />} />
        <Route path="/room/:code" element={<PlayerRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
