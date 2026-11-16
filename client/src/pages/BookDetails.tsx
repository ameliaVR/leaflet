
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import '../styles/bookdetails.css';

type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  condition: 'new' | 'good' | 'fair';
  listingType: 'exchange' | 'gift';
  status: string;
  createdAt: string;
  coverUrl: string | null;
  ownerName: string;
  ownerCity: string | null;
  ownerContact: string | null;
};

const API = '';

export default function BookDetails() {
  const { id } = useParams<{ id: string }>();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadBook() {
      if (!id) {
        setError('Некоректне посилання на книгу');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      setBook(null);

      try {
        const response = await fetch(
          `${API}/api/books/${encodeURIComponent(id)}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'Не вдалося завантажити книгу'
          );
        }

        setBook(data.book);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Помилка завантаження'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadBook();

    return () => controller.abort();
  }, [id]);

  function conditionLabel(condition: Book['condition']) {
    switch (condition) {
      case 'new':
        return 'Нова';
      case 'good':
        return 'Хороший стан';
      case 'fair':
        return 'Задовільний стан';
    }
  }

  if (loading) {
    return (
      <main className="book-details-page">
        <p>Завантаження книги...</p>
      </main>
    );
  }

  if (error || !book) {
    return (
      <main className="book-details-page">
        <Link to="/catalog" className="book-details-back">
          ← Повернутися до каталогу
        </Link>

        <div className="book-details-message" role="alert">
          <h1>Книгу не знайдено</h1>
          <p>{error || 'Це оголошення недоступне.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="book-details-page">
      <Link to="/catalog" className="book-details-back">
        ← Повернутися до каталогу
      </Link>

      <div className="book-details-layout">
        <div className="book-details-cover">
          {book.coverUrl ? (
            <img
              src={book.coverUrl.startsWith('https://') ? book.coverUrl : `${API}${book.coverUrl}`}
              alt={`Обкладинка книги ${book.title}`}
            />
          ) : (
            <span aria-label="Обкладинка відсутня">📖</span>
          )}
        </div>

        <section className="book-details-info">
          <p className="book-details-eyebrow">
            Книжковий простір Leaflet
          </p>

          <h1>{book.title}</h1>

          <p className="book-details-author">
            {book.author}
          </p>

          <div className="book-details-tags">
            <span>
              {book.listingType === 'exchange'
                ? '↔ Обмін'
                : '♡ Безкоштовно'}
            </span>

            <span>{conditionLabel(book.condition)}</span>
          </div>

          <div className="book-details-section">
            <h2>Про книгу</h2>

            <p>
              {book.description?.trim() ||
                'Власник поки не додав опис цієї книги.'}
            </p>
          </div>

          <div className="book-details-owner">
            <h2>Власник книги</h2>

            <div className="book-details-owner-top">
              <div className="book-details-avatar">
                {book.ownerName.trim().charAt(0).toUpperCase() || '?'}
              </div>

              <div>
                <strong>{book.ownerName}</strong>
                <p>{book.ownerCity || 'Місто не вказано'}</p>
              </div>
            </div>

            {book.ownerContact ? (
              <div className="book-details-contact">
                <p>Контакт для зв'язку</p>
                <strong>{book.ownerContact}</strong>
                <small>
                  Зв'яжіться з власником, щоб домовитися
                  про отримання або обмін книги.
                </small>
              </div>
            ) : (
              <p className="book-details-muted">
                Власник не опублікував контактні дані.
              </p>
            )}
          </div>

          <p className="book-details-date">
            Додано:{' '}
            {new Date(book.createdAt).toLocaleDateString('uk-UA')}
          </p>
        </section>
      </div>
    </main>
  );
}
