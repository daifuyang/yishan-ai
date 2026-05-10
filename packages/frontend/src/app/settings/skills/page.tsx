'use client';

import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { type Skill, useSkillStore } from '@/stores/skill-store';

export default function SkillsSettingsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SkillList />
    </div>
  );
}

function SkillList() {
  const { skills, fetchSkills, addSkill, updateSkill, removeSkill, enableSkill, disableSkill } =
    useSkillStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillContent, setSkillContent] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const generateSkillContent = (): string => {
    return `---
name: ${skillName}
description: "${skillDescription}"
---

# ${skillName}

${skillContent}`;
  };

  const handleConfirm = async () => {
    if (!skillName.trim() || !skillDescription.trim() || !skillContent.trim()) return;

    try {
      const content = generateSkillContent();
      if (dialogMode === 'add') {
        await addSkill(skillName, content);
      } else if (editingSkill) {
        await updateSkill(editingSkill.name, content);
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

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h3 className="font-medium">已安装的 Skills ({skills.length})</h3>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" />
          添加 Skill
        </Button>
      </div>

      {/* Skill List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2">
          {skills.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              暂无 Skills，点击「添加 Skill」开始
            </div>
          ) : (
            skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-start gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
              >
                <FileText className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{skill.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {skill.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={skill.enabled}
                    onCheckedChange={() => handleToggleEnabled(skill)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {skill.enabled ? '启用' : '停用'}
                  </span>
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
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? '添加 Skill' : '编辑 Skill'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'add' ? '填写技能信息创建新的 Skill' : '编辑 Skill 内容'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="skill-name" className="text-sm font-medium">
                技能名称
              </label>
              <Input
                id="skill-name"
                value={skillName}
                onChange={(e) =>
                  setSkillName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                }
                placeholder="my-skill"
                disabled={dialogMode === 'edit'}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="skill-description" className="text-sm font-medium">
                描述
              </label>
              <Input
                id="skill-description"
                value={skillDescription}
                onChange={(e) => setSkillDescription(e.target.value)}
                placeholder="这个 Skill 的功能和使用场景..."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="skill-content" className="text-sm font-medium">
                指令
              </label>
              <Textarea
                id="skill-content"
                value={skillContent}
                onChange={(e) => setSkillContent(e.target.value)}
                placeholder={`## 使用场景
- 场景1：当用户需要...
- 场景2：适合...

## 指令
1. 第一步...
2. 第二步...
3. 第三步...`}
                className="min-h-[200px] text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!skillName.trim() || !skillDescription.trim() || !skillContent.trim()}
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
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
