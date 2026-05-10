import { createTask, listTasks, updateTask } from './task-store.js';
import type { ExecuteResult, Tool, ToolContext } from './types.js';

interface TaskArgs {
  action: 'create' | 'update' | 'complete' | 'list';
  id?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
}

export function createTaskTool(): Tool {
  return {
    id: 'task',
    description: 'Manage tasks for subagents',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'complete', 'list'],
          description: 'Action to perform',
        },
        id: {
          type: 'string',
          description: 'Task ID (required for update/complete)',
        },
        description: {
          type: 'string',
          description: 'Task description (required for create)',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'failed'],
          description: 'Task status',
        },
        result: {
          type: 'string',
          description: 'Task result (for completed/failed tasks)',
        },
      },
      required: ['action'],
    },
    async execute(args: unknown, _ctx: ToolContext): Promise<ExecuteResult> {
      const { action, id, description, status, result } = args as TaskArgs;

      switch (action) {
        case 'create': {
          if (!description) {
            throw new Error('description is required for create action');
          }
          const task = createTask(description);
          return {
            title: 'Task Created',
            output: `Created task "${description}" with ID: ${task.id}`,
            metadata: { id: task.id, action: 'create' },
          };
        }

        case 'update': {
          if (!id) {
            throw new Error('id is required for update action');
          }
          const task = updateTask(id, { description, status, result });
          if (!task) {
            throw new Error(`Task not found: ${id}`);
          }
          return {
            title: 'Task Updated',
            output: `Updated task ${id}: ${task.description} [${task.status}]`,
            metadata: { id, action: 'update' },
          };
        }

        case 'complete': {
          if (!id) {
            throw new Error('id is required for complete action');
          }
          const task = updateTask(id, { status: 'completed', result });
          if (!task) {
            throw new Error(`Task not found: ${id}`);
          }
          return {
            title: 'Task Completed',
            output: `Task ${id} completed: ${task.description}${result ? `\nResult: ${result}` : ''}`,
            metadata: { id, action: 'complete' },
          };
        }

        case 'list': {
          const tasks = listTasks();
          if (tasks.length === 0) {
            return {
              title: 'Task List',
              output: 'No tasks found',
              metadata: { count: 0 },
            };
          }
          const lines = tasks.map(
            (t) =>
              `[${t.status === 'completed' ? 'x' : t.status === 'failed' ? '!' : ' '}] ${t.description}\n  ID: ${t.id} | Status: ${t.status}${t.result ? `\n  Result: ${t.result}` : ''}`
          );
          return {
            title: 'Task List',
            output: lines.join('\n\n'),
            metadata: { count: tasks.length },
          };
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
