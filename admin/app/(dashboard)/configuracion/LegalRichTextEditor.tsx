'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

// Editor visual (WYSIWYG) para el contenido de Términos/Privacidad -- antes
// el admin tenía que escribir HTML a mano en un textarea. Tiptap guarda y
// devuelve HTML plano (editor.getHTML()), que es exactamente lo que
// legal_documents.content espera y lo que web/api/legal.js renderiza tal
// cual -- no hace falta ningún cambio en el lado público.
export function LegalRichTextEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'legal-editor-content prose prose-sm max-w-none focus:outline-none min-h-[300px] p-3',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-gray-300">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-semibold ${
        active ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-300 bg-gray-50 p-1.5">
      <ToolbarButton label="Negrita" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        B
      </ToolbarButton>
      <ToolbarButton label="Cursiva" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        I
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-gray-300" />
      <ToolbarButton
        label="Título"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton label="Párrafo" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
        P
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-gray-300" />
      <ToolbarButton
        label="Lista con viñetas"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • Lista
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. Lista
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-gray-300" />
      <ToolbarButton
        label="Insertar tabla"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()}
      >
        Tabla
      </ToolbarButton>
      <ToolbarButton
        label="Agregar fila"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        + Fila
      </ToolbarButton>
      <ToolbarButton
        label="Agregar columna"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        + Columna
      </ToolbarButton>
      <ToolbarButton
        label="Eliminar tabla"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        ✕ Tabla
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-gray-300" />
      <ToolbarButton label="Deshacer" onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </ToolbarButton>
      <ToolbarButton label="Rehacer" onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </ToolbarButton>
    </div>
  );
}
