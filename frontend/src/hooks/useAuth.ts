import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { loginThunk, logoutThunk, fetchMeThunk } from '../store/slices/authSlice';

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, isLoading, isAuthenticated, accessToken } = useSelector(
    (s: RootState) => s.auth
  );

  const login = (email: string, password: string) =>
    dispatch(loginThunk({ email, password }));

  const logout = () => dispatch(logoutThunk());
  const fetchMe = () => dispatch(fetchMeThunk());

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  return { user, isLoading, isAuthenticated, accessToken, login, logout, fetchMe, isAdmin, isSuperAdmin };
}
