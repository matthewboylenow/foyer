'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { Bold, Italic, List } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /**
   * 'none'    — no toolbar (just text + line breaks via Enter/Shift+Enter)
   * 'minimal' — bold, italic
   * 'full'    — bold, italic, bullet list (spec config for General body)
   */
  toolbar?: 'none' | 'minimal' | 'full';
  rows?: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  toolbar = 'none',
  rows = 3,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: toolbar === 'full' ? undefined : false,
        orderedList: false,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? '',
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'outline-none prose prose-sm max-w-none focus:outline-none rich-editor',
        style: `min-height: ${rows * 24}px`,
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current && (value || '<p></p>') !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className="border border-input rounded-md px-3 py-2 text-sm text-muted-foreground"
        style={{ minHeight: rows * 24 + 16 }}
      >
        Loading editor…
      </div>
    );
  }

  return (
    <div className="border border-input rounded-md focus-within:ring-2 focus-within:ring-ring/50 bg-background">
      {toolbar !== 'none' && (
        <div className="flex gap-0.5 p-1 border-b border-border">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-muted ${editor.isActive('bold') ? 'bg-muted' : ''}`}
            title="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-muted ${editor.isActive('italic') ? 'bg-muted' : ''}`}
            title="Italic"
          >
            <Italic size={14} />
          </button>
          {toolbar === 'full' && (
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded hover:bg-muted ${editor.isActive('bulletList') ? 'bg-muted' : ''}`}
              title="Bullet list"
            >
              <List size={14} />
            </button>
          )}
        </div>
      )}
      <EditorContent editor={editor} className="px-3 py-2" />
    </div>
  );
}
