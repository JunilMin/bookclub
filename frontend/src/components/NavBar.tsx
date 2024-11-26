import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './styles/NavBar.css';
import Button from './Button';
import {useAuth} from '../AuthContext/AuthContext';
function NavBar() {
    const {user, handleLogout} = useAuth();
    const navigate = useNavigate();

    const handleLoginClick = () => {
        navigate('/login'); // 로그인 페이지로 이동
    };

    const handleLogoutButton = async () => {
        try {
            await handleLogout();
            console.log('로그아웃 성공');
        } catch (error) {
            console.error('로그아웃 실패:', error);
        }
    };
    return (
        <div className='nav-container'>
            <div className='left-nav-wrap'>
                <Link to="/">Home</Link>
                <Link to="/board">Dashboard</Link>
                <Link to="/about">About</Link>
            </div>
            {user ? (
                <button onClick= {handleLogoutButton}>
                Logout
                </button>
            ): (
                <div className='right-nav-wrap'>
                <Button style="filled" title="Login" size="normal" onClick={handleLoginClick}/>
            </div>
            )}
            
        
        </div>
  );
};

export default NavBar;