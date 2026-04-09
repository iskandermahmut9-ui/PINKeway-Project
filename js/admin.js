// frontend/js/admin.js

document.addEventListener('DOMContentLoaded', async () => {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginBtn = document.getElementById('loginBtn');
    const errorText = document.getElementById('loginError');
    const tbody = document.getElementById('bookingsTableBody');

    // Переменные для календаря
    let adminNavDate = new Date();
    let adminSelectedDateStr = formatDate(new Date()); 
    const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) { showDashboard(); }

    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        loginBtn.textContent = 'Вход...';
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            errorText.style.display = 'block';
            loginBtn.textContent = 'Войти';
        } else {
            errorText.style.display = 'none';
            showDashboard();
        }
    });

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        location.reload(); 
    });

    function showDashboard() {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        logoutBtn.style.display = 'inline-block';
        
        loadBookingsTable();
        initAdminCalendar(); 
    }

    // --- ЛОГИКА КАЛЕНДАРЯ АДМИНА ---
    
    function formatDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function initAdminCalendar() {
        document.getElementById('adminHallSelect').addEventListener('change', renderAdminTimes);
        
        document.getElementById('adminPrevMonth').addEventListener('click', () => {
            adminNavDate.setMonth(adminNavDate.getMonth() - 1);
            renderAdminDates();
        });
        
        document.getElementById('adminNextMonth').addEventListener('click', () => {
            adminNavDate.setMonth(adminNavDate.getMonth() + 1);
            renderAdminDates();
        });
        
        renderAdminDates();
    }

    function renderAdminDates() {
        const label = document.getElementById('adminMonthLabel');
        label.textContent = `${months[adminNavDate.getMonth()]} ${adminNavDate.getFullYear()}`;
        
        const slider = document.getElementById('adminDateSlider');
        slider.innerHTML = '';
        
        const year = adminNavDate.getFullYear();
        const month = adminNavDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(year, month, i);
            const dateStr = formatDate(dateObj);
            
            const card = document.createElement('div');
            card.className = `date-card ${dateStr === adminSelectedDateStr ? 'active' : ''}`;
            card.innerHTML = `
                <div class="day-name">${daysOfWeek[dateObj.getDay()]}</div>
                <div class="day-number">${i}</div>
            `;
            
            card.addEventListener('click', () => {
                adminSelectedDateStr = dateStr;
                renderAdminDates(); 
            });
            
            slider.appendChild(card);
        }
        renderAdminTimes(); 
    }

    async function renderAdminTimes() {
        const grid = document.getElementById('adminTimeGrid');
        grid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #666;">Загрузка расписания...</div>';
        
        const selectedHall = document.getElementById('adminHallSelect').value;
        
        const { data, error } = await supabaseClient
            .from('booking')
            .select('id, booking_times, is_confirmed')
            .eq('hall_name', selectedHall)
            .eq('booking_date', adminSelectedDateStr);

        let bookedSlots = {}; 

        if (data) {
            data.forEach(booking => {
                let times = booking.booking_times;
                if (typeof times === 'string') {
                    try { times = JSON.parse(times); } catch (e) { times = [times]; }
                }
                if (Array.isArray(times)) {
                    times.forEach(t => {
                        bookedSlots[t] = {
                            is_confirmed: booking.is_confirmed,
                            id: booking.id
                        };
                    });
                }
            });
        }

        grid.innerHTML = '';
        
        for (let h = 9; h <= 20; h++) {
            const timeStr = `${h}:00`;
            const btn = document.createElement('button');
            btn.textContent = timeStr;
            btn.className = 'time-btn ';

            if (bookedSlots[timeStr]) {
                const bookingInfo = bookedSlots[timeStr];
                
                if (bookingInfo.is_confirmed) {
                    btn.className += 'status-confirmed';
                    btn.title = 'Время занято';
                } else {
                    btn.className += 'status-pending';
                    btn.title = 'Нажмите, чтобы подтвердить эту бронь';
                    btn.onclick = () => confirmBooking(bookingInfo.id);
                }
            } else {
                btn.className += 'status-free';
                // НОВАЯ СТРОКА: При клике на свободное время открываем модалку
                btn.onclick = () => openAdminBookingModal(selectedHall, adminSelectedDateStr, timeStr);
            }
            
            grid.appendChild(btn);
        }
    }

    // --- ЛОГИКА ТАБЛИЦЫ ---
    async function loadBookingsTable() {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Загрузка данных...</td></tr>';

        const { data: bookings, error } = await supabaseClient
            .from('booking')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return;

        tbody.innerHTML = ''; 
        
        let totalRevenue = 0;
        let totalConfirmed = 0;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        let rowsToDisplay = [];

        bookings.forEach(b => {
            // ИЗМЕНЕНИЕ: Теперь смотрим на дату поступления денег, а не на дату аренды
            const bDate = new Date(b.created_at); 
            
            // Исключаем "ручные" уборки из статистики выручки
            let isManualCleaning = b.client_name && b.client_name.toLowerCase().includes('уборка');
            
            if (b.is_confirmed === true && bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear) {
                if (!isManualCleaning) {
                    totalRevenue += b.total_price;
                }
                totalConfirmed += 1;
            }

            rowsToDisplay.push({ ...b, isAutoCleaning: false });

            // АВТО-УБОРКА
            if ((b.hall_name === 'atlantis' || b.hall_name === 'aqualia' || b.hall_name === 'Атлантис' || b.hall_name === 'Аквалия') && 
                (b.status === 'paid' || b.is_confirmed === true) && !isManualCleaning) {
                
                let times = b.booking_times;
                if (typeof times === 'string') {
                    try { times = JSON.parse(times); } catch (e) { times = [times]; }
                }
                
                if (Array.isArray(times) && times.length > 0) {
                    let maxHour = 0;
                    times.forEach(t => {
                        let h = parseInt(t.split(':')[0]);
                        if (h > maxHour) maxHour = h;
                    });
                    
                    let cleaningHour = maxHour + 1;
                    
                    if (cleaningHour <= 20) {
                        rowsToDisplay.push({
                            id: 'cleaning_' + b.id, 
                            created_at: b.created_at,
                            booking_date: b.booking_date,
                            booking_times: [`${cleaningHour}:00`],
                            hall_name: b.hall_name,
                            client_name: 'Технический час',
                            client_phone: 'Уборка (Авто)',
                            client_tg: '',
                            total_price: 0,
                            status: 'paid',
                            is_confirmed: true,
                            isAutoCleaning: true 
                        });
                    }
                }
            }
        });

        rowsToDisplay.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        document.getElementById('monthlyRevenue').textContent = totalRevenue.toLocaleString('ru-RU') + ' ₽';
        document.getElementById('monthlyBookings').textContent = totalConfirmed;

        rowsToDisplay.forEach(booking => {
            const tr = document.createElement('tr');
            const timeStr = Array.isArray(booking.booking_times) ? booking.booking_times.join(', ') : booking.booking_times;
            
            const createdDate = new Date(booking.created_at);
            const createdStr = `${createdDate.toLocaleDateString('ru-RU')} <span style="color:#888; font-size:0.9em">${createdDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</span>`;
            
            let statusHtml = '';
            let confirmBtn = '';
            
            if (booking.isAutoCleaning) {
                tr.style.backgroundColor = '#fdf5f8'; 
                statusHtml = '<span style="color: #888; font-style: italic;">Заблокировано</span>';
                confirmBtn = `<span style="font-size: 0.8em; color: #aaa;">Авто</span>`;
            } else {
                if (booking.status === 'paid' || booking.is_confirmed === true) {
                    statusHtml = '<span style="color: #27ae60; font-weight: bold;">Подтверждено</span>';
                } else {
                    statusHtml = '<span style="color: #f39c12; font-weight: bold;">Ожидает</span>';
                    confirmBtn = `<button class="action-btn btn-confirm" onclick="confirmBooking('${booking.id}')" title="Подтвердить вручную">✓</button>`;
                }
                confirmBtn += `<button class="action-btn btn-delete" onclick="deleteBooking('${booking.id}')" title="Удалить бронь">✕</button>`;
            }

            if (booking.client_name && booking.client_name.toLowerCase().includes('уборка') && !booking.isAutoCleaning) {
                 tr.style.opacity = '0.6';
                 tr.style.backgroundColor = '#f4f4f9';
            }

            tr.innerHTML = `
                <td>${createdStr}</td> 
                <td><strong>${booking.booking_date}</strong><br><span style="color: #666; font-size: 0.9em;">${timeStr}</span></td>
                <td><strong>${booking.hall_name}</strong><br><span style="color: #666; font-size: 0.9em;">${booking.total_price} ₽</span></td>
                <td>${booking.client_name}</td>
                <td>${booking.client_phone}<br><span style="color: #d880a6; font-size: 0.9em;">${booking.client_tg}</span></td>
                <td>${statusHtml}</td>
                <td>${confirmBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}); // <-- Эта скобка была потеряна в прошлый раз!

// Глобальные функции
window.confirmBooking = async function(id) {
    if (confirm('Подтвердить это время? Оно закроется в календаре для всех клиентов.')) {
        const { error } = await supabaseClient
            .from('booking')
            .update({ 
                is_confirmed: true,
                status: 'paid' 
            }) 
            .eq('id', id);
            
        if (error) alert('Ошибка: ' + error.message);
        else location.reload(); 
    }
};

window.deleteBooking = async function(id) {
    if (confirm('Удалить эту бронь навсегда?')) {
        const { error } = await supabaseClient
            .from('booking')
            .delete()
            .eq('id', id);
            
        if (error) alert('Ошибка: ' + error.message);
        else location.reload();
    }
};

function initDragToScroll(sliderId) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => { isDown = false; });
    slider.addEventListener('mouseup', () => { isDown = false; });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; 
        slider.scrollLeft = scrollLeft - walk;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initDragToScroll('adminDateSlider');
    }, 500); 
});
// --- ЛОГИКА РУЧНОГО БРОНИРОВАНИЯ ИЗ АДМИНКИ ---

let manualBookingData = { hall: '', date: '', time: '' };

window.openAdminBookingModal = function(hall, date, time) {
    manualBookingData = { hall, date, time };
    document.getElementById('adminModalInfo').innerHTML = `Зал: <strong>${hall}</strong><br>Дата: <strong>${date}</strong><br>Время: <strong>${time}</strong>`;
    
    // Очищаем поля
    document.getElementById('adminNewClientName').value = '';
    document.getElementById('adminNewClientPhone').value = '';
    document.getElementById('adminNewPrice').value = '1700'; // По умолчанию стандарт
    
    document.getElementById('adminBookingModal').style.display = 'flex';
};

window.closeAdminBookingModal = function() {
    document.getElementById('adminBookingModal').style.display = 'none';
};

window.submitManualBooking = async function() {
    let name = document.getElementById('adminNewClientName').value || 'Без имени';
    const phone = document.getElementById('adminNewClientPhone').value || 'Не указан';
    const price = document.getElementById('adminNewPrice').value;

    // Если выбрана акция, автоматически дописываем это к имени
    if (price === '500') {
        name += ' (Акция 1+1)';
    }

    const bookingData = {
        hall_name: manualBookingData.hall,
        booking_date: manualBookingData.date,
        booking_times: JSON.stringify([manualBookingData.time]),
        client_name: name,
        client_phone: phone,
        client_tg: 'Ручная бронь',
        total_price: parseInt(price),
        status: 'pending', // Магия: ставим в ожидание, включится таймер 60 минут!
        is_confirmed: false
    };

    const { data, error } = await supabaseClient
        .from('booking')
        .insert([bookingData]);

    if (error) {
        alert('Ошибка при создании брони: ' + error.message);
    } else {
        closeAdminBookingModal();
        location.reload(); // Перезагружаем, чтобы обновить таблицу и календарь
    }
};