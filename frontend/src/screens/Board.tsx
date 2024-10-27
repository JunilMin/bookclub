import React, { useState } from 'react';

interface PostForm {
  due: string;
  capacity: number;
  level: 'low' | 'moderate' | 'high';
  book: string;
}
import './styles/Board.css'

const Board: React.FC = () => {
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

    const newPost = {
      ...postForm,
      date: new Date().toISOString(),  // 현재 날짜를 생성 날짜로 설정
    };

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost),
      });

      if (response.ok) {
        alert('포스트가 성공적으로 생성되었습니다!');
        setPostForm({ due: '', capacity: 1, level: 'moderate', book: '' });
      } else {
        alert('포스트 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('서버 오류가 발생했습니다.');
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

export default Board
