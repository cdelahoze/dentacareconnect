import app from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 DentaCare Connect Server running on port ${env.PORT}`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 Allowed Origin: ${env.CLIENT_URL}`);
  console.log(`=================================`);
});
