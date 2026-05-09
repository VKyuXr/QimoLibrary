import { Box, Group, Stack, Text, Switch, Button, TextInput, Modal, Checkbox, ActionIcon } from '@mantine/core';
import { useSettings } from '../context/SettingsContext';
import { useBook } from '../context/BookContext';
import { useLibrary } from '../hooks/useLibrary';
import { open } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import { IconFolder, IconTrash, IconPlus } from '@tabler/icons-react';
import { useTranslation } from '../hooks/useTranslation';
import SignatureButton from '../components/decorative/SignatureButton';

const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { libraries, setActiveLibrary, addLibrary, removeLibrary } = useBook();
  const { setLibraryPath, initializeLibrary } = useLibrary();
  const { t } = useTranslation();
  
  // 当前选中的设置项
  const [activeSetting, setActiveSetting] = useState<string>('theme');
  // Modal状态
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [libraryName, setLibraryName] = useState<string>('');

  const handleSelectLibraryPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected) {
        const pathStr = selected.toString();
        setSelectedPath(pathStr);
        console.log('选择的书库路径:', pathStr);
      }
    } catch (error) {
      console.error('选择路径失败:', error);
    }
  };

  const handleConfirmLibraryPath = async () => {
    if (!selectedPath) {
      return;
    }
    
    try {
      console.log('确认书库路径:', selectedPath);
      
      // 初始化书库
      await initializeLibrary(selectedPath);
      
      // 保存路径
      await setLibraryPath(selectedPath);
      
      // 添加为新书库
      const name = libraryName || `书库 ${libraries.length + 1}`;
      await addLibrary(name, selectedPath);
      
      // 关闭modal
      setModalOpened(false);
      setSelectedPath('');
      setLibraryName('');
    } catch (error) {
      console.error('设置书库位置失败:', error);
    }
  };

  return (
    <Box className="flex h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 左侧设置菜单 */}
      <Box className="w-1/4 p-[15px]" style={{ borderColor: 'var(--border-color)', borderWidth: '0 1px 0 0' }}>
        <Stack gap="0">
          <Box 
            className={`px-4 py-3 cursor-pointer`}
            onClick={() => setActiveSetting('theme')}
            onMouseEnter={(e) => {
              if (activeSetting !== 'theme') {
                e.currentTarget.style.fontSize = 'calc(1rem * 1.414)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeSetting !== 'theme') {
                e.currentTarget.style.fontSize = 'inherit';
              }
            }}
            style={{
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: activeSetting === 'theme' ? 'var(--highlight)' : 'transparent',
              fontSize: activeSetting === 'theme' ? 'calc(1rem * 1.414)' : 'inherit',
              transition: 'font-size 0.2s ease'
            }}
          >
            <Text 
              size="lg"
              style={{ 
                color: 'var(--text-primary)',
                fontFamily: '"Source Han Serif SC", serif',
                fontSize: 'inherit'
              }}
            >
              {t('theme')} / Theme
            </Text>
          </Box>
          <Box 
            className={`px-4 py-3 cursor-pointer`}
            onClick={() => setActiveSetting('library')}
            onMouseEnter={(e) => {
              if (activeSetting !== 'library') {
                e.currentTarget.style.fontSize = 'calc(1rem * 1.414)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeSetting !== 'library') {
                e.currentTarget.style.fontSize = 'inherit';
              }
            }}
            style={{
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: activeSetting === 'library' ? 'var(--highlight)' : 'transparent',
              fontSize: activeSetting === 'library' ? 'calc(1rem * 1.414)' : 'inherit',
              transition: 'font-size 0.2s ease'
            }}
          >
            <Text 
              size="lg"
              style={{ 
                color: 'var(--text-primary)',
                fontFamily: '"Source Han Serif SC", serif',
                fontSize: 'inherit'
              }}
            >
              {t('librarySettings')} / Library
            </Text>
          </Box>
        </Stack>
      </Box>

      {/* 右侧具体设置内容 */}
      <Box className="flex-1 p-[15px]">
        <Stack gap="xl">
          {/* 主题切换 */}
          {activeSetting === 'theme' && (
            <Box className="pb-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <Group justify="space-between">
                <Box>
                  <Text fw={500} size="lg" style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>{t('darkMode')}</Text>
                  <Text size="sm" style={{ color: 'var(--text-secondary)' }}>{t('darkModeDesc')}</Text>
                </Box>
                <Switch
                  checked={settings.theme === 'dark'}
                  onChange={(event) =>
                    updateSettings({ theme: event.currentTarget.checked ? 'dark' : 'light' })
                  }
                  size="md"
                  styles={{
                    thumb: { borderRadius: 0 },
                    track: { borderRadius: 0, backgroundColor: 'var(--border-color)' }
                  }}
                />
              </Group>
            </Box>
          )}

          {/* 书库位置设置 */}
          {activeSetting === 'library' && (
            <Box className="pb-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <Box mb="md">
                <Text fw={500} size="lg" style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>{t('libraryLocation')}</Text>
                <Text size="sm" style={{ color: 'var(--text-secondary)' }}>管理多个书库，可以切换不同的书库查看书籍</Text>
              </Box>
              
              {/* 书库列表 */}
              <Stack gap="sm" mb="md">
                {libraries.map((library) => (
                  <Group key={library.id} justify="space-between" style={{
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: library.active ? 'var(--highlight)' : 'transparent'
                  }}>
                    <Group gap="sm">
                      <Checkbox
                        checked={library.active}
                        onChange={() => setActiveLibrary(library.id)}
                        styles={{
                          input: {
                            borderRadius: 0,
                            borderColor: 'var(--border-color)',
                            '&:checked': {
                              backgroundColor: 'var(--accent-secondary)',
                              borderColor: 'var(--accent-secondary)'
                            }
                          }
                        }}
                      />
                      <Box>
                        <Text size="sm" fw={500} style={{ color: 'var(--text-primary)' }}>{library.name}</Text>
                        <Text size="xs" style={{ color: 'var(--text-secondary)', fontFamily: 'Courier Prime' }}>{library.path}</Text>
                      </Box>
                    </Group>
                    {library.id !== 'default' && (
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={() => removeLibrary(library.id)}
                        style={{
                          borderRadius: 0,
                          color: 'var(--accent-secondary)'
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                ))}
              </Stack>
              
              <Button 
                onClick={() => setModalOpened(true)}
                leftSection={<IconPlus size={18} />}
                style={{
                  borderRadius: 0,
                  backgroundColor: 'transparent',
                  borderColor: 'var(--accent-secondary)',
                  borderWidth: '1px',
                  color: 'var(--text-primary)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
                  e.currentTarget.style.color = 'var(--bg-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
              >
                添加书库 / Add Library
              </Button>
            </Box>
          )}
        </Stack>
      </Box>

      {/* 选择路径的Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setSelectedPath('');
          setLibraryName('');
        }}
        title={<Text style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>添加新书库 / Add New Library</Text>}
        centered
        size="md"
        styles={{
          content: { borderRadius: 0, backgroundColor: 'var(--bg-primary)' },
          header: { borderBottom: '1px solid var(--border-color)' }
        }}
      >
        <Stack gap="md">
          <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
            请选择一个文件夹作为新书库，所有导入的书籍将存储在此处。
            <br />
            <span style={{ fontSize: '0.9em' }}>
              Please select a folder as the new library. All imported books will be stored here.
            </span>
          </Text>
          
          <TextInput
            label="书库名称 / Library Name"
            placeholder="例如：科幻小说库 / e.g., Sci-Fi Library"
            value={libraryName}
            onChange={(e) => setLibraryName(e.currentTarget.value)}
            styles={{
              input: { 
                borderRadius: 0, 
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              },
              label: { color: 'var(--text-primary)' }
            }}
          />
          
          <TextInput
            label="书库路径 / Library Path"
            value={selectedPath}
            readOnly
            placeholder="点击按钮选择文件夹 / Click to select folder"
            rightSection={<IconFolder size={18} />}
            styles={{
              input: { 
                borderRadius: 0, 
                borderColor: 'var(--border-color)',
                fontFamily: 'Courier Prime',
                color: 'var(--text-primary)'
              },
              label: { color: 'var(--text-primary)' }
            }}
          />
          
          <Group justify="space-between" mt="md">
            <SignatureButton 
              text="取消 / Cancel"
              onClick={() => setModalOpened(false)}
              color="var(--text-secondary)"
            />
            <SignatureButton 
              text="浏览 / Browse"
              onClick={handleSelectLibraryPath}
              color="var(--accent-secondary)"
            />
          </Group>
          
          {selectedPath && (
            <Group justify="flex-end" mt="md">
              <SignatureButton 
                text="确认 / Confirm"
                onClick={handleConfirmLibraryPath}
                color="var(--accent-secondary)"
              />
            </Group>
          )}
        </Stack>
      </Modal>
    </Box>
  );
};

export default SettingsPage;
