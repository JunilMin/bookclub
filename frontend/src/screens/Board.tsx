import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAllPosts, Post, joinBookMeeting, leaveBookMeeting, deletePost } from '../api/posts';
import './styles/Board.css';
import { useAuth } from '../AuthContext/AuthContext';

const REFRESH_INTERVAL = 30000; // 30초마다 자동 새로고침

type TabType = 'all' | 'my';

// 날짜가 지났는지 확인 (해당 날짜의 다음 날부터 지난 것으로 간주)
const isPassed = (dueDate: string): boolean => {
  const due = new Date(dueDate);
  const today = new Date();
  // 오늘 날짜의 시작 (00:00:00)
  today.setHours(0, 0, 0, 0);
  // due 날짜의 다음 날 시작
  const nextDay = new Date(due);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);
  return today >= nextDay;
};

// PostItem 컴포넌트 Props
interface PostItemProps {
  post: Post;
  t: (key: string) => string;
  currentUsername?: string;
  currentUserId?: string;
  onJoin?: (postId: string) => void;
  onLeave?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  isProcessing?: boolean;
}

// PostItem 컴포넌트
const PostItem: React.FC<PostItemProps> = ({
  post,
  t,
  currentUsername,
  currentUserId,
  onJoin,
  onLeave,
  onDelete,
  isProcessing
}) => {
  // 생성자 여부 체크 (username 또는 userId로 비교 - 기존 데이터 호환성)
  const isCreator = currentUsername && post.creater &&
    (currentUsername === post.creater || currentUserId === post.creater);
  // 참가자 여부 체크 (username 또는 userId로 비교 - 기존 데이터 호환성)
  const isParticipant = currentUsername && post.member &&
    (post.member.includes(currentUsername) || (currentUserId && post.member.includes(currentUserId)));
  const canJoin = currentUsername && !isCreator && !isParticipant && (post.member?.length || 0) < post.capacity;
  const canLeave = currentUsername && !isCreator && isParticipant;
  const canSeeMeetLink = isCreator || isParticipant;
  const memberCount = post.member?.length || 0;

  return (
    <li className="post-item">
      <p><strong>{post.book}</strong></p>
      <p>{t('post_created')}: {new Date(post.date).toLocaleString()}</p>
      <p>{t('post_meeting_time')}: {new Date(post.due).toLocaleString()}</p>
      <p>{t('post_capacity')}: {memberCount}/{post.capacity}</p>
      <p>{t('post_level')}: {post.level}</p>
      <p>{t('post_creator_label')}: {post.creater}</p>

      {/* 삭제 버튼 - 생성자만 */}
      {isCreator && onDelete && (
        <button
          className="delete-button"
          onClick={() => onDelete(post.id)}
          disabled={isProcessing}
        >
          {isProcessing ? t('loading') : t('board_delete')}
        </button>
      )}

      {/* 참가 버튼 - 생성자가 아니고 참가하지 않은 경우 */}
      {canJoin && onJoin && (
        <button
          className="join-button"
          onClick={() => onJoin(post.id)}
          disabled={isProcessing}
        >
          {isProcessing ? t('loading') : t('board_join')}
        </button>
      )}

      {/* 참가 취소 버튼 - 생성자가 아니고 참가한 경우 */}
      {canLeave && onLeave && (
        <button
          className="leave-button"
          onClick={() => onLeave(post.id)}
          disabled={isProcessing}
        >
          {isProcessing ? t('loading') : t('board_leave')}
        </button>
      )}

      {/* Meet 링크 - 생성자 또는 참가자만 볼 수 있음 */}
      {canSeeMeetLink && post.meetLink ? (
        <a
          href={post.meetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="meet-link-button"
        >
          {t('board_join_meet')}
        </a>
      ) : post.meetError && isCreator ? (
        <p className="meet-error">{t('board_meet_error')}: {post.meetError}</p>
      ) : null}

      {/* 참가 상태 표시 */}
      {isCreator && <span className="status-badge creator-badge">{t('board_creator')}</span>}
      {isParticipant && !isCreator && <span className="status-badge participant-badge">{t('board_participant')}</span>}
    </li>
  );
};

const Board: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const { accessToken, user } = useAuth();

  const fetchPosts = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    try {
      const data = await getAllPosts(accessToken);
      setPosts(data);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  // 초기 로드 및 토큰 변경 시 새로고침
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // 주기적 자동 새로고침 (30초)
  useEffect(() => {
    if (!accessToken) return;

    const intervalId = setInterval(() => {
      fetchPosts();
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [accessToken, fetchPosts]);

  // 포스트 생성 페이지로 이동
  const handleCreatePost = useCallback(() => {
    navigate('/board/create');
  }, [navigate]);

  // 북미팅 참가
  const handleJoin = useCallback(async (postId: string) => {
    if (!accessToken || !user?.username) return;

    setIsProcessing(true);
    try {
      await joinBookMeeting(postId, user.username, accessToken);
      await fetchPosts(); // 새로고침
    } catch (error) {
      console.error('Error joining book meeting:', error);
      alert(t('board_join_error'));
    } finally {
      setIsProcessing(false);
    }
  }, [accessToken, user?.username, fetchPosts, t]);

  // 북미팅 참가 취소
  const handleLeave = useCallback(async (postId: string) => {
    if (!accessToken || !user?.username) return;

    setIsProcessing(true);
    try {
      await leaveBookMeeting(postId, user.username, accessToken);
      await fetchPosts(); // 새로고침
    } catch (error) {
      console.error('Error leaving book meeting:', error);
      alert(t('board_leave_error'));
    } finally {
      setIsProcessing(false);
    }
  }, [accessToken, user?.username, fetchPosts, t]);

  // 북미팅 삭제
  const handleDelete = useCallback(async (postId: string) => {
    if (!accessToken) return;

    if (!window.confirm(t('board_delete_confirm'))) {
      return;
    }

    setIsProcessing(true);
    try {
      await deletePost(postId, accessToken);
      await fetchPosts(); // 새로고침
    } catch (error) {
      console.error('Error deleting book meeting:', error);
      alert(t('board_delete_error'));
    } finally {
      setIsProcessing(false);
    }
  }, [accessToken, fetchPosts, t]);

  // 전체 게시판용: 지나지 않은 포스트만 필터링
  const activePosts = useMemo(() => {
    return posts
      .filter((post) => !isPassed(post.due))
      .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  }, [posts]);

  // 내가 생성하거나 참여한 포스트 필터링 및 분류
  const { myPosts, upcomingPost, currentPosts, passedPosts } = useMemo(() => {
    const username = user?.username;
    const userId = user?.id;
    if (!username) {
      return { myPosts: [], upcomingPost: null, currentPosts: [], passedPosts: [] };
    }

    // 내가 생성했거나 참여한 포스트 (기존 데이터 호환성: username 또는 userId로 비교)
    const myPosts = posts.filter(
      (post) => post.creater === username || post.creater === userId ||
        (post.member && post.member.includes(username))
    );

    // 지나지 않은 포스트와 지난 포스트 분류
    const notPassedPosts = myPosts
      .filter((post) => !isPassed(post.due))
      .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

    const passedPosts = myPosts
      .filter((post) => isPassed(post.due))
      .sort((a, b) => new Date(b.due).getTime() - new Date(a.due).getTime()); // 최신순

    // 가장 가까운 upcoming 하나
    const upcomingPost = notPassedPosts.length > 0 ? notPassedPosts[0] : null;
    // 나머지 current
    const currentPosts = notPassedPosts.slice(1);

    return { myPosts, upcomingPost, currentPosts, passedPosts };
  }, [posts, user]);

  return (
    <div className="board">
      <h2>{t('board_title')} {isLoading && <span className="loading-indicator">...</span>}</h2>

      {/* 탭 메뉴 */}
      <div className="tab-container">
        <button
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          {t('board_all_posts')}
        </button>
        <button
          className={`tab-button ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          {t('board_my_posts')}
        </button>
      </div>

      {/* 포스트 생성 버튼 */}
      {user && (
        <button className="create-post-button" onClick={handleCreatePost}>
          + {t('board_create_post')}
        </button>
      )}

      {/* All Posts 탭 - 지나지 않은 미팅만 표시 */}
      {activeTab === 'all' && (
        <>
          {activePosts.length > 0 ? (
            <ul className="post-board">
              {activePosts.map((post) => (
                <PostItem
                  key={post.id}
                  post={post}
                  t={t}
                  currentUsername={user?.username}
                  currentUserId={user?.id}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onDelete={handleDelete}
                  isProcessing={isProcessing}
                />
              ))}
            </ul>
          ) : (
            <p className="no-posts">{t('board_no_posts')}</p>
          )}
        </>
      )}

      {/* My Posts 탭 */}
      {activeTab === 'my' && (
        <div className="my-posts-container">
          {myPosts.length === 0 ? (
            <p className="no-posts">{t('board_no_my_posts')}</p>
          ) : (
            <>
              {/* Upcoming Book Meeting */}
              {upcomingPost && (
                <section className="post-section upcoming-section">
                  <h3>📅 {t('board_upcoming')}</h3>
                  <ul className="post-board">
                    <PostItem
                      post={upcomingPost}
                      t={t}
                      currentUsername={user?.username}
                      currentUserId={user?.id}
                      onJoin={handleJoin}
                      onLeave={handleLeave}
                      onDelete={handleDelete}
                      isProcessing={isProcessing}
                    />
                  </ul>
                </section>
              )}

              {/* Current Book Meetings */}
              {currentPosts.length > 0 && (
                <section className="post-section current-section">
                  <h3>📚 {t('board_current')}</h3>
                  <ul className="post-board">
                    {currentPosts.map((post) => (
                      <PostItem
                        key={post.id}
                        post={post}
                        t={t}
                        currentUsername={user?.username}
                        currentUserId={user?.id}
                        onJoin={handleJoin}
                        onLeave={handleLeave}
                        onDelete={handleDelete}
                        isProcessing={isProcessing}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {/* Passed Book Meetings */}
              {passedPosts.length > 0 && (
                <section className="post-section passed-section">
                  <h3>✅ {t('board_passed')}</h3>
                  <ul className="post-board">
                    {passedPosts.map((post) => (
                      <PostItem
                        key={post.id}
                        post={post}
                        t={t}
                        currentUsername={user?.username}
                        currentUserId={user?.id}
                        onJoin={handleJoin}
                        onLeave={handleLeave}
                        onDelete={handleDelete}
                        isProcessing={isProcessing}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Board;
