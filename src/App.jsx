import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Tournament from './pages/Tournament';
import CenturyChallenge from './pages/CenturyChallenge';
import QuickMatch from './pages/QuickMatch';
import Admin from './pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tournament" element={<Tournament />} />
        <Route path="/century" element={<CenturyChallenge />} />
        <Route path="/quickmatch" element={<QuickMatch />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
