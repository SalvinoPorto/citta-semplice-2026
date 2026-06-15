/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import './editor.css';

interface EditorProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
    withLink?: boolean;
}

const MenuBar = ({ editor, withLink }: { editor: any; withLink?: boolean }) => {
    const [showLinkInput, setShowLinkInput] = React.useState(false);
    const [linkUrl, setLinkUrl] = React.useState('');

    if (!editor) {
        return null;
    }

    const handleLinkClick = () => {
        if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
        } else {
            setLinkUrl('');
            setShowLinkInput(true);
        }
    };

    const handleLinkConfirm = () => {
        if (linkUrl.trim()) {
            const url = linkUrl.trim().startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`;
            editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
        }
        setShowLinkInput(false);
        setLinkUrl('');
    };

    const handleLinkCancel = () => {
        setShowLinkInput(false);
        setLinkUrl('');
    };

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
            {withLink && (
                <>
                    <button
                        type="button"
                        onClick={handleLinkClick}
                        className={editor.isActive('link') ? 'is-active' : ''}
                        title={editor.isActive('link') ? 'Rimuovi link' : 'Inserisci link'}
                    >
                        Link
                    </button>
                    {showLinkInput && (
                        <div className="tiptap-link-input">
                            <input
                                type="text"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                placeholder="https://..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleLinkConfirm(); }
                                    if (e.key === 'Escape') handleLinkCancel();
                                }}
                                autoFocus
                            />
                            <button type="button" onClick={handleLinkConfirm} title="Conferma">✓</button>
                            <button type="button" onClick={handleLinkCancel} title="Annulla">✕</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default function Editor({ value, onChange, onBlur, placeholder, className, withLink }: EditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Underline,
            ...(withLink ? [Link.configure({ openOnClick: false })] : []),
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
            <MenuBar editor={editor} withLink={withLink} />
            <EditorContent editor={editor} />
        </div>
    );
}
