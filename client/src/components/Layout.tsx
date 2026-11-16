
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Ініціали користувача для аватара
  const initials = user?.fullName
    ?.trim()
    .split(/\s+/)
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  // Вихід з акаунта
  async function signOut() {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      alert('Не вдалося вийти. Спробуйте ще раз.');
    }
  }

  return (
    <>
      {/* ВЕРХНЄ МЕНЮ */}
      <header className="header">
        <NavLink className="brand" to="/">
          <span className="brand-logo">▤</span>
          Leaflet
        </NavLink>

        <nav className="top-nav">
          <NavLink to="/">
            Головна
          </NavLink>

          <NavLink to="/catalog">
            Каталог книг
          </NavLink>

          {user && (
            <>
              <NavLink to="/library">
                Моя бібліотека
              </NavLink>

              <NavLink to="/my-books">
                Мої книги
              </NavLink>
            </>
          )}

          {!user && (
            <>
              <NavLink to="/login">
                Увійти
              </NavLink>

              <NavLink to="/register">
                Реєстрація
              </NavLink>
            </>
          )}

          {user && (
            <button
              type="button"
              className="auth-logout"
              onClick={signOut}
            >
              Вийти
            </button>
          )}
        </nav>

        {/* Аватар користувача */}
        <NavLink
          className="avatar-sm"
          to={user ? '/profile' : '/login'}
          aria-label="Відкрити профіль"
        >
          {initials}
        </NavLink>
      </header>

      {/* ВМІСТ ПОТОЧНОЇ СТОРІНКИ */}
      <Outlet />

      {/* НИЖНЄ МЕНЮ */}
      <nav className="nav">
        <NavLink to="/">
          ⌂ Головна
        </NavLink>

        <NavLink to="/catalog">
          ▤ Каталог
        </NavLink>

        <NavLink to={user ? '/library' : '/login'}>
         Бібліотека
        </NavLink>

        <NavLink to={user ? '/my-books' : '/login'}>
         Мої книги
        </NavLink>

        <NavLink to={user ? '/profile' : '/login'}>
          ◉ {user ? 'Профіль' : 'Увійти'}
        </NavLink>
      </nav>
    </>
  );
}
