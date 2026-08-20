const fetch = require('node-fetch');

const SUPABASE_URL = 'https://kqclatbldzcbcgqnncny.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxY2xhdGJsZHpjYmNncW5uY255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzM4ODcsImV4cCI6MjA4MzQ0OTg4N30.kTmRdkkV-VB6damvCNhTeiaeJRvkLo5zx5Sz8K89Wk8';

async function testEdgeFunction() {
  console.log('Calling generate-mission edge function...');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-mission`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'daily_missions',
      payload: {
        userProfile: { id: 'demo123', age: 53, gender: 'male', height: 166, weight: 81 },
        language: 'ko',
        goalList: {
            'body_wellness': '체중감량 7kg / 매일 걷기와 팔굽혀펴기를 꾸준히 하고싶어'
        },
        refresh: false
      }
    })
  });
  
  const text = await res.text();
  console.log('STATUS:', res.status);
  console.log('RESPONSE:', text);
}

testEdgeFunction();
