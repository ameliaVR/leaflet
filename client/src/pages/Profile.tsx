import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { User } from '../services/auth';
import '../styles/profile.css';

function ProfileForm({ account }: { account: User }) {
  const { updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(account.fullName || '');
  const [city, setCity] = useState(account.city || '');
  const [about, setAbout] = useState(account.about || '');
  const [contact, setContact] = useState(account.contact || '');
  const [showContact, setShowContact] = useState(account.showContact === true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setSaved(false);
    setError('');

    try {
      await updateProfile({
        fullName: name.trim(),
        city: city.trim(),
        about: about.trim(),
        contact: contact.trim(),
        showContact,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка збереження');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setError('Не вдалося вийти. Спробуйте ще раз.');
    }
  }

  return (
    <main>
      <button
        type="button"
        className="back-btn"
        onClick={() => navigate(-1)}
      >
        ← Назад
      </button>

      <p className="eyebrow">Налаштування акаунта</p>
      <h1>Профіль</h1>
      <p className="subtitle">
        Керуйте особистою інформацією та контактами для обміну книгами.
      </p>

      <div className="layout">
        <section className="card profile-card">
          <div className="avatar-wrap">
            <div className="avatar-lg">
              {name.trim().slice(0, 2).toUpperCase() || '?'}
            </div>
          </div>
          <h2 className="profile-name">{name || 'Ім’я Прізвище'}</h2>
          <p className="profile-email">{account.email}</p>
        </section>

        <form className="card" onSubmit={submit}>
          <div className="field">
            <label htmlFor="fullName">Повне ім’я</label>
            <input
              id="fullName"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="city">Місто</label>
            <input
              id="city"
              maxLength={100}
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setSaved(false);
              }}
            />
          </div>

          <div className="field field-wide">
            <label htmlFor="about">Про себе</label>
            <textarea
              id="about"
              maxLength={1000}
              value={about}
              onChange={(event) => {
                setAbout(event.target.value);
                setSaved(false);
              }}
            />
          </div>

          <div className="field field-wide">
            <label htmlFor="contact">Контакт для зв’язку (Telegram або email)</label>
            <input
              id="contact"
              maxLength={200}
              value={contact}
              onChange={(event) => {
                setContact(event.target.value);
                setSaved(false);
              }}
              placeholder="Наприклад, @username"
            />
          </div>

          <div className="field field-wide">
            <label>
              <input
                type="checkbox"
                checked={showContact}
                onChange={(event) => {
                  setShowContact(event.target.checked);
                  setSaved(false);
                }}
              />{' '}
              Дозволити показувати контакт іншим користувачам
            </label>
          </div>

          {error && <p role="alert" className="auth-error">{error}</p>}
          <button className="btn" disabled={busy} type="submit">
            {busy ? 'Збереження…' : 'Зберегти зміни'}
          </button>
          {saved && <p role="status">Зміни збережено ✓</p>}
        </form>
      </div>

      <p style={{ marginTop: 24 }}>
        <button type="button" className="auth-logout" onClick={handleLogout}>
          Вийти з акаунта
        </button>
      </p>
    </main>
  );
}

export default function Profile() {
  const { user, loading } = useAuth();

  if (loading) {
    return <main><p>Завантаження профілю…</p></main>;
  }

  if (!user) {
    return <main><p>Увійдіть, щоб переглянути профіль.</p></main>;
  }

  // Зміна ID повністю скидає поля форми попереднього акаунта.
  return <ProfileForm key={user.id} account={user} />;
}
