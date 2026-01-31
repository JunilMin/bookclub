/**
 * BlockContent - Read-only block content renderer
 *
 * Renders TipTap JSON content as static HTML
 * Used when block is not being edited
 */

import React, { useMemo } from 'react';
import { Block, parseBlockContent, TipTapContent } from '../../../types/blockDocument';

interface BlockContentProps {
  block: Block;
  onClick?: () => void;
}

/**
 * Render TipTap content to React elements
 */
function renderContent(content: TipTapContent): React.ReactNode {
  const { type, attrs, content: children, text, marks } = content;

  // Text node - handle all text types including empty strings
  if (type === 'text') {
    // Return null for truly empty text nodes
    if (text === undefined || text === null) {
      return null;
    }

    let element: React.ReactNode = text;

    // Apply marks (bold, italic, etc.)
    if (marks) {
      marks.forEach((mark, markIndex) => {
        switch (mark.type) {
          case 'bold':
            element = <strong key={`bold-${markIndex}`}>{element}</strong>;
            break;
          case 'italic':
            element = <em key={`italic-${markIndex}`}>{element}</em>;
            break;
          case 'strike':
            element = <s key={`strike-${markIndex}`}>{element}</s>;
            break;
          case 'code':
            element = <code key={`code-${markIndex}`}>{element}</code>;
            break;
          case 'link':
            element = (
              <a href={mark.attrs?.href as string} target="_blank" rel="noopener noreferrer" key={`link-${markIndex}`}>
                {element}
              </a>
            );
            break;
        }
      });
    }

    return element;
  }

  // Render children
  const renderedChildren = children?.map((child, index) => (
    <React.Fragment key={index}>{renderContent(child)}</React.Fragment>
  ));

  // Element nodes
  switch (type) {
    case 'doc':
      return <>{renderedChildren}</>;

    case 'paragraph':
      return <p>{renderedChildren || <br />}</p>;

    case 'heading':
      const level = (attrs?.level as number) || 1;
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      return <HeadingTag>{renderedChildren}</HeadingTag>;

    case 'bulletList':
      return <ul>{renderedChildren}</ul>;

    case 'orderedList':
      return <ol start={attrs?.start as number}>{renderedChildren}</ol>;

    case 'listItem':
      return <li>{renderedChildren}</li>;

    case 'taskList':
      return <ul className="task-list">{renderedChildren}</ul>;

    case 'taskItem':
      return (
        <li className={`task-item ${attrs?.checked ? 'checked' : ''}`}>
          <input type="checkbox" checked={!!attrs?.checked} readOnly />
          {renderedChildren}
        </li>
      );

    case 'blockquote':
      return <blockquote>{renderedChildren}</blockquote>;

    case 'codeBlock':
      return (
        <pre>
          <code className={attrs?.language ? `language-${attrs.language}` : ''}>
            {renderedChildren}
          </code>
        </pre>
      );

    case 'horizontalRule':
      return <hr />;

    case 'hardBreak':
      return <br />;

    case 'utteranceBlock':
      return (
        <div className="utterance-block" data-speaker={attrs?.speaker as string}>
          <span className="utterance-speaker">{attrs?.speaker as string}:</span>
          <span className="utterance-text">{renderedChildren}</span>
        </div>
      );

    default:
      // Use span for unknown inline types to avoid DOM nesting issues (<div> in <p>)
      if (type) {
        console.warn('[BlockContent] Unknown node type:', type);
      }
      return <span>{renderedChildren}</span>;
  }
}

const BlockContent: React.FC<BlockContentProps> = ({ block, onClick }) => {
  const renderedContent = useMemo(() => {
    const parsed = parseBlockContent(block.content);
    if (!parsed) {
      return <p className="block-empty">Empty block</p>;
    }
    return renderContent(parsed);
  }, [block.content]);

  /**
   * Handle click - only trigger edit if no text is selected
   * This allows users to select text across blocks without entering edit mode
   */
  const handleClick = (e: React.MouseEvent) => {
    // Check if there's a text selection
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().trim().length > 0;

    // If user has selected text, don't enter edit mode
    if (hasSelection) {
      return;
    }

    onClick?.();
  };

  /**
   * Handle double-click - always trigger edit mode
   */
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Clear any selection first
    window.getSelection()?.removeAllRanges();
    onClick?.();
  };

  return (
    <div
      className="block-content-static"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {renderedContent}
    </div>
  );
};

export default BlockContent;
