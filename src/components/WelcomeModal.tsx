import { Box, Stack, Text, Button, Group, Modal, TextInput } from '@mantine/core';
import { IconBook, IconFolder, IconAlertTriangle, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import SignatureButton from '../components/decorative/SignatureButton';
import { useBook } from '../context/BookContext';

interface WelcomeModalProps {
  onComplete: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onComplete }) => {
  const { addLibrary } = useBook();
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [libraryName, setLibraryName] = useState<string>('');
  const [step, setStep] = useState<1 | 2>(1);
  const [warningModalOpened, setWarningModalOpened] = useState(false);
  const [pendingPath, setPendingPath] = useState<string>('');

  const handleSelectPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected) {
        const pathStr = selected.toString();
        
        // 检查文件夹状态
        const status = await invoke<any>('check_library_folder_status', { libraryPath: pathStr });
        
        if (status.is_empty) {
          // 空文件夹，直接使用
          setSelectedPath(pathStr);
        } else if (status.is_qimo_library) {
          // 是奇墨书库，直接读取
          setSelectedPath(pathStr);
        } else {
          // 非空且不是奇墨书库，显示警告
          setPendingPath(pathStr);
          setWarningModalOpened(true);
        }
      }
    } catch (error) {
      console.error('选择路径失败:', error);
      alert('选择路径失败: ' + error);
    }
  };

  const handleComplete = async () => {
    if (!selectedPath) return;

    try {
      console.log('完成向导，初始化书库:', selectedPath);
      
      // 初始化书库
      await invoke('initialize_library', { path: selectedPath });
      console.log('书库已初始化');
      
      // 保存路径
      await invoke('set_library_path', { path: selectedPath });
      console.log('路径已保存');
      
      // 添加为默认书库，并自动激活加载书籍
      // 如果用户没有输入名称，使用文件夹名作为书库名
      const folderName = selectedPath.split(/[\\/]/).pop() || '默认书库';
      const name = libraryName.trim() || folderName;
      await addLibrary(name, selectedPath, true);
      console.log('书库已添加并激活，书籍已加载');
      
      // 完成向导
      onComplete();
    } catch (error) {
      console.error('设置书库失败:', error);
      alert('设置失败: ' + error);
    }
  };

  const handleClearAndUse = async () => {
    if (!pendingPath) return;
    
    try {
      console.log('清空文件夹:', pendingPath);
      
      // 调用后端清空文件夹
      await invoke('clear_folder', { libraryPath: pendingPath });
      console.log('文件夹已清空');
      
      // 关闭警告对话框
      setWarningModalOpened(false);
      setSelectedPath(pendingPath);
      setPendingPath('');
      
    } catch (error) {
      console.error('清空文件夹失败:', error);
      alert(`清空文件夹失败: ${error}`);
    }
  };

  return (
    <Box
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <Box
        className="w-[600px]"
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 0
        }}
      >
        {/* 标题区 */}
        <Box style={{
          padding: '24px',
          borderBottom: '1px solid var(--border-color)',
          textAlign: 'center'
        }}>
          <Text 
            size="xl" 
            fw={700} 
            style={{ 
              fontFamily: 'Playfair Display',
              color: 'var(--text-primary)',
              fontSize: '32px'
            }}
          >
            欢迎使用奇墨 / Welcome to Qimo
          </Text>
        </Box>

        {/* 内容区 */}
        <Stack gap="xl" style={{ padding: '32px' }}>
          {step === 1 ? (
            <>
              <Box style={{ textAlign: 'center' }}>
                <IconBook size={64} style={{ color: 'var(--accent-secondary)', margin: '0 auto 16px' }} />
                <Text size="lg" style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                  开始您的阅读之旅
                </Text>
                <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
                  Start Your Reading Journey
                </Text>
              </Box>

              <Box style={{
                padding: '16px',
                backgroundColor: 'var(--highlight)',
                borderLeft: '3px solid var(--accent-secondary)'
              }}>
                <Text size="sm" style={{ color: 'var(--text-primary)' }}>
                  奇墨是一个优雅的 EPUB 阅读器，帮助您管理和阅读电子书。
                  <br />
                  <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                    Qimo is an elegant EPUB reader that helps you manage and read e-books.
                  </span>
                </Text>
              </Box>

              <Group justify="flex-end">
                <SignatureButton
                  text="下一步 / Next"
                  onClick={() => setStep(2)}
                  color="var(--accent-secondary)"
                />
              </Group>
            </>
          ) : (
            <>
              <Box style={{ textAlign: 'center' }}>
                <IconFolder size={64} style={{ color: 'var(--accent-secondary)', margin: '0 auto 16px' }} />
                <Text size="lg" style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                  选择书库位置
                </Text>
                <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
                  Select Library Location
                </Text>
              </Box>

              <Box>
                <Text size="sm" fw={500} style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                  选择一个文件夹作为您的书库，所有导入的书籍将存储在此处。
                  <br />
                  <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                    Select a folder as your library. All imported books will be stored here.
                  </span>
                </Text>
              </Box>

              <TextInput
                label="书库名称 / Library Name"
                placeholder="留空则使用文件夹名字 / Leave empty to use folder name"
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

              <Box
                style={{
                  padding: '16px',
                  border: '1px dashed var(--border-color)',
                  backgroundColor: selectedPath ? 'var(--highlight)' : 'transparent',
                  minHeight: '60px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Text 
                  size="sm" 
                  style={{ 
                    color: selectedPath ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontFamily: 'Courier Prime',
                    wordBreak: 'break-all'
                  }}
                >
                  {selectedPath || '尚未选择路径 / No path selected'}
                </Text>
              </Box>

              <Group justify="space-between">
                <SignatureButton
                  text="上一步 / Back"
                  onClick={() => setStep(1)}
                  color="var(--text-secondary)"
                />
                <Group gap="sm">
                  <Button
                    onClick={handleSelectPath}
                    style={{
                      borderRadius: 0,
                      backgroundColor: 'transparent',
                      borderColor: 'var(--border-color)',
                      borderWidth: '1px',
                      color: 'var(--text-primary)'
                    }}
                  >
                    浏览 / Browse
                  </Button>
                  {selectedPath && (
                    <SignatureButton
                      text="完成 / Finish"
                      onClick={handleComplete}
                      color="var(--accent-secondary)"
                    />
                  )}
                </Group>
              </Group>
            </>
          )}
        </Stack>
      </Box>

      {/* 警告对话框 */}
      <Modal
        opened={warningModalOpened}
        onClose={() => {
          setWarningModalOpened(false);
          setPendingPath('');
        }}
        title={
          <Group gap="sm">
            <IconAlertTriangle size={20} style={{ color: 'var(--accent-secondary)' }} />
            <Text style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>
              文件夹非空 / Folder Not Empty
            </Text>
          </Group>
        }
        centered
        size="md"
        zIndex={1100}
        styles={{
          content: { borderRadius: 0, backgroundColor: 'var(--bg-primary)' },
          header: { borderBottom: '1px solid var(--border-color)' }
        }}
      >
        <Stack gap="md">
          <Text size="sm" style={{ color: 'var(--text-primary)' }}>
            选择的文件夹包含文件，但不是奇墨的书库。
            <br />
            The selected folder contains files but is not a Qimo library.
          </Text>
          
          <Box style={{
            padding: '12px',
            backgroundColor: 'rgba(139, 58, 58, 0.1)',
            borderLeft: '3px solid var(--accent-secondary)'
          }}>
            <Text size="xs" style={{ color: 'var(--text-secondary)', fontFamily: 'Courier Prime' }}>
              {pendingPath}
            </Text>
          </Box>
          
          <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
            请选择以下操作之一：
            <br />
            Please choose one of the following actions:
          </Text>
          
          <Stack gap="sm">
            <Button
              onClick={handleClearAndUse}
              leftSection={<IconTrash size={16} />}
              style={{
                borderRadius: 0,
                backgroundColor: 'transparent',
                borderColor: 'var(--accent-secondary)',
                borderWidth: '1px',
                color: 'var(--accent-secondary)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
                e.currentTarget.style.color = 'var(--bg-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--accent-secondary)';
              }}
            >
              清空文件夹并创建书库 / Clear and Create Library
            </Button>
            
            <Button
              onClick={() => {
                setWarningModalOpened(false);
                setPendingPath('');
              }}
              style={{
                borderRadius: 0,
                backgroundColor: 'transparent',
                borderColor: 'var(--border-color)',
                borderWidth: '1px',
                color: 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              取消 / Cancel
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </Box>
  );
};

export default WelcomeModal;
