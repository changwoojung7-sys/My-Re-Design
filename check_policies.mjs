import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:/calamusAppBuild/MyReDesign_App/.env');
const envContent = fs.readFileSync(envPath, 'utf8');

let url = '';
let key = '';

envContent.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function run() {
    // Check policies
    const res = await fetch(`${url}/rest/v1/rpc/get_policies`, {
        method: 'POST',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log(await res.text());
}
run();
