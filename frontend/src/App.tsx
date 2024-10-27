import { useState } from 'react'
import './App.css'
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import Home from './screens/Home.tsx';
import Board from './screens/Board.tsx';
// import NavBar from './components/NavBar.tsx';
function App() {

  return (
    <>
      {/* <NavBar/> */}
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/board" element={<Board />} />
        </Routes>
      </Router>
      
    </>
  )
}

export default App
