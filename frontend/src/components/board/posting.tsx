import React, { useState } from 'react';
import { createPost, Post } from '../../api/posts';
import '../styles/Posting.css';
import { useAuth } from '../../AuthContext/AuthContext';

interface PostForm {
  due: string;
  capacity: number;
  level: 'low' | 'moderate' | 'high';
  book: string;
}

interface PostingProps {
  onPostCreated?: () => void;
}

const Posting: React.FC<PostingProps> = ({ onPostCreated }) => {
  const { user, accessToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postForm, setPostForm] = useState<PostForm>({
    due: '',
    capacity: 1,
    level: 'moderate',
    book: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPostForm({
      ...postForm,
      [name]: name === 'capacity' ? parseInt(value) : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accessToken || !user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsSubmitting(true);

    const newPost: Partial<Post> = {
      creater: user.username,
      date: new Date().toISOString().slice(0, -5),
      due: new Date(postForm.due).toISOString().slice(0, -5),
      capacity: postForm.capacity,
      member: [user.id!], // 생성자의 ObjectId를 기본 멤버로 추가
      level: postForm.level,
      book: postForm.book,
    };

    try {
      console.log('Creating post (googleAccessToken은 httpOnly 쿠키로 자동 전송)');

      const createdPost = await createPost(newPost, accessToken);

      if (createdPost.meetLink) {
        alert('포스트와 Google Meet 링크가 성공적으로 생성되었습니다!');
      } else if (createdPost.meetError) {
        alert(`포스트는 생성되었으나 Meet 링크 생성 실패: ${createdPost.meetError}`);
      } else {
        alert('포스트가 생성되었습니다. (Google 로그인이 필요하여 Meet 링크가 생성되지 않았습니다)');
      }

      setPostForm({ due: '', capacity: 1, level: 'moderate', book: '' });

      // 포스트 생성 후 부모 컴포넌트에 알림 (동기적 새로고침)
      if (onPostCreated) {
        onPostCreated();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('포스트 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        약속 시간 (due):
        <input
          type="datetime-local"
          name="due"
          value={postForm.due}
          onChange={handleInputChange}
          required
          disabled={isSubmitting}
        />
      </label>
      <label>
        인원 수 (capacity):
        <input
          type="number"
          name="capacity"
          value={postForm.capacity}
          min={1}
          max={10}
          onChange={handleInputChange}
          required
          disabled={isSubmitting}
        />
      </label>
      <label>
        지식 레벨 (level):
        <select name="level" value={postForm.level} onChange={handleInputChange} required disabled={isSubmitting}>
          <option value="low">초보</option>
          <option value="moderate">중간</option>
          <option value="high">고급</option>
        </select>
      </label>
      <label>
        책 이름 (book):
        <input
          type="text"
          name="book"
          value={postForm.book}
          onChange={handleInputChange}
          required
          disabled={isSubmitting}
        />
      </label>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '생성 중...' : '포스트 생성'}
      </button>
    </form>
  );
};

export default Posting;
