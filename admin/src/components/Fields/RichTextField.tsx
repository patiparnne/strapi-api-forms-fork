//@ts-nocheck
import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';

import { Box, Button, Flex } from '@strapi/design-system';
import { Bold as BoldIcon, Italic as ItalicIcon } from '@strapi/icons';
import styled from 'styled-components';
import { Block } from '../../context/FormContext';

interface RichTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  availableFields: Block[];
}

// Styled Component for TipTap Editor Styles
const StyledEditor = styled.div`
  .tiptap {
    min-height: 200px;
    p {
      font-size: 1.5rem;
    }
    :first-child {
      margin-top: 0;
    }

    table {
      border-spacing: 10px;
      border-collapse: separate;
      td,
      th {
        padding: 10px;
      }
    }

    /* Heading styles */
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      font-weight: bold;
      line-height: 1.1;
      margin-top: 2.5rem;
      text-wrap: pretty;
    }

    h1 {
      font-size: 2rem;
    }
    h2 {
      font-size: 1.8rem;
    }
    h3 {
      font-size: 1.6rem;
    }
    h4,
    h5,
    h6 {
      font-size: 1.5rem;
    }
  }
`;

const RichTextField: React.FC<RichTextFieldProps> = ({ value, onChange, availableFields }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start typing...' }),
    ],
    content: value.replaceAll(',', ''),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return <p>Loading editor...</p>;
  }

  // Insert field placeholders
  const insertPlaceholder = (field: string) => {
    editor.commands.insertContent(`{{${field}}}`);
  };

  return (
    <Box padding={4} background="neutral100" borderRadius="4px">
      {/* Toolbar */}
      <Flex gap={2} paddingBottom={3} wrap="wrap">
        <Button
          variant="tertiary"
          onClick={() => editor.commands.toggleBold()}
          startIcon={<BoldIcon />}
        >
          Bold
        </Button>
        <Button
          variant="tertiary"
          onClick={() => editor.commands.toggleItalic()}
          startIcon={<ItalicIcon />}
        >
          Italic
        </Button>
        <Button
          variant="tertiary"
          onClick={() => editor.commands.toggleHeading({ level: 1 })}
        >
          H1
        </Button>
        <Button
          variant="tertiary"
          onClick={() => editor.commands.toggleHeading({ level: 2 })}
        >
          H2
        </Button>
        <Button
          variant="tertiary"
          onClick={() => editor.commands.toggleHeading({ level: 3 })}
        >
          H3
        </Button>
      </Flex>

      {/* Insert Field Labels */}
      <Flex gap={2} paddingBottom={3} wrap="wrap">
        {availableFields.map((field: Block) => {
          if (!field.field || field.field.type === 'file') {
            return <></>;
          }

          return (
            <Button
              key={field.i}
              variant="secondary"
              onClick={() => field.field && insertPlaceholder(field.field?.name)}
            >
              {field.field?.label}
            </Button>
          );
        })}
      </Flex>

      {/* Rich Text Editor */}
      <StyledEditor>
        <Box
          background="neutral0"
          border="1px solid #EAEAEA"
          borderRadius="4px"
          padding={3}
          minHeight="200px"
        >
          <EditorContent editor={editor} />
        </Box>
      </StyledEditor>
    </Box>
  );
};

export default RichTextField;
