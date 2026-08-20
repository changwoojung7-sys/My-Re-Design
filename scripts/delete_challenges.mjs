import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kqclatbldzcbcgqnncny.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxY2xhdGJsZHpjYmNncW5uY255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzM4ODcsImV4cCI6MjA4MzQ0OTg4N30.kTmRdkkV-VB6damvCNhTeiaeJRvkLo5zx5Sz8K89Wk8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    // Find user by email
    const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .eq('email', 'changwoojung7@gmail.com')
        .maybeSingle();

    console.log('Profile lookup:', { profile, pErr });

    if (!profile) {
        // Find by partial search
        const { data: allP } = await supabase.from('profiles').select('id, email, nickname').ilike('email', '%changwoojung7%');
        console.log('Found profiles:', allP);
        if (allP && allP.length > 0) {
            for (const p of allP) {
                await deleteForUser(p.id, p.email);
            }
        }
        return;
    }

    await deleteForUser(profile.id, profile.email);
}

async function deleteForUser(userId, email) {
    console.log(`Deleting buddy challenges for user ${userId} (${email})...`);
    
    // Find all buddy_challenges where creator_id = userId OR partner_id = userId
    const { data: challenges, error: cErr } = await supabase
        .from('buddy_challenges')
        .select('*')
        .or(`creator_id.eq.${userId},partner_id.eq.${userId}`);

    console.log('Found challenges:', challenges);

    if (challenges && challenges.length > 0) {
        for (const c of challenges) {
            const { error: dErr } = await supabase
                .from('buddy_challenges')
                .delete()
                .eq('id', c.id);
            console.log(`Deleted challenge ${c.id}:`, dErr || 'SUCCESS');
        }
    } else {
        console.log('No challenges to delete.');
    }
}

main().catch(console.error);
