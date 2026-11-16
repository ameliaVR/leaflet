
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import Layout from './components/Layout';

import Home from './pages/Home';
import Catalog from './pages/Catalog';
import BookDetails from './pages/BookDetails';
import AddBook from './pages/AddBook';
import Profile from './pages/Profile';
import Library from './pages/Library';
import AuthPage from './pages/Auth';
import MyBooks from './pages/MyBooks';

import './styles/global.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>

            {/* Публічні сторінки */}
            <Route index element={<Home />} />

            <Route
              path="catalog"
              element={<Catalog />}
            />

            {/* Детальна інформація про книгу */}
            <Route
              path="book/:id"
              element={<BookDetails />}
            />

            <Route
              path="login"
              element={<AuthPage mode="login" />}
            />

            <Route
              path="register"
              element={<AuthPage mode="register" />}
            />

            {/* Захищені сторінки */}
            <Route
              path="add-book"
              element={
                <RequireAuth>
                  <AddBook />
                </RequireAuth>
              }
            />

            <Route
              path="profile"
              element={
                <RequireAuth>
                  <Profile />
                </RequireAuth>
              }
            />

            <Route
              path="library"
              element={
                <RequireAuth>
                  <Library />
                </RequireAuth>
              }
            />

            <Route
              path="my-books"
              element={
                <RequireAuth>
                  <MyBooks />
                </RequireAuth>
              }
            />

          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
