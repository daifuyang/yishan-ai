'use client';

import {
  Archive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  Image,
  Music,
  Palette,
  PanelLeft,
  PanelLeftClose,
  Settings,
  Terminal,
  Video,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import remarkGfm from 'remark-gfm';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

interface FileItem {
  name: string;
  type: 'directory' | 'file';
  size: number;
  mtime: string;
}

interface ListResponse {
  items: FileItem[];
  parent: string | null;
}

interface ReadResponse {
  content: string;
  ext: string;
}

interface TreeNode {
  name: string;
  type: 'directory' | 'file';
  path: string;
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
}

function getFileIcon(name: string, type: 'directory' | 'file', isExpanded?: boolean) {
  if (type === 'directory') {
    return isExpanded ? (
      <FolderOpen className="w-4 h-4 text-yellow-500" />
    ) : (
      <Folder className="w-4 h-4 text-yellow-500" />
    );
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';

  const iconMap: Record<string, React.ElementType> = {
    md: FileText,
    txt: File,
    doc: FileText,
    pdf: FileText,
    jpg: Image,
    png: Image,
    gif: Image,
    svg: Image,
    mp4: Video,
    mov: Video,
    avi: Video,
    mp3: Music,
    wav: Music,
    zip: Archive,
    tar: Archive,
    gz: Archive,
    js: Code,
    ts: Code,
    jsx: Code,
    tsx: Code,
    json: FileJson,
    yaml: FileCode,
    yml: FileCode,
    html: Globe,
    css: Palette,
    py: Terminal,
    go: Terminal,
    rs: Terminal,
    exe: Settings,
    sh: Terminal,
    bash: Terminal,
  };

  const IconComponent = iconMap[ext] || File;
  return <IconComponent className="w-4 h-4 text-muted-foreground" />;
}

function TreeItem({
  node,
  level,
  selectedPath,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  level: number;
  selectedPath: string;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  const isSelected = selectedPath === node.path;
  const paddingLeft = `${level * 16 + 12}px`;

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => {
          if (node.type === 'directory') {
            onToggle(node.path);
          } else {
            onSelect(node.path);
          }
        }}
        className={`
          group flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-all duration-150 ease-out rounded-md mx-1 w-full text-left
          ${
            isSelected
              ? 'bg-primary/10 text-primary font-medium shadow-sm'
              : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
          }
        `}
        style={{ paddingLeft }}
      >
        {node.type === 'directory' ? (
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform duration-200 ease-out flex-shrink-0 ${
              node.expanded ? 'rotate-90 text-primary' : ''
            } ${isSelected ? 'text-primary/70' : ''}`}
          />
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        <span className={`transition-colors ${isSelected ? '' : 'group-hover:text-foreground'}`}>
          {getFileIcon(node.name, node.type, node.expanded)}
        </span>
        <span className={`text-sm truncate ${isSelected ? '' : 'group-hover:font-medium'}`}>
          {node.name}
        </span>
      </button>
      {node.type === 'directory' && node.expanded && node.children && (
        <div className="animate-fade-in-down">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileExplorer({
  treeData,
  selectedPath,
  onToggle,
  onSelect,
}: {
  treeData: TreeNode[];
  selectedPath: string;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40">
      <div className="py-2 px-2">
        {treeData.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            level={0}
            selectedPath={selectedPath}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function PreviewView({
  content,
  scrollRef,
}: {
  content: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [scrollState, setScrollState] = useState({
    isNearTop: true,
    isNearBottom: false,
    canScroll: false,
  });
  const [showTopButton, setShowTopButton] = useState(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const updateScrollState = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      setScrollState({
        isNearTop: scrollTop < 100,
        isNearBottom: distanceFromBottom < 100,
        canScroll: scrollHeight > clientHeight,
      });
    };

    container.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => container.removeEventListener('scroll', updateScrollState);
  }, [scrollRef]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    setScrollState((prev) => ({
      ...prev,
      canScroll: container.scrollHeight > container.clientHeight,
    }));
  }, [scrollRef]);

  useEffect(() => {
    const shouldShowTop = !scrollState.isNearTop && !scrollState.isNearBottom;
    if (shouldShowTop !== showTopButton) {
      setShowTopButton(shouldShowTop);
    }
  }, [scrollState.isNearTop, scrollState.isNearBottom, showTopButton]);

  const scrollToTop = () => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const scrollToBottom = () => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div className="p-8 lg:p-12 max-w-6xl mx-auto">
        <article className="prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </div>

      {scrollState.canScroll && (
        <div className="fixed bottom-8 right-8 flex flex-col gap-2">
          {showTopButton && (
            <button
              type="button"
              onClick={scrollToTop}
              className="p-3 bg-background border border-border rounded-full shadow-lg hover:bg-accent transition-all duration-200"
              title="滚动到顶部"
            >
              <ChevronUp className="w-5 h-5 text-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={scrollState.isNearBottom ? scrollToTop : scrollToBottom}
            className="p-3 bg-background border border-border rounded-full shadow-lg hover:bg-accent transition-all duration-200"
            title={scrollState.isNearBottom ? '滚动到顶部' : '滚动到底部'}
          >
            {scrollState.isNearBottom ? (
              <ChevronUp className="w-5 h-5 text-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>
      )}
    </>
  );
}

function EmptyPreview({ sidebarOpen }: { sidebarOpen: boolean }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="mb-6">
          {sidebarOpen ? (
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <FileText className="w-10 h-10 text-primary/60" />
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
              <Folder className="w-10 h-10 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          {sidebarOpen ? (
            <>
              <p className="text-lg font-medium text-foreground mb-1">👈 选择文件开始预览</p>
              <p className="text-sm text-muted-foreground">
                从左侧文件资源管理器中选择一个文件，即可在右侧查看其内容
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-foreground mb-1">📂 侧边栏已收起</p>
              <p className="text-sm text-muted-foreground mb-4">
                点击右上角的展开按钮，打开文件资源管理器
              </p>
              <p className="text-xs text-muted-foreground/70">
                或直接访问 /preview 路由查看完整界面
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewPageContent() {
  const _router = useRouter();
  const searchParams = useSearchParams();
  const [initialData, setInitialData] = useState<ListResponse | null>(null);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [fileContent, setFileContent] = useState<ReadResponse | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const pathParam = searchParams.get('path') || '';
  const type = searchParams.get('type');

  const isDirectFilePreview = type === 'md' && pathParam;

  const getParentPath = useCallback((filePath: string): string => {
    const segments = filePath.split('/').filter(Boolean);
    segments.pop();
    return segments.join('/');
  }, []);

  const currentPath = isDirectFilePreview ? getParentPath(pathParam) : pathParam;

  const buildTree = useCallback((items: FileItem[], basePath: string): TreeNode[] => {
    return items
      .map((item) => ({
        name: item.name,
        type: item.type,
        path: basePath ? `${basePath}/${item.name}` : item.name,
        children: item.type === 'directory' ? [] : undefined,
        expanded: false,
      }))
      .sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
  }, []);

  const fetchDirectory = useCallback(async (path: string) => {
    const res = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to load');
    }
    const data: ListResponse = await res.json();
    return data;
  }, []);

  const loadChildren = useCallback(
    async (nodePath: string) => {
      try {
        const data = await fetchDirectory(nodePath);
        return buildTree(data.items, nodePath);
      } catch (e) {
        console.error('Failed to load children:', e);
        return [];
      }
    },
    [fetchDirectory, buildTree]
  );

  const handleToggle = useCallback(
    async (path: string) => {
      const updateTree = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => {
          if (node.path === path) {
            if (!node.expanded && node.children?.length === 0) {
              return { ...node, expanded: true, loading: true };
            }
            return { ...node, expanded: !node.expanded };
          }
          if (node.children) {
            return { ...node, children: updateTree(node.children) };
          }
          return node;
        });
      };

      setTreeData((prev) => updateTree(prev));

      if (!treeData.find((n) => n.path === path)?.expanded) {
        const children = await loadChildren(path);
        const updateTreeWithChildren = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map((node) => {
            if (node.path === path) {
              return { ...node, children, loading: false };
            }
            if (node.children) {
              return { ...node, children: updateTreeWithChildren(node.children) };
            }
            return node;
          });
        };
        setTreeData((prev) => updateTreeWithChildren(prev));
      }
    },
    [loadChildren, treeData]
  );

  const handleSelect = useCallback(async (path: string) => {
    setSelectedPath(path);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load');
      }
      setFileContent(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      try {
        const directoryPath = isDirectFilePreview ? getParentPath(pathParam) : pathParam;
        const data = await fetchDirectory(directoryPath);
        setInitialData(data);
        setTreeData(buildTree(data.items, directoryPath));

        if (isDirectFilePreview) {
          setSelectedPath(pathParam);
          const res = await fetch(`/api/fs/read?path=${encodeURIComponent(pathParam)}`);
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to load');
          }
          setFileContent(await res.json());
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setTreeData([]);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [pathParam, isDirectFilePreview, fetchDirectory, buildTree, getParentPath]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* 右侧：导航头 + 内容区域 */}
      <div className="flex flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
          {/* 左侧：文件树（可折叠） */}
          <ResizablePanel
            panelRef={sidebarPanelRef}
            defaultSize="20%"
            minSize="10%"
            maxSize="40%"
            collapsible={true}
            collapsedSize={0}
          >
            <div className="h-full flex flex-col bg-transparent">
              <div className="h-12 px-4 border-b border-border/50 flex items-center">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  文件管理系统
                </h2>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {loading && !initialData ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-muted-foreground text-sm">加载中...</div>
                  </div>
                ) : error && !initialData ? (
                  <div className="p-4 text-center">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                ) : (
                  <FileExplorer
                    treeData={treeData}
                    selectedPath={selectedPath}
                    onToggle={handleToggle}
                    onSelect={handleSelect}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 右侧主区域 */}
          <ResizablePanel className="flex flex-col" defaultSize="80%" minSize="60%">
            {/* 导航头：折叠按钮 + 路径 */}
            <div className="h-12 border-b bg-background px-6 flex items-center gap-4 sticky top-0 z-10">
              <button
                type="button"
                onClick={() => {
                  if (sidebarPanelRef.current) {
                    if (sidebarOpen) {
                      sidebarPanelRef.current.collapse();
                    } else {
                      sidebarPanelRef.current.expand();
                    }
                    setSidebarOpen(!sidebarOpen);
                  }
                }}
                className="p-2 hover:bg-accent rounded-lg transition-all duration-200 active:scale-95"
                title={sidebarOpen ? '收起文件资源管理器' : '展开文件资源管理器'}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="w-4 h-4 text-muted-foreground/60" />
                ) : (
                  <PanelLeft className="w-4 h-4 text-muted-foreground/60" />
                )}
              </button>
              <p className="text-xs text-muted-foreground/70 font-mono truncate flex-1 min-w-0">
                ~/.yishan-ai/workspace/{currentPath || ''}
              </p>
            </div>

            {/* 内容区域 */}
            <div className="bg-background overflow-auto flex-1" ref={contentScrollRef}>
              {loading && !fileContent ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3 mx-auto" />
                    <p className="text-sm text-muted-foreground">加载中...</p>
                  </div>
                </div>
              ) : error && !fileContent ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md px-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-destructive/10 flex items-center justify-center">
                      <p className="text-3xl">⚠️</p>
                    </div>
                    <p className="text-destructive font-medium mb-2">加载失败</p>
                    <p className="text-sm text-muted-foreground mb-4">{error}</p>
                    <button
                      type="button"
                      onClick={() => selectedPath && handleSelect(selectedPath)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                      重试
                    </button>
                  </div>
                </div>
              ) : fileContent ? (
                <PreviewView content={fileContent.content} scrollRef={contentScrollRef} />
              ) : (
                <EmptyPreview sidebarOpen={sidebarOpen} />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-background flex items-center justify-center">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      }
    >
      <PreviewPageContent />
    </Suspense>
  );
}
