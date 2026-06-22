import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../utils/api';
import { User, AuthState } from '../../types';

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  isLoading: false,
  isAuthenticated: false,
};

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post<{ data: { user: User; accessToken: string; refreshToken?: string } }>(
        '/auth/login', credentials
      );
      const data = res.data.data!;
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      return data;
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error || 'Login failed';
      return rejectWithValue(message);
    }
  }
);

export const registerThunk = createAsyncThunk(
  'auth/register',
  async (
    payload: { email: string; username: string; full_name: string; password: string; referral_code?: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await api.post<{ message: string }>('/auth/register', payload);
      return res.data;
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error || 'Registration failed';
      return rejectWithValue(message);
    }
  }
);

export const fetchMeThunk = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get<{ data: User }>('/auth/me');
    return res.data.data!;
  } catch {
    return rejectWithValue('Session expired');
  }
});

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  try {
    await api.post('/auth/logout');
  } catch {}
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTokens(state, action: PayloadAction<{ accessToken: string }>) {
      state.accessToken = action.payload.accessToken;
      localStorage.setItem('accessToken', action.payload.accessToken);
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('accessToken');
    },
    updateUser(state, action: PayloadAction<Partial<User>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => { state.isLoading = true; })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.isAuthenticated = true;
        localStorage.setItem('accessToken', action.payload.accessToken);
      })
      .addCase(loginThunk.rejected, (state) => { state.isLoading = false; })

      .addCase(fetchMeThunk.pending, (state) => { state.isLoading = true; })
      .addCase(fetchMeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(fetchMeThunk.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.accessToken = null;
        state.isAuthenticated = false;
        localStorage.removeItem('accessToken');
      })

      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.isAuthenticated = false;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      });
  },
});

export const { setTokens, logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
