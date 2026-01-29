import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiSend, FiTag } from 'react-icons/fi';
import { createSuggestion } from '../../api/suggestions';
import { Suggestion } from '../../types/suggestion';
import './CreateSuggestionModal.css';

interface CreateSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (suggestion: Suggestion) => void;
}

const CreateSuggestionModal: React.FC<CreateSuggestionModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 5) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError(t('revolution_error_title_required') || '제목을 입력해주세요.');
      return;
    }

    if (!content.trim()) {
      setError(t('revolution_error_content_required') || '내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const suggestion = await createSuggestion({
        title: title.trim(),
        content: content.trim(),
        tags,
      });
      onCreated(suggestion);
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || t('revolution_error_create_failed') || '건의사항 작성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setContent('');
    setTags([]);
    setTagInput('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="create-suggestion-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('revolution_create_title') || '새 건의사항 작성'}</h2>
          <button className="modal-close-btn" onClick={handleClose}>
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="title">{t('revolution_form_title') || '제목'}</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('revolution_form_title_placeholder') || '건의사항 제목을 입력하세요'}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">{t('revolution_form_content') || '내용'}</label>
            <textarea
              id="content"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={t('revolution_form_content_placeholder') || '건의사항 내용을 상세히 작성해주세요'}
              rows={6}
              maxLength={2000}
            />
            <span className="char-count">{content.length}/2000</span>
          </div>

          <div className="form-group">
            <label>{t('revolution_form_tags') || '태그'} <span className="optional">({t('revolution_form_optional') || '선택'})</span></label>
            <div className="tag-input-wrapper">
              <FiTag className="tag-icon" />
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('revolution_form_tag_placeholder') || '태그 입력 후 Enter'}
                maxLength={20}
              />
              <button type="button" className="add-tag-btn" onClick={handleAddTag}>
                {t('revolution_form_add') || '추가'}
              </button>
            </div>
            {tags.length > 0 && (
              <div className="tags-list">
                {tags.map(tag => (
                  <span key={tag} className="tag-item">
                    #{tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)}>
                      <FiX size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={handleClose}>
              {t('revolution_form_cancel') || '취소'}
            </button>
            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="loading-spinner"></span>
              ) : (
                <>
                  <FiSend size={18} />
                  {t('revolution_form_submit') || '건의하기'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSuggestionModal;
