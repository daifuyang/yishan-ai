'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, Upload, FileText, FolderOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSkillStore, Skill } from '@/stores/skill-store';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function SkillsSettingsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <TooltipProvider>
        <SkillList />
      </TooltipProvider>
    </div>
  );
}

function SkillList() {
  const { skills, fetchSkills, addSkill, updateSkill, removeSkill, enableSkill, disableSkill } = useSkillStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillContent, setSkillContent] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const resetForm = () => {
    setSkillName('');
    setSkillDescription('');
    setSkillContent('');
    setEditingSkill(null);
  };

  const openAddDialog = () => {
    setDialogMode('add');
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (skill: Skill) => {
    setDialogMode('edit');
    setEditingSkill(skill);
    setSkillName(skill.name);
    setSkillDescription(skill.description);
    setSkillContent(skill.content || '');
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!skillName.trim() || !skillContent.trim()) return;

    try {
      if (dialogMode === 'add') {
        await addSkill(skillName, skillContent);
      } else if (editingSkill) {
        await updateSkill(editingSkill.name, skillContent);
      }
      setDialogOpen(false);
      resetForm();
      fetchSkills();
    } catch (err) {
      console.error('Failed to save skill:', err);
    }
  };

  const handleDelete = async (name: string) => {
    await removeSkill(name);
    setDeleteConfirm(null);
    fetchSkills();
  };

  const handleToggleEnabled = async (skill: Skill) => {
    if (skill.enabled) {
      await disableSkill(skill.name);
    } else {
      await enableSkill(skill.name);
    }
    fetchSkills();
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];

    if (file.name === 'SKILL.md' && file.type === 'text/plain') {
      const content = await file.text();
      const metadata = parseFrontmatter(content);
      if (metadata.name) {
        setSkillName(metadata.name);
        setSkillDescription(metadata.description || '');
        setSkillContent(content);
        setDialogMode('add');
        setDialogOpen(true);
      }
    } else if (file.type === 'text/plain' || file.name.endsWith('.md')) {
      const content = await file.text();
      const metadata = parseFrontmatter(content);
      if (metadata.name) {
        setSkillName(metadata.name);
        setSkillDescription(metadata.description || '');
        setSkillContent(content);
        setDialogMode('add');
        setDialogOpen(true);
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h3 className="font-medium">
          已安装的 Skills ({skills.length})
        </h3>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" />
          添加 Skill
        </Button>
      </div>

      {/* Skill List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {skills.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              暂无 Skills，点击「添加 Skill」开始
            </div>
          ) : (
            skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-start gap-4 p-4 border rounded-lg bg-card"
              >
                <FileText className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{skill.name}</span>
                    {skill.version && (
                      <span className="text-xs text-muted-foreground">v{skill.version}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {skill.description}
                  </p>
                  {skill.metadata?.requires?.bins && (
                    <p className="text-xs text-muted-foreground mt-1">
                      需要: {skill.metadata.requires.bins.join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={skill.enabled}
                      onCheckedChange={() => handleToggleEnabled(skill)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {skill.enabled ? '启用' : '停用'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => openEditDialog(skill)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-red-600 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteConfirm(skill.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'add' ? '添加 Skill' : '编辑 Skill'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'add'
                ? '填写 Skill 信息或拖拽 SKILL.md 文件到下方区域'
                : '编辑 SKILL.md 内容'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Drag & Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                拖拽 SKILL.md 文件到此处
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                或点击选择文件
              </p>
              <input
                type="file"
                accept=".md,SKILL.md,text/plain"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const content = await file.text();
                  const metadata = parseFrontmatter(content);
                  if (metadata.name) {
                    setSkillName(metadata.name);
                    setSkillDescription(metadata.description || '');
                    setSkillContent(content);
                    setDialogMode('add');
                  }
                }}
              />
            </div>

            {/* Manual Config */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">或手动配置</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Skill 名称</label>
                <Input
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="my-skill"
                  disabled={dialogMode === 'edit'}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">描述</label>
                <Input
                  value={skillDescription}
                  onChange={(e) => setSkillDescription(e.target.value)}
                  placeholder="这个 Skill 的功能描述..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">SKILL.md 内容</label>
                <Textarea
                  value={skillContent}
                  onChange={(e) => setSkillContent(e.target.value)}
                  placeholder={`---\nname: my-skill\nversion: 1.0.0\ndescription: "我的 Skill 描述"\n---\n\n# My Skill\n\n技能说明...`}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!skillName.trim() || !skillContent.trim()}
            >
              {dialogMode === 'add' ? '确认添加' : '保存更改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除 Skill「{deleteConfirm}」吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseFrontmatter(content: string): { name?: string; description?: string; version?: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter = match[1];
  const result: Record<string, string> = {};

  const extractValue = (key: string): string | undefined => {
    const patterns = [
      new RegExp(`^${key}:\\s*["']([^"']*)["']`, 'm'),
      new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'),
    ];
    for (const pattern of patterns) {
      const m = frontmatter.match(pattern);
      if (m) return m[1].trim();
    }
    return undefined;
  };

  result.name = extractValue('name') || '';
  result.description = extractValue('description') || '';
  result.version = extractValue('version') || '';

  return result;
}