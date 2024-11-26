// // src/store/useAuthStore.tsx
// import { create } from "zustand";
// import { createContext, useContext, ReactNode } from "react";
// import { login as apiLogin, googleLogin as apiGoogleLogin, logout as apiLogout } from "../api/auth";
// import { getUserByUsername, User } from "../api/user";

// interface AuthStore {
//   isLoggedIn: boolean;
//   accessToken: string | null;
//   user: User | null;
//   login: (username: string, password: string) => Promise<void>;
//   googleLogin: (email: string, name: string) => Promise<void>;
//   logout: () => Promise<void>;
// }

// const AuthContext = createContext<ReturnType<typeof useAuthStore> | null>(null);

// // Provider 컴포넌트
// export const AuthProvider = () => {
//   const store = useAuthStore();
//   return <AuthContext.Provider value={store}></AuthContext.Provider>;
// };

// // Hook: Context를 사용하는 Custom Hook
// export const useAuthProvider = () => {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error("useAuthProvider must be used within an AuthProvider");
//   }
//   return context;
// };

// const useAuthStore = create<AuthStore>((set) => ({
//   isLoggedIn: false,
//   accessToken: null,
//   user: null,

//   login: async (username, password) => {
//     try {
//       const response = await apiLogin({ username, password });
//       const { token } = response;
//       const userResponse: User = await getUserByUsername(username);
//       set({
//         isLoggedIn: true,
//         accessToken: token,
//         user: userResponse,
//       });
//     } catch (error) {
//       console.error("Login failed:", error);
//       throw new Error("로그인에 실패했습니다.");
//     }
//   },

//   googleLogin: async (email, name) => {
//     try {
//       const response = await apiGoogleLogin({ email, name });
//       const { token } = response;
//       const userResponse: User = await getUserByUsername(name);
//       set({
//         isLoggedIn: true,
//         accessToken: token,
//         user: userResponse,
//       });
//     } catch (error) {
//       console.error("Google login failed:", error);
//       throw new Error("Google 로그인에 실패했습니다.");
//     }
//   },

//   logout: async () => {
//     try {
//       await apiLogout();
//       set({
//         isLoggedIn: false,
//         accessToken: null,
//         user: null,
//       });
//     } catch (error) {
//       console.error("Logout failed:", error);
//       throw new Error("로그아웃에 실패했습니다.");
//     }
//   },
// }));

// export const useAuth = () => {
//   return useContext(AuthContext);
// }

// export default useAuthStore;
