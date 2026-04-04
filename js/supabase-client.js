// frontend/js/supabase-client.js

// 1. Вставьте сюда длинную ссылку Project URL
const supabaseUrl = 'https://prttnonvwnyedjvzohbi.supabase.co';

// 2. Вставьте сюда длинный ключ anon / public
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBydHRub252d255ZWRqdnpvaGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzc0MzAsImV4cCI6MjA4ODgxMzQzMH0.XE0b9E0-zttEfoYGU8Vho-sxT631cx9t569dUn9o9Ac';

// ПРАВКА: Переименовали переменную в supabaseClient, 
// а обращаемся к оригинальному объекту window.supabase
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);