
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/catalog.css';

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

type SortMode = 'new' | 'title';

const API = 'http://127.0.0.1:3001';

export default function Catalog() {
  const [books, setBooks] = useState<Book[]>([]);
  const [q, setQ] = useState('');
  const [type, setType] = useState<
    'all' | 'exchange' | 'gift'
  >('all');
  const [sort, setSort] = useState<SortMode>('new');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Завантаження книг із PostgreSQL
  useEffect(() => {
    const controller = new AbortController();

    async function loadBooks() {
      try {
        const response = await fetch(`${API}/api/books`, {
          signal: controller.signal
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'Не вдалося завантажити каталог'
          );
        }

        setBooks(data.books);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : 'Помилка'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadBooks();

    return () => controller.abort();
  }, []);

  // Пошук, фільтрація та сортування
  const filteredBooks = useMemo(() => {
    const query = q.trim().toLocaleLowerCase('uk');

    const result = books.filter(book => {
      if (book.status !== 'available') return false;

      const matchesSearch = `${book.title} ${book.author}`
        .toLocaleLowerCase('uk')
        .includes(query);

      const matchesType =
        type === 'all' || book.listingType === type;

      return matchesSearch && matchesType;
    });

    result.sort((a, b) => {
      if (sort === 'title') {
        return a.title.localeCompare(b.title, 'uk');
      }

      return (
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      );
    });

    return result;
  }, [books, q, type, sort]);

  function resetFilters() {
    setQ('');
    setType('all');
    setSort('new');
  }

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

  return (
    <main className="catalog-page">
      <p className="eyebrow">Книжковий простір</p>

      <h1>Знайдіть наступну історію</h1>

      <p className="catalog-subtitle">
        Знаходьте книги для обміну або безкоштовної передачі.
        Подаруйте прочитаним історіям нове життя.
      </p>

      <Link className="catalog-add" to="/my-books">
        + Додати свою книгу
      </Link>

      <div className="catalog-toolbar">
        <label className="catalog-field">
          <span>Пошук</span>
          <input
            type="search"
            placeholder="Назва книги або автор"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </label>

        <label className="catalog-field">
          <span>Спосіб передачі</span>
          <select
            value={type}
            onChange={e =>
              setType(e.target.value as typeof type)
            }
          >
            <option value="all">Усі книги</option>
            <option value="exchange">Обмін</option>
            <option value="gift">Безкоштовно</option>
          </select>
        </label>

        <label className="catalog-field">
          <span>Сортування</span>
          <select
            value={sort}
            onChange={e =>
              setSort(e.target.value as SortMode)
            }
          >
            <option value="new">Нещодавно додані</option>
            <option value="title">За назвою</option>
          </select>
        </label>
      </div>

      <div className="catalog-results">
        <span>Знайдено книг: {filteredBooks.length}</span>

        <button
          type="button"
          onClick={resetFilters}
          className="catalog-reset"
        >
          Скинути фільтри
        </button>
      </div>

      {error && (
        <p className="catalog-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="catalog-empty">
          Завантаження каталогу...
        </div>
      ) : !error && filteredBooks.length === 0 ? (
        <div className="catalog-empty">
          <h2>Нічого не знайдено</h2>
          <p>
            Спробуйте змінити пошуковий запит або фільтри.
          </p>
        </div>
      ) : (
        <section className="catalog-grid">
          {filteredBooks.map(book => (
  <Link
    to={`/book/${book.id}`}
    className="catalog-card"
    key={book.id}
    aria-label={`Детальніше про книгу ${book.title}`}
  >
              <div className="catalog-cover">
                {book.coverUrl ? (
                  <img
                    src={`${API}${book.coverUrl}`}
                    alt={`Обкладинка книги ${book.title}`}
                    loading="lazy"
                  />
                ) : (
                  <span>📖</span>
                )}
              </div>

              <div className="catalog-card-content">
                <h2>{book.title}</h2>

                <p className="catalog-author">
                  {book.author}
                </p>

                <div className="catalog-tags">
                  <span>
                    {book.listingType === 'exchange'
                      ? 'Обмін'
                      : 'Безкоштовно'}
                  </span>

                  <span>
                    {conditionLabel(book.condition)}
                  </span>
                </div>

                {book.description && (
                  <p className="catalog-description">
                    {book.description}
                  </p>
                )}

                <div className="catalog-owner">
                  <p>
                    <strong>Власник:</strong> {book.ownerName}
                  </p>

                  {book.ownerCity && (
                    <p>
                      <strong>Місто:</strong> {book.ownerCity}
                    </p>
                  )}

                  {book.ownerContact ? (
                    <p>
                      <strong>Контакт:</strong>{' '}
                      <span className="catalog-contact">
                        {book.ownerContact}
                      </span>
                    </p>
                  ) : (
                    <p className="catalog-muted">
                      Контакт не опублікований
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
