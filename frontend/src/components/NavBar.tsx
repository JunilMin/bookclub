import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './styles/NavBar.css';
import Button from './Button';

function NavBar() {
    const navigate = useNavigate();
    const handleLoginClick = () => {
        navigate('/login'); // 로그인 페이지로 이동
    };
    return (
        <div className='nav-container'>
            <div className='left-nav-wrap'>
                <Link to="/">Home</Link>
                <Link to="/board">Dashboard</Link>
                <Link to="/about">About</Link>
            </div>
            <div className='right-nav-wrap'>
                <Button style="filled" title="Login" size="normal" onClick={handleLoginClick}/>
            </div>
        
        </div>
  );
};

export default NavBar;