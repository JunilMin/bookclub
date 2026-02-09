package com.bookclub.backend.firebase;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Set;

@Component
public class FirebaseAuthFilter extends OncePerRequestFilter {

    // 인증 없이 접근 가능한 경로 prefix (뒤에 / 또는 끝이어야 매칭)
    private static final Set<String> PUBLIC_PATH_PREFIXES = Set.of(
        "/api/auth/",
        "/api/ISBN/",
        "/api/books/",
        "/swagger-ui/",
        "/v3/api-docs/",
        "/ws/"
    );

    // 정확히 일치해야 하는 공개 경로들
    private static final Set<String> PUBLIC_EXACT_PATHS = Set.of(
        "/api/users/register",
        "/api/users/count",
        "/api/reviews/average-rating",
        "/api/auth",
        "/api/ISBN",
        "/api/books",
        "/swagger-ui",
        "/v3/api-docs",
        "/ws"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String requestPath = request.getRequestURI();
        String method = request.getMethod();

        // OPTIONS (CORS preflight) 요청은 인증 없이 통과
        if ("OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        // 공개 경로는 인증 없이 통과
        if (isPublicPath(requestPath, method)) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = null;

        // 1. Authorization 헤더에서 토큰 추출
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }

        // 2. 쿠키에서 토큰 추출 (Authorization 헤더가 없는 경우)
        if (token == null) {
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("firebase_token".equals(cookie.getName())) {
                        token = cookie.getValue();
                        break;
                    }
                }
            }
        }

        // 3. 토큰이 없으면 401 반환
        if (token == null) {
            sendUnauthorizedResponse(response, "No authentication token provided");
            return;
        }

        // 4. 토큰 검증
        try {
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decodedToken.getUid();

            UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(uid, null, new ArrayList<>());
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

            SecurityContextHolder.getContext().setAuthentication(authentication);

            // 인증 성공 - 다음 필터로 진행
            filterChain.doFilter(request, response);

        } catch (FirebaseAuthException e) {
            logger.error("Firebase 토큰 검증 실패: " + e.getMessage());

            // 토큰 만료 여부 확인
            String errorCode = e.getErrorCode() != null ? e.getErrorCode().name() : "";
            if (errorCode.contains("EXPIRED") || e.getMessage().contains("expired")) {
                sendUnauthorizedResponse(response, "Token expired");
            } else {
                sendUnauthorizedResponse(response, "Invalid authentication token");
            }
        }
    }

    /**
     * 공개 경로인지 확인
     */
    private boolean isPublicPath(String requestPath, String method) {
        // GET /api/users/validate-username/** 허용
        if ("GET".equalsIgnoreCase(method) && requestPath.startsWith("/api/users/validate-username")) {
            return true;
        }

        // GET /api/posts 또는 GET /api/posts/** 허용 (목록, 상세 조회)
        if ("GET".equalsIgnoreCase(method) &&
            (requestPath.equals("/api/posts") || requestPath.startsWith("/api/posts/"))) {
            return true;
        }

        // 정확히 일치하는 경로 체크
        if (PUBLIC_EXACT_PATHS.contains(requestPath)) {
            return true;
        }

        // prefix로 시작하는 경로 체크 (더 정확한 매칭)
        for (String publicPrefix : PUBLIC_PATH_PREFIXES) {
            if (requestPath.startsWith(publicPrefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 401 Unauthorized 응답 전송
     */
    private void sendUnauthorizedResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(String.format(
            "{\"error\": \"Unauthorized\", \"message\": \"%s\", \"code\": 401}",
            message
        ));
    }
}
