
import { createClient } from 'redis';

const client = createClient({
    username: 'default',
    password: 'jXRbhHcwUz9IwtNvP0JDiLYqM0wSLirc',
    socket: {
        host: 'redis-19035.crce179.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 19035
    }
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

await client.set('foo', 'bar');
const result = await client.get('foo');
console.log(result)  // >>> bar

export { client as redisClient };
