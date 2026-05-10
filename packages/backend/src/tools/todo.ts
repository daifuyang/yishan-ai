import { createTodo, deleteTodo, listTodos, updateTodo } from './todo-store.js';
import type { ExecuteResult, Tool, ToolContext } from './types.js';

interface TodoWriteArgs {
  action: 'create' | 'update' | 'delete' | 'list';
  id?: string;
  title?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  content?: string;
}

export function createTodoWriteTool(): Tool {
  return {
    id: 'todo',
    description: 'Manage todos/tasks',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete', 'list'],
          description: 'Action to perform',
        },
        id: {
          type: 'string',
          description: 'Todo ID (required for update/delete)',
        },
        title: {
          type: 'string',
          description: 'Todo title (required for create)',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed'],
          description: 'Todo status',
        },
        content: {
          type: 'string',
          description: 'Todo content/description',
        },
      },
      required: ['action'],
    },
    async execute(args: unknown, _ctx: ToolContext): Promise<ExecuteResult> {
      const { action, id, title, status, content } = args as TodoWriteArgs;

      switch (action) {
        case 'create': {
          if (!title) {
            throw new Error('title is required for create action');
          }
          const todo = createTodo(title, content);
          return {
            title: 'Todo Created',
            output: `Created todo "${title}" with ID: ${todo.id}`,
            metadata: { id: todo.id, action: 'create' },
          };
        }

        case 'update': {
          if (!id) {
            throw new Error('id is required for update action');
          }
          const todo = updateTodo(id, { title, status, content });
          if (!todo) {
            throw new Error(`Todo not found: ${id}`);
          }
          return {
            title: 'Todo Updated',
            output: `Updated todo ${id}: ${todo.title} [${todo.status}]`,
            metadata: { id, action: 'update' },
          };
        }

        case 'delete': {
          if (!id) {
            throw new Error('id is required for delete action');
          }
          const deleted = deleteTodo(id);
          if (!deleted) {
            throw new Error(`Todo not found: ${id}`);
          }
          return {
            title: 'Todo Deleted',
            output: `Deleted todo ${id}`,
            metadata: { id, action: 'delete' },
          };
        }

        case 'list': {
          const todos = listTodos();
          if (todos.length === 0) {
            return {
              title: 'Todo List',
              output: 'No todos found',
              metadata: { count: 0 },
            };
          }
          const lines = todos.map(
            (t) =>
              `[${t.status === 'completed' ? 'x' : ' '}] ${t.title}${t.content ? `\n  ${t.content}` : ''}\n  ID: ${t.id} | Created: ${new Date(t.createdAt).toLocaleString()}`
          );
          return {
            title: 'Todo List',
            output: lines.join('\n\n'),
            metadata: { count: todos.length },
          };
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
