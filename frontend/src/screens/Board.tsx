// src/components/Board.tsx
import React, { useEffect, useState } from 'react';
import { getAllPosts, Post } from '../api/posts';
import './styles/Board.css';
import Posting from '../components/board/posting.tsx';
const Board: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);

  const fetchPosts = async () => {
    try {
      const data = await getAllPosts();
      setPosts(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };
  
  useEffect(() => {
    fetchPosts();
    
  }, []);

  return (
    <div className="board">
      <h2>게시판</h2>
      <button onClick={fetchPosts}>새로고침</button>
      <Posting />
      {posts.length > 0 ? (
        <ul className="post-board">
          {posts.map((post) => (
            <li key={post.id} className="post-item">
              <p>{new Date(post.date).toLocaleString()}</p>
              <p>{new Date(post.due).toLocaleString()}</p>
              <p>{post.capacity}</p>
              <p>{post.level}</p>
              <p>{post.book}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>게시물이 없습니다.</p>
      )}
    </div>
  );
};

export default Board;
