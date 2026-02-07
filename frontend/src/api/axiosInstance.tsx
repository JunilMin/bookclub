import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const axiosInstance = axios.create({
  baseURL: "http://localhost:8080/api",
  withCredentials: true, // 쿠키 포함
  headers: {
    "Content-Type": "application/json",
  },
});

// 토큰 재발급 함수 (외부에서 주입)
let tokenRefreshHandler: (() => Promise<string | null>) | null = null;

/**
 * 토큰 재발급 핸들러 설정 (AuthContext에서 호출)
 */
export const setTokenRefreshHandler = (handler: () => Promise<string | null>) => {
  tokenRefreshHandler = handler;
};

// 토큰 재발급 상태 관리
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}> = [];

/**
 * 대기 중인 요청들 처리
 */
const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

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
    const token = axiosInstance.defaults.headers.common["Authorization"] as string;
    // Token already has "Bearer " prefix from setAccessToken, so just use it directly
    if (token && config.headers) {
      config.headers["Authorization"] = token;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 응답 인터셉터 - 401 에러 시 토큰 재발급 후 재시도
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      skipAuthRetry?: boolean;  // 로그인 과정에서 재시도 스킵용
    };

    // skipAuthRetry 플래그가 있으면 재시도하지 않음 (로그인 과정)
    if (originalRequest?.skipAuthRetry) {
      return Promise.reject(error);
    }

    // 401 에러이고 아직 재시도하지 않은 경우
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 토큰 재발급 핸들러가 없으면 그냥 에러 반환
      if (!tokenRefreshHandler) {
        return Promise.reject(error);
      }

      // 이미 토큰 재발급 중이면 대기열에 추가
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token && originalRequest.headers) {
              originalRequest.headers["Authorization"] = `Bearer ${token}`;
            }
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await tokenRefreshHandler();

        if (newToken) {
          processQueue(null, newToken);

          // 원래 요청 재시도
          if (originalRequest.headers) {
            originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
          }
          return axiosInstance(originalRequest);
        } else {
          processQueue(new Error("Token refresh failed"), null);
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
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


