const https = require('https');

const supabaseUrl = 'https://rivssielrsjarjwmoycp.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdnNzaWVscnNqYXJqd21veWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMTI3NjIsImV4cCI6MjEwNzY4ODc2Mn0.YWwjxYQcKIXW0teJrF8CmcnBMuvxMv4V6plprJv9tas';

function query(table, select = '*') {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}?select=${select}&order=created_at.desc&limit=5`);
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
    req.on('error', reject);
  });
}

async function run() {
  const riders = await query('riders', 'id,name,email,phone,status');
  console.log('--- RIDERS IN DB ---');
  console.log(riders);

  const orders = await query('orders', 'id,order_number,status,driver_id,created_at');
  console.log('--- RECENT ORDERS ---');
  console.log(orders);
}

run();
