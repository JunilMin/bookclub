import axios from "axios";


const axiosInstance = axios.create({
  baseURL: "http://localhost:8080/api",
  // withCredentials: true, // 쿠키 포함
  headers: {
    "Content-Type": "application/json",
  },
});



/**
 * Authorization 헤더를 동적으로 추가하는 메서드
 * @param token Access Token
 */
export const setAccessToken = (token: string) => {
  if (token) {
    axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete axiosInstance.defaults.headers.common["Authorization"];
  }
};


/**
 * 요청 인터셉터
 */
axiosInstance.interceptors.request.use(
  async (config) => {
    let token: string = axiosInstance.defaults.headers.common["Authorization"] as string;
    if (token && config.headers) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);
export default axiosInstance;

// import { isTokenExpiringSoon } from "../utils/tokenUtils";
// let isRefreshing = false; // 토큰 갱신 상태
// let subscribers: ((token: string) => void)[] = []; // 대기 중인 요청
/**
 * 갱신된 토큰을 모든 대기 중인 요청에 전달
 */
// const onRefreshed = (token: string) => {
//   subscribers.forEach((callback) => callback(token));
//   subscribers = [];
// };
/**
 * 요청 인터셉터
 */
// axiosInstance.interceptors.request.use(
//   async (config) => {
//     let token: string = axiosInstance.defaults.headers.common["Authorization"] as string;

    // // "Bearer <token>" 형식에서 토큰만 추출
    // if (typeof token === "string" && token.startsWith("Bearer ")) {
    //   token = token.split(" ")[1];
    // } else {
    //   token = '';
    // }

    // // 토큰이 만료되었는지 확인
    // if (token && isTokenExpiringSoon(token)) {
    //   if (!isRefreshing) {
    //     isRefreshing = true;

    //     try {
    //       const response = await axiosInstance.post("/auth/refresh-token", {}, { withCredentials: true });
    //       const newToken = response.data.token;

    //       if (newToken) {
    //         setAccessToken(newToken); // 갱신된 토큰 설정
    //         onRefreshed(newToken); // 대기 중인 요청에 갱신된 토큰 전달
    //       }
    //     } catch (error) {
    //       console.error("Failed to refresh token:", error);
    //       window.location.href = "/login"; // 로그인 페이지로 리디렉션
    //       return Promise.reject(error);
    //     } finally {
    //       isRefreshing = false;
    //     }
    //   }

    //   // 갱신된 토큰을 사용할 수 있도록 대기
    //   const retryOriginalRequest = new Promise<void>((resolve) => {
    //     subscribers.push((newToken: string) => {
    //       if (config.headers) {
    //         config.headers["Authorization"] = `Bearer ${newToken}`;
    //       }
    //       resolve();
    //     });
    //   });

    //   await retryOriginalRequest;
    // }

    // Authorization 헤더에 토큰 추가
//     if (token && config.headers) {
//       config.headers["Authorization"] = `Bearer ${token}`;
//     }

//     return config;
//   },
//   (error) => Promise.reject(error)
// );


