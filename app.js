async function testSupabase() {
    const { data, error } = await supabaseClient
        .from('ngos')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Supabase error:', error);
        return;
    }

    console.log('Supabase connected:', data);
}

testSupabase();