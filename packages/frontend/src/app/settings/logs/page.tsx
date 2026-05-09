'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/lib/api-base';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
interface LogFile {
  filename: string;
  size: number;
  mtime: string;
}

interface LogEntry {
  line: number;
  raw: string;
  time: string;
  level: number;
  levelName: string;
  message: string;
  sessionId?: string;
  component?: string;
}

function parseLogLine(line: string, lineNum: number): LogEntry {
  try {
    const json = JSON.parse(line);
    return {
      line: lineNum,
      raw: line,
      time: json.time ? new Date(json.time).toLocaleTimeString() : '',
      level: json.level || 30,
      levelName: getLevelName(json.level || 30),
      message: json.message || '',
      sessionId: json.sessionId,
      component: json.component,
    };
  } catch {
    return {
      line: lineNum,
      raw: line,
      time: '',
      level: 30,
      levelName: 'INFO',
      message: line,
    };
  }
}

function getLevelName(level: number): string {
  switch (level) {
    case 10: return 'TRACE';
    case 20: return 'DEBUG';
    case 30: return 'INFO';
    case 40: return 'WARN';
    case 50: return 'ERROR';
    default: return 'INFO';
  }
}

function getLevelColor(level: number): string {
  switch (level) {
    case 10: return 'text-gray-400';
    case 20: return 'text-gray-500';
    case 30: return 'text-blue-500';
    case 40: return 'text-yellow-500';
    case 50: return 'text-red-500';
    default: return 'text-blue-500';
  }
}

function LogsContent() {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      fetchContent(selectedFile);
    }
  }, [selectedFile]);

  async function fetchFiles() {
    try {
      const res = await fetch(apiUrl('/api/logs'));
      const data = await res.json();
      setFiles(data);
      if (data.length > 0 && !selectedFile) {
        setSelectedFile(data[0].filename);
      }
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
  }

  async function fetchContent(filename: string) {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/logs/${filename}`));
      const text = await res.text();
      setContent(text);
    } catch (e) {
      console.error('Failed to fetch content:', e);
      setContent('Error loading log');
    }
    setLoading(false);
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4 border-b">
        <Link href="/settings">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-base font-semibold flex-1">日志查看器</h1>
        <Button variant="ghost" size="sm" onClick={fetchFiles} className="h-8">
          <RefreshCw className="w-4 h-4 mr-1" />
          刷新
        </Button>
      </header>

      <div className="px-6 py-3 border-b bg-muted/50">
        {files.length > 0 ? (
          <Select value={selectedFile} onValueChange={setSelectedFile}>
            <SelectTrigger className="w-[400px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {files.map(f => (
                <SelectItem key={f.filename} value={f.filename} className="flex items-center gap-2">
                  <FileText className="w-4 h-4 inline mr-2" />
                  <span>{f.filename}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({formatBytes(f.size)})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground">暂无日志文件</p>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            加载中...
          </div>
        ) : content ? (
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">
            {content.split('\n').map((line, i) => {
              const entry = parseLogLine(line, i + 1);
              return (
                <div key={i} className="py-0.5 hover:bg-muted/50">
                  <span className="text-muted-foreground mr-2 select-none">
                    {entry.line}
                  </span>
                  <span className={`${getLevelColor(entry.level)} mr-2`}>
                    {entry.levelName}
                  </span>
                  <span className="text-muted-foreground mr-3">
                    {entry.time}
                  </span>
                  <span className="text-foreground">{entry.message}</span>
                </div>
              );
            })}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            选择日志文件查看内容
          </div>
        )}
      </div>
    </div>
  );
}

export default function LogsPage() {
  return <LogsContent />;
}
