import { createApp } from './app.js';
import { config } from './config.js';
import { scheduleDailyChecks } from './jobs/dailyChecks.js';

createApp().listen(config.port, () => {
  console.log(`FactoryFlow API running on http://localhost:${config.port}`);
});
scheduleDailyChecks();
