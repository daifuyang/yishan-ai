declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    MINIMAX_API_KEY: string;
    MINIMAX_BASE_URL: string;
    DEFAULT_MODEL: string;
  }
}