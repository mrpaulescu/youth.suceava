const SUPABASE_URL = 'https://ljjatyjijacsatqvogvz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqamF0eWppamFjc2F0cXZvZ3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxOTQyMDMsImV4cCI6MjEwMzc3MDIwM30.r2VkQmbM4QGKVxbhSbM82qW6GGMiaKFTTW1dDGRxQxA';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);