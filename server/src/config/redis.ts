import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default redis; // <-- Default export

// Test connection
async function testRedis() {
  try {
    await redis.set('foo', 'bar');
    const data = await redis.get('foo');
    console.log('Redis Data:', data);
  } catch (error) {
    console.error('Redis Error:', error);
  }
}

testRedis();