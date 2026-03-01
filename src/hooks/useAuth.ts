import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/auth';

export function useAuth() {
  const { user, token, isAuthenticated, isOnboarded, setUser, logout, setOnboarded } = useAuthStore();

  const sendMagicLink = async (email: string) => {
    await authApi.sendMagicLink(email);
  };

  const verifyMagicLink = async (verifyToken: string) => {
    const res = await authApi.verifyMagicLink(verifyToken);
    const { user: u, token: t } = res.data;
    setUser(u, t);
  };

  const signOut = () => logout();

  return { user, token, isAuthenticated, isOnboarded, sendMagicLink, verifyMagicLink, signOut, setOnboarded };
}
