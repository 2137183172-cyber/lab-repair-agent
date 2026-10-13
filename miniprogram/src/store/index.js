import { defineStore } from 'pinia';
import { wxLogin, getToken, setToken, clearToken } from '@/api/index';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken() || '',
    userInfo: null,
    isEngineer: false,
    isLoggedIn: false
  }),
  getters: {
    userId: (state) => state.userInfo?.id,
    role: (state) => state.userInfo?.role
  },
  actions: {
    async login(code, profile = {}) {
      try {
        const result = await wxLogin(code, profile);
        setToken(result.token);
        this.token = result.token;
        this.userInfo = result.user;
        this.isEngineer = result.user.role === 'engineer';
        this.isLoggedIn = true;
        return result;
      } catch (err) {
        throw err;
      }
    },
    logout() {
      clearToken();
      this.token = '';
      this.userInfo = null;
      this.isEngineer = false;
      this.isLoggedIn = false;
    },
    async fetchProfile() {
      try {
        const { getUserProfile } = await import('@/api/index');
        this.userInfo = await getUserProfile();
        this.isEngineer = this.userInfo.role === 'engineer';
        this.isLoggedIn = true;
      } catch (e) {
        // ignore
      }
    }
  }
});
