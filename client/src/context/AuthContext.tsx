import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type User } from '../services/auth';

type ProfileData = Pick<
  User,
  'fullName' | 'city' | 'about' | 'contact' | 'showContact'
>;

type Auth = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: ProfileData) => Promise<void>;
};

const Context = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Запізніла відповідь /api/auth/me не має перезаписувати новий вхід.
  const authRequest = useRef(0);

  useEffect(() => {
    const request = ++authRequest.current;

    authApi
      .me()
      .then((response) => {
        if (request === authRequest.current) {
          setUser(response.user);
        }
      })
      .catch(() => {
        if (request === authRequest.current) {
          setUser(null);
        }
      })
      .finally(() => {
        if (request === authRequest.current) {
          setLoading(false);
        }
      });

    return () => {
      authRequest.current++;
    };
  }, []);

  async function login(email: string, password: string) {
    const request = ++authRequest.current;
    try {
      const response = await authApi.login(email, password);
      if (request === authRequest.current) {
        setUser(response.user);
      }
    } finally {
      if (request === authRequest.current) {
        setLoading(false);
      }
    }
  }

  async function register(name: string, email: string, password: string) {
    const request = ++authRequest.current;
    try {
      const response = await authApi.register(name, email, password);
      if (request === authRequest.current) {
        setUser(response.user);
      }
    } finally {
      if (request === authRequest.current) {
        setLoading(false);
      }
    }
  }

  async function logout() {
    const request = ++authRequest.current;
    try {
      await authApi.logout();
      if (request === authRequest.current) {
        setUser(null);
      }
    } finally {
      if (request === authRequest.current) {
        setLoading(false);
      }
    }
  }

  async function updateProfile(data: ProfileData) {
    const response = await authApi.saveProfile(data);

    // Не дозволяємо запізнілому збереженню змінити інший акаунт у UI.
    setUser((current) =>
      current?.id === response.user.id ? response.user : current
    );
  }

  return (
    <Context.Provider
      value={{ user, loading, login, register, logout, updateProfile }}
    >
      {children}
    </Context.Provider>
  );
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) {
    throw new Error('AuthProvider missing');
  }
  return value;
}
