export interface ApplicationConfig {
  appName: string;
  port: number;
}

export const defaultConfig = (): ApplicationConfig => ({
  appName: process.env.APP_NAME ?? 'eXeLearning API',
  port: process.env.PORT ? Number(process.env.PORT) : 3000
});
