import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './styles/NavBar.css';
import Button from './Button';
import LanguageToggle from './LanguageToggle';
import AccountDropdown from './AccountDropdown';
import {useAuth} from '../AuthContext/AuthContext';

function NavBar() {
    const { t } = useTranslation();
    const {user, isLoading} = useAuth();
    const navigate = useNavigate();

    const handleLoginClick = () => {
        navigate('/login');
    };

    return (
        <div className='nav-container'>
            <div className='nav-wrapper'>
                <div className='nav-inner-container'>
                    <div className='left-nav-wrap'>
                        <p>Mammalias</p>
                    </div>
                    <div className='mid-nav-wrap'>
                        <Link to="/">{t('nav_dashboard')}</Link>
                        <Link to="/about">{t('nav_about')}</Link>
                        <Link to="/revolution">{t('nav_revolution')}</Link>
                        <Link to="/help">{t('nav_contact')}</Link>
                    </div>
                    <div className='right-nav-wrap'>
                        <LanguageToggle />
                        {isLoading ? (
                            <span>{t('loading')}</span>
                        ) : user ? (
                            <AccountDropdown />
                        ) : (
                            <Button style="filled" title={t('nav_login')} size="normal" onClick={handleLoginClick}/>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default NavBar;