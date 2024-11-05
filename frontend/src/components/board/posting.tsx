// Posting.tsx
import React, { useState } from 'react';
import { createPost, Post, ObjectId } from '../../api/posts';
import '../styles/Posting.css';

interface PostForm {
  due: string;
  capacity: number;
  level: 'low' | 'moderate' | 'high';
  book: string;
}

const Posting: React.FC = () => {
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

    // 서버에서 요구하는 데이터 구조에 맞게 newPost 객체 생성
    const newPost: Partial<Post> = {
      creater: 'user123', // 실제 사용자 ID가 ObjectId가 아닌 문자열로 전송됨
      date: new Date().toISOString().slice(0, -5), // ISO 형식으로 변환
      due: new Date(postForm.due).toISOString().slice(0, -5), // ISO 형식으로 변환
      capacity: postForm.capacity,
      member: [], // 빈 멤버 리스트로 초기화
      level: postForm.level,
      book: postForm.book,
    };
    console.log(newPost);
    try {
      const createdPost = await createPost(newPost);
      alert('포스트가 성공적으로 생성되었습니다!');
      setPostForm({ due: '', capacity: 1, level: 'moderate', book: '' });
    } catch (error) {
      console.error('Error:', error);
      alert('포스트 생성에 실패했습니다.');
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
        />
      </label>
      <label>
        지식 레벨 (level):
        <select name="level" value={postForm.level} onChange={handleInputChange} required>
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
        />
      </label>
      <button type="submit">포스트 생성</button>
    </form>
  );
};

export default Posting;
