import { FastifyPluginAsync } from 'fastify';
import { getMcpManager, MCPConfig } from '../lib/mcp-manager.js';

const mcpRoutes: FastifyPluginAsync = async (fastify) => {
  const mcpManager = getMcpManager();

  await mcpManager.loadConfig();
  await mcpManager.reconnectAll();

  fastify.get('/api/mcp/servers', async () => {
    return mcpManager.getServers();
  });

  fastify.post('/api/mcp/servers', async (request) => {
    const { name, config } = request.body as { name: string; config: MCPConfig };
    if (!name || !config) {
      throw new Error('name and config are required');
    }
    await mcpManager.addServer(name, config);
    return { success: true, server: mcpManager.getServers().find(s => s.name === name) };
  });

  fastify.patch('/api/mcp/servers/:name', async (request) => {
    const { name } = request.params as { name: string };
    const updates = request.body as { config?: MCPConfig; enabled?: boolean };
    await mcpManager.updateServer(name, updates);
    return { success: true, server: mcpManager.getServers().find(s => s.name === name) };
  });

  fastify.delete('/api/mcp/servers/:name', async (request) => {
    const { name } = request.params as { name: string };
    await mcpManager.removeServer(name);
    return { success: true };
  });

  fastify.post('/api/mcp/servers/:name/connect', async (request) => {
    const { name } = request.params as { name: string };
    const tools = await mcpManager.connectServer(name);
    return { success: true, tools };
  });

  fastify.post('/api/mcp/servers/:name/disconnect', async (request) => {
    const { name } = request.params as { name: string };
    await mcpManager.disconnectServer(name);
    return { success: true };
  });

  fastify.get('/api/mcp/tools', async () => {
    return mcpManager.listTools();
  });

  fastify.post('/api/mcp/call', async (request) => {
    const { tool, args } = request.body as { tool: string; args: Record<string, any> };
    if (!tool) {
      throw new Error('tool name is required');
    }
    const result = await mcpManager.callTool(tool, args || {});
    return { success: true, result };
  });
};

export default mcpRoutes;
