const https = require('https');

const supabaseUrl = 'https://rivssielrsjarjwmoycp.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdnNzaWVscnNqYXJqd21veWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMTI3NjIsImV4cCI6MjEwNzY4ODc2Mn0.YWwjxYQcKIXW0teJrF8CmcnBMuvxMv4V6plprJv9tas';

function testQuery(select) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(select)}&limit=1`);
    const req = https.get(url, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', resolve);
  });
}

async function run() {
  console.log('Query 1: *, tenants(*), branches(*), order_items(*)');
  const r1 = await testQuery('*, tenants(*), branches(*), order_items(*)');
  console.log(r1);

  console.log('Query 2: *, tenants(*), order_items(*)');
  const r2 = await testQuery('*, tenants(*), order_items(*)');
  console.log(r2);
}

run();

