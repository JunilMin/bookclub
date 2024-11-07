import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Home from './screens/Home';
import Board from './screens/Board';
import About from './screens/About';
import NavBar from './components/NavBar';
import Login from './screens/Login';
import './App.css';



const App: React.FC = () => {
  return (
    <>
      <Router>
        <NavBar />
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/board" element={<Board />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </div>
      </Router>
    </>
  );
};

export default App;