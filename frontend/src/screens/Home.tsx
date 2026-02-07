import { useTranslation } from 'react-i18next';

const Home: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div>
            <h1>{t('home_welcome')}</h1>
            <p>{t('home_description')}</p>
        </div>
    )
}
export default Home
