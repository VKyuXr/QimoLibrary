import { useState, useCallback, useRef, useEffect } from 'react';
import { TextInput, Paper, Group, Text, ActionIcon, ScrollArea } from '@mantine/core';
import { IconSearch, IconX, IconBook } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { Book } from '../services/database';

interface SearchBarProps {
  libraryPath?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ libraryPath }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { searchBooks } = useDatabase();
  const navigate = useNavigate();

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    try {
      const searchResults = await searchBooks(searchQuery, libraryPath);
      setResults(searchResults);
      setIsOpen(true);
    } catch (error) {
      console.error('搜索失败:', error);
    }
  }, [searchBooks, libraryPath]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, handleSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (book: Book) => {
    setIsOpen(false);
    setQuery('');
    navigate('/reader', {
      state: {
        filePath: book.file_path,
        bookId: book.id,
        bookMetadata: book
      }
    });
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
      <TextInput
        placeholder="搜索书籍..."
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        leftSection={<IconSearch size={18} />}
        rightSection={
          query ? (
            <ActionIcon onClick={handleClear} variant="subtle">
              <IconX size={18} />
            </ActionIcon>
          ) : null
        }
        styles={{
          input: {
            fontFamily: '"Source Han Sans SC", sans-serif',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            '&:focus': {
              borderColor: 'var(--accent-color)',
            }
          }
        }}
      />
      
      {isOpen && results.length > 0 && (
        <Paper
          shadow="md"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            marginTop: 4,
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
          }}
        >
          <ScrollArea style={{ maxHeight: 300 }}>
            {results.map((book) => (
              <Group
                key={book.id}
                p="sm"
                style={{
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-color)',
                  '&:hover': {
                    backgroundColor: 'var(--bg-secondary)',
                  }
                }}
                onClick={() => handleResultClick(book)}
              >
                <IconBook size={24} style={{ color: 'var(--accent-color)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    size="sm"
                    fw={500}
                    lineClamp={1}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {book.title}
                  </Text>
                  <Text
                    size="xs"
                    c="dimmed"
                    lineClamp={1}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {book.author}
                  </Text>
                </div>
              </Group>
            ))}
          </ScrollArea>
        </Paper>
      )}
    </div>
  );
};

export default SearchBar;
