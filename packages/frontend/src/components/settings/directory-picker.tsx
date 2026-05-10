'use client';

import { AlertCircle, Check, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DirectoryPickerProps {
  directories: string[];
  onChange: (directories: string[]) => void;
  allowDelete?: boolean;
}

export function DirectoryPicker({ directories, onChange }: DirectoryPickerProps) {
  const [input, setInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!input.trim()) return;

    setValidating(true);
    setValidationError(null);

    try {
      const response = await fetch(
        `/api/config/workspace/validate?path=${encodeURIComponent(input.trim())}`
      );
      const result = await response.json();

      if (result.valid) {
        if (!directories.includes(input.trim())) {
          onChange([...directories, input.trim()]);
        }
        setInput('');
        setValidationError(null);
      } else {
        let errorMsg = '验证失败';
        if (result.isProtected) {
          errorMsg = '禁止访问系统保护目录';
        } else if (!result.readable) {
          errorMsg = '目录不可读';
        } else if (!result.writable) {
          errorMsg = '目录不可写';
        } else if (!result.exists) {
          errorMsg = '目录不存在';
        } else {
          errorMsg = result.error || '未知错误';
        }
        setValidationError(errorMsg);
      }
    } catch (_error) {
      setValidationError('验证请求失败');
    } finally {
      setValidating(false);
    }
  };

  const handleRemove = (path: string) => {
    onChange(directories.filter((d) => d !== path));
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2">
          <Input
            placeholder="输入路径后按 Enter 或点击添加"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setValidationError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!input.trim() || validating}
          >
            {validating ? (
              <span className="animate-spin h-4 w-4">⏳</span>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                添加
              </>
            )}
          </Button>
        </div>
      </div>

      {validationError && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 p-2 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">已添加目录 ({directories.length}):</p>
        {directories.length === 0 ? (
          <div className="text-sm text-muted-foreground italic py-2">暂无已添加的目录</div>
        ) : (
          <div className="space-y-1">
            {directories.map((dir) => (
              <div
                key={dir}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-mono truncate">{dir}</span>
                <Check className="h-4 w-4 text-green-500 shrink-0" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                  onClick={() => setDeleteConfirm(dir)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要移除目录「{deleteConfirm}」吗？此操作不会删除实际文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleRemove(deleteConfirm)}
              className="bg-red-500 hover:bg-red-600"
            >
              移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
