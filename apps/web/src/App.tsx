import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import HostPage from './pages/HostPage'
import PlayerPage from './pages/PlayerPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/host/:code" element={<HostPage />} />
        <Route path="/play/:code" element={<PlayerPage />} />
      </Routes>
    </BrowserRouter>
  )
}
