import { FastifyPluginAsync } from 'fastify';

const AVAILABLE_MODELS = [
  { id: 'MiniMax-M2.7', name: 'MiniMax-M2.7', contextWindow: 204800, outputSpeed: '~60 TPS' },
  { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax-M2.7-highspeed', contextWindow: 204800, outputSpeed: '~100 TPS' },
  { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5', contextWindow: 204800, outputSpeed: '~60 TPS' },
  { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax-M2.5-highspeed', contextWindow: 204800, outputSpeed: '~100 TPS' },
  { id: 'MiniMax-M2.1', name: 'MiniMax-M2.1', contextWindow: 204800, outputSpeed: '~60 TPS' },
  { id: 'MiniMax-M2.1-highspeed', name: 'MiniMax-M2.1-highspeed', contextWindow: 204800, outputSpeed: '~100 TPS' },
  { id: 'MiniMax-M2', name: 'MiniMax-M2', contextWindow: 204800, outputSpeed: '—' },
];

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  fastify.get('/api/models', async () => {
    return AVAILABLE_MODELS;
  });
};

export default healthRoutes;