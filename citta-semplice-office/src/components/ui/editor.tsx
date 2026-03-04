/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import './editor.css';

interface EditorProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) {
        return null;
    }

    return (
        <div className="tiptap-toolbar">
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'is-active' : ''}
                title="Grassetto"
            >
                <strong>G</strong>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'is-active' : ''}
                title="Corsivo"
            >
                <em>C</em>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={editor.isActive('underline') ? 'is-active' : ''}
                title="Sottolineato"
            >
                <u>S</u>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={editor.isActive('strike') ? 'is-active' : ''}
                title="Barrato"
            >
                <s>B</s>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? 'is-active' : ''}
                title="Elenco puntato"
            >
                •
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive('orderedList') ? 'is-active' : ''}
                title="Elenco numerato"
            >
                1.
            </button>
        </div>
    );
};

export default function Editor({ value, onChange, onBlur, placeholder, className }: EditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Underline,
        ],
        content: value,
        onUpdate: ({ editor: e }: { editor: any }) => {
            const html = e.getHTML();
            onChange(html);
        },
        onBlur: () => {
            if (onBlur) {
                onBlur();
            }
        },
        editorProps: {
            attributes: {
                class: 'tiptap-content',
                'data-placeholder': placeholder || 'Scrivi qui...',
            },
        },
    });

    // Sincronizza il valore esterno con l'editor
    React.useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value);
        }
    }, [value, editor]);

    return (
        <div className={`tiptap-editor ${className || ''}`}>
            <MenuBar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
}
