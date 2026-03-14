// frontend/js/admin.js

document.addEventListener('DOMContentLoaded', async () => {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginBtn = document.getElementById('loginBtn');
    const errorText = document.getElementById('loginError');
    const tbody = document.getElementById('bookingsTableBody');

    // 1. ПРОВЕРКА: Авторизован ли админ сейчас?
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        showDashboard();
    }

    // 2. ЛОГИН
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        
        loginBtn.textContent = 'Вход...';
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            errorText.style.display = 'block';
            errorText.textContent = 'Неверный email или пароль';
            loginBtn.textContent = 'Войти';
        } else {
            errorText.style.display = 'none';
            showDashboard();
        }
    });

    // 3. ВЫХОД
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        location.reload(); // Перезагружаем страницу
    });

    // 4. ПОКАЗЫВАЕМ ТАБЛИЦУ
    async function showDashboard() {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        logoutBtn.style.display = 'inline-block';
        loadBookings();
    }

    // 5. ЗАГРУЖАЕМ ДАННЫЕ ИЗ БАЗЫ
    async function loadBookings() {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Загрузка данных...</td></tr>';

        // Берем все брони, сортируем от самых новых к старым
        const { data: bookings, error } = await supabaseClient
            .from('booking')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Ошибка загрузки: ${error.message}</td></tr>`;
            return;
        }

        if (bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">Пока нет ни одного бронирования.</td></tr>';
            return;
        }

        tbody.innerHTML = ''; // Очищаем таблицу перед вставкой

        bookings.forEach(booking => {
            const tr = document.createElement('tr');
            
            // Красиво форматируем время (если это массив)
            const timeStr = Array.isArray(booking.booking_times) ? booking.booking_times.join(', ') : booking.booking_times;
            
            // Оформляем статус
            let statusHtml = '';
            let confirmBtn = '';
            
            if (booking.status === 'pending') {
                statusHtml = '<span style="color: #f39c12; font-weight: bold;">Ожидает</span>';
                confirmBtn = `<button class="action-btn btn-confirm" onclick="updateStatus('${booking.id}', 'confirmed')" title="Подтвердить бронь">✓</button>`;
            } else {
                statusHtml = '<span style="color: #27ae60; font-weight: bold;">Подтверждено</span>';
            }

            // Формируем строчку таблицы
            tr.innerHTML = `
                <td><strong>${booking.booking_date}</strong><br><span style="color: #666; font-size: 0.9em;">${timeStr}</span></td>
                <td><strong>${booking.hall_name}</strong><br><span style="color: #666; font-size: 0.9em;">${booking.total_price} ₽</span></td>
                <td>${booking.client_name}</td>
                <td>${booking.client_phone}<br><span style="color: #d880a6; font-size: 0.9em;">${booking.client_tg}</span></td>
                <td>${statusHtml}</td>
                <td>
                    ${confirmBtn}
                    <button class="action-btn btn-delete" onclick="deleteBooking('${booking.id}')" title="Удалить бронь">✕</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
});

// --- ФУНКЦИИ УПРАВЛЕНИЯ БРОНЯМИ ---

// Подтверждение брони
window.updateStatus = async function(id, newStatus) {
    if (confirm('Подтвердить это бронирование?')) {
        const { error } = await supabaseClient
            .from('booking')
            .update({ status: newStatus })
            .eq('id', id);
            
        if (error) alert('Ошибка при обновлении: ' + error.message);
        else location.reload(); // Обновляем страницу, чтобы увидеть изменения
    }
};

// Удаление брони
window.deleteBooking = async function(id) {
    if (confirm('Вы уверены, что хотите безвозвратно удалить это бронирование?')) {
        const { error } = await supabaseClient
            .from('booking')
            .delete()
            .eq('id', id);
            
        if (error) alert('Ошибка при удалении: ' + error.message);
        else location.reload();
    }
};