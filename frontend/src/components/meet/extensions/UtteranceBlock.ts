/**
 * UtteranceBlock TipTap Extension
 *
 * 발언 전사를 스타일링된 카드 형태로 표시하는 커스텀 노드
 */

import { Node, mergeAttributes } from '@tiptap/core';

export interface UtteranceBlockAttributes {
  speakerName: string;
  speakerPhotoUrl: string;
  timestamp: string;
  utteranceIndex: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    utteranceBlock: {
      /**
       * Insert an utterance block
       */
      insertUtteranceBlock: (attrs: UtteranceBlockAttributes, content: string) => ReturnType;
    };
  }
}

export const UtteranceBlock = Node.create({
  name: 'utteranceBlock',

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      speakerName: {
        default: 'Unknown',
        parseHTML: element => element.getAttribute('data-speaker-name'),
        renderHTML: attributes => ({
          'data-speaker-name': attributes.speakerName,
        }),
      },
      speakerPhotoUrl: {
        default: '',
        parseHTML: element => element.getAttribute('data-speaker-photo'),
        renderHTML: attributes => ({
          'data-speaker-photo': attributes.speakerPhotoUrl,
        }),
      },
      timestamp: {
        default: '',
        parseHTML: element => element.getAttribute('data-timestamp'),
        renderHTML: attributes => ({
          'data-timestamp': attributes.timestamp,
        }),
      },
      utteranceIndex: {
        default: 0,
        parseHTML: element => parseInt(element.getAttribute('data-utterance-index') || '0', 10),
        renderHTML: attributes => ({
          'data-utterance-index': attributes.utteranceIndex,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="utterance-block"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { speakerName, speakerPhotoUrl, timestamp, utteranceIndex } = node.attrs;

    // Create the wrapper div
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'utterance-block',
        class: 'utterance-block',
      }),
      [
        'div',
        { class: 'utterance-block-header' },
        // Avatar
        speakerPhotoUrl
          ? [
              'img',
              {
                src: speakerPhotoUrl,
                alt: speakerName,
                class: 'utterance-block-avatar',
              },
            ]
          : [
              'div',
              { class: 'utterance-block-avatar-placeholder' },
              speakerName.charAt(0).toUpperCase(),
            ],
        // Speaker info
        [
          'div',
          { class: 'utterance-block-info' },
          [
            'div',
            { class: 'utterance-block-meta' },
            ['span', { class: 'utterance-block-name' }, speakerName],
            ['span', { class: 'utterance-block-index' }, `#${utteranceIndex}`],
            timestamp ? ['span', { class: 'utterance-block-time' }, timestamp] : '',
          ],
        ],
      ],
      // Content wrapper
      ['div', { class: 'utterance-block-content' }, 0],
    ];
  },

  addCommands() {
    return {
      insertUtteranceBlock:
        (attrs: UtteranceBlockAttributes, content: string) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
              content: [
                {
                  type: 'paragraph',
                  content: content ? [{ type: 'text', text: content }] : [],
                },
              ],
            })
            .run();
        },
    };
  },
});

export default UtteranceBlock;
