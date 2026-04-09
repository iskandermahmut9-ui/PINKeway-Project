// frontend/js/booking.js

let bookingData = {
    hallId: null,
    hallName: null,
    basePrice: 0,
    totalPrice: 0,
    date: null,
    selectedTimes: [], 
    clientName: null,
    clientPhone: null,
    clientTg: null
};

// --- ИНИЦИАЛИЗАЦИЯ (ПЕРЕХВАТ ССЫЛКИ) ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedHall = urlParams.get('hall');

    if (preselectedHall) {
        const hallItem = document.querySelector(`.hall-item[data-hall="${preselectedHall}"]`);
        if (hallItem) {
            selectHall(hallItem);
        }
    }
});

// --- НАВИГАЦИЯ ---
function goToStep(stepNumber) {
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    for(let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (i < stepNumber) dot.className = 'step-dot completed';
        else if (i === stepNumber) dot.className = 'step-dot active';
        else dot.className = 'step-dot';
    }
    document.getElementById(`step-${stepNumber}`).classList.add('active');
    if (stepNumber === 3) updateSummaryBox();
}

// --- ШАГ 1: ВЫБОР ЗАЛА ---
function selectHall(element) {
    bookingData.hallId = element.dataset.hall;
    bookingData.hallName = element.dataset.name;
    bookingData.basePrice = parseInt(element.dataset.price);
    
    document.getElementById('selectedHallDisplay').innerHTML = `Зал: <strong>${bookingData.hallName}</strong>`;
    
    goToStep(2);
    if (!bookingData.date) generateDates();
}

document.querySelectorAll('.hall-item').forEach(item => {
    item.addEventListener('click', function() { selectHall(this); });
});

// --- ШАГ 2: ДАТЫ И ВРЕМЯ ---
const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

let currentNavMonth = new Date();
currentNavMonth.setDate(1); 

function changeMonth(offset) {
    currentNavMonth.setMonth(currentNavMonth.getMonth() + offset);
    generateDates();
}

function generateDates() {
    const slider = document.getElementById('dateSlider');
    const monthLabel = document.getElementById('currentMonthLabel');
    const prevBtn = document.getElementById('prevMonthBtn');
    
    slider.innerHTML = ''; 
    
    const year = currentNavMonth.getFullYear();
    const month = currentNavMonth.getMonth();
    
    monthLabel.textContent = `${months[month]} ${year}`;

    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (year === today.getFullYear() && month === today.getMonth()) {
        prevBtn.disabled = true;
    } else {
        prevBtn.disabled = false;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
        let d = new Date(year, month, i);
        
        if (d < today) continue;
        
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const fullDateString = `${yyyy}-${mm}-${dd}`;
        
        let dayName = daysOfWeek[d.getDay()];
        if (d.getTime() === today.getTime()) dayName = 'Сегодня';
        else if (d.getTime() === tomorrow.getTime()) dayName = 'Завтра';

        const dateCard = document.createElement('div');
        dateCard.className = 'date-card';
        
        if (bookingData.date === fullDateString) {
            dateCard.classList.add('active');
        } else if (!bookingData.date && d.getTime() === today.getTime()) {
            dateCard.classList.add('active');
            bookingData.date = fullDateString;
        }

        dateCard.innerHTML = `<div class="day-name">${dayName}</div><div class="day-number">${i}</div>`;

        dateCard.addEventListener('click', () => {
            document.querySelectorAll('.date-card').forEach(el => el.classList.remove('active'));
            dateCard.classList.add('active');
            bookingData.date = fullDateString;
            
            bookingData.selectedTimes = [];
            document.getElementById('btn-to-step-3').disabled = true;
            generateTimeSlots();
        });

        slider.appendChild(dateCard);
    }
    
    generateTimeSlots();
}

// --- ВОССТАНОВЛЕННАЯ ФУНКЦИЯ КЛИКА ПО ВРЕМЕНИ ---
function toggleTimeSlot(timeStr, btn) {
    const index = bookingData.selectedTimes.indexOf(timeStr);
    if (index > -1) {
        bookingData.selectedTimes.splice(index, 1);
        btn.classList.remove('active');
    } else {
        bookingData.selectedTimes.push(timeStr);
        btn.classList.add('active');
    }

    bookingData.selectedTimes.sort((a, b) => parseInt(a) - parseInt(b));
    document.getElementById('btn-to-step-3').disabled = bookingData.selectedTimes.length === 0;
}

// --- ИСПРАВЛЕННАЯ ГЕНЕРАЦИЯ СЛОТОВ (С УДЕРЖАНИЕМ 60 МИНУТ) ---
async function generateTimeSlots() {
    const grid = document.getElementById('timeGrid');
    grid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #666; padding: 20px;">Загружаем расписание...</div>';
    
    const startHour = 9;
    const endHour = 20;
    let occupiedSlots = [];

    const currentHall = bookingData.hallName; 
    const currentDate = bookingData.date; 

    if (currentHall && currentDate) {
        try {
            // Запрашиваем ВСЕ заявки (и paid, и pending), достаем время создания и статус
            const { data, error } = await supabaseClient
                .from('booking')
                .select('booking_times, status, is_confirmed, created_at')
                .eq('hall_name', currentHall)
                .eq('booking_date', currentDate);

            if (data && data.length > 0) {
                const now = new Date().getTime();

                data.forEach(booking => {
                    let isSlotOccupied = false;

                    // 1. Если оплачено или подтверждено админом — блокируем железно
                    if (booking.status === 'paid' || booking.is_confirmed === true) {
                        isSlotOccupied = true;
                    } 
                    // 2. Если 'pending' (ждет оплаты) — проверяем время
                    else if (booking.status === 'pending') {
                        const bookingTime = new Date(booking.created_at).getTime();
                        const diffInMinutes = (now - bookingTime) / (1000 * 60);
                        
                        // Если с момента создания прошло меньше 60 минут — блокируем
                        if (diffInMinutes <= 60) { // <--- ИЗМЕНИЛИ 10 НА 60 ЗДЕСЬ
                            isSlotOccupied = true;
                        }
                    }

                    // Если проверка пройдена, добавляем часы в список занятых
                    if (isSlotOccupied) {
                        let times = booking.booking_times;
                        if (typeof times === 'string') {
                            try { times = JSON.parse(times); } catch (e) { times = [times]; }
                        }
                        if (Array.isArray(times)) {
                            // 1. Сначала блокируем само время брони
                            occupiedSlots.push(...times);

                            // 2. АВТО-УБОРКА: Блокируем следующий час для водных залов
                            if (currentHall === 'atlantis' || currentHall === 'aqualia' || currentHall === 'Атлантис' || currentHall === 'Аквалия') {
                                let maxHour = 0;
                                times.forEach(t => {
                                    let h = parseInt(t.split(':')[0]);
                                    if (h > maxHour) maxHour = h;
                                });
                                
                                let cleaningHour = maxHour + 1;
                                
                                // Блокируем следующий час, если студия еще работает (до 20:00)
                                if (cleaningHour <= 20) { 
                                    occupiedSlots.push(`${cleaningHour}:00`);
                                }
                            }
                        }
                    }
                });
            }
        } catch (err) {
            console.error('Ошибка загрузки расписания:', err);
        }
    }

    // Блокируем прошедшие часы для сегодняшнего дня
    const now = new Date();
    const todayFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHour = now.getHours();

    if (currentDate === todayFormatted) {
        for (let h = startHour; h <= endHour; h++) {
            if (h <= currentHour) {
                const pastTime = `${h}:00`;
                if (!occupiedSlots.includes(pastTime)) occupiedSlots.push(pastTime);
            }
        }
    }

    grid.innerHTML = ''; 
    
    // Отрисовываем кнопки
    for (let h = startHour; h <= endHour; h++) {
        const timeStr = `${h}:00`;
        const btn = document.createElement('button');
        
        btn.type = 'button'; 
        btn.className = 'time-btn';
        btn.textContent = timeStr;

        if (occupiedSlots.includes(timeStr)) {
            btn.disabled = true;
            btn.title = 'Это время занято или прямо сейчас оплачивается';
            btn.style.backgroundColor = '#f0f0f0';
            btn.style.color = '#aaa';
            btn.style.textDecoration = 'line-through';
            btn.style.borderColor = '#eee';
        } else {
            btn.onclick = () => toggleTimeSlot(timeStr, btn); 
        }

        if (bookingData.selectedTimes && bookingData.selectedTimes.includes(timeStr)) {
            btn.classList.add('active');
        }

        grid.appendChild(btn);
    }
}

// --- ШАГ 3: ФИНАЛИЗАЦИЯ ---
function updateSummaryBox() {
    const summary = document.getElementById('bookingSummary');
    const dateObj = new Date(bookingData.date);
    const niceDate = `${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
    
    bookingData.totalPrice = bookingData.basePrice * bookingData.selectedTimes.length;
    const timeStr = bookingData.selectedTimes.join(', ');

    summary.innerHTML = `
        <strong>Зал:</strong> ${bookingData.hallName}<br>
        <strong>Дата:</strong> ${niceDate}<br>
        <strong>Время:</strong> ${timeStr}<br>
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 10px 0;">
        <strong>К оплате:</strong> ${bookingData.totalPrice} ₽ (${bookingData.selectedTimes.length} ч.)
    `;
}

// --- ОТПРАВКА В БАЗУ ---
// --- ОТПРАВКА В БАЗУ И ПЕРЕХОД К ОПЛАТЕ ---
async function submitBooking() {
    const name = document.getElementById('clientName').value;
    const phone = document.getElementById('clientPhone').value;
    const tg = document.getElementById('clientTg').value || 'Не указан';
    
    if (!name || !phone) {
        alert('Пожалуйста, введите имя и телефон');
        return;
    }

    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
        alert('Пожалуйста, введите корректный номер телефона (не менее 10 цифр).');
        return;
    }

    // Проверка галочки согласия (если она у вас стоит)
    const legalCheckbox = document.getElementById('legalCheckbox');
    if (legalCheckbox && !legalCheckbox.checked) {
        alert('Для бронирования необходимо дать согласие на обработку персональных данных и принять условия оферты.');
        return;
    }

    bookingData.clientName = name;
    bookingData.clientPhone = phone;
    bookingData.clientTg = tg;

    const finishBtn = document.getElementById('btn-finish');
    finishBtn.textContent = 'Создаем счет...';
    finishBtn.disabled = true;

    try {
        // 1. Сохраняем бронь в Supabase со статусом 'pending'
        const { data, error } = await supabaseClient
            .from('booking')
            .insert([{
                hall_id: bookingData.hallId,
                hall_name: bookingData.hallName,
                booking_date: bookingData.date,
                booking_times: bookingData.selectedTimes,
                total_price: bookingData.totalPrice,
                client_name: bookingData.clientName,
                client_phone: bookingData.clientPhone,
                client_tg: bookingData.clientTg,
                status: 'pending' // Устанавливаем статус ожидания оплаты
            }])
            .select(); // Обязательно запрашиваем ответ, чтобы получить ID

        if (error) throw error;

        // Получаем ID только что созданной заявки
        const newBookingId = data[0].id;

       // 2. Стучимся в Make.com за ссылкой на оплату
        const makeWebhookUrl = 'https://hook.eu1.make.com/elmko2plh4pxeksxwa88fx39ne2jxv4c';
        
        // Очищаем телефон: оставляем только цифры (было +7 (915)... станет 7915...)
        const cleanPhone = bookingData.clientPhone.replace(/\D/g, '');

        const response = await fetch(makeWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                booking_id: newBookingId,
                amount: bookingData.totalPrice,
                description: `Бронирование: ${bookingData.hallName}`,
                client_name: bookingData.clientName,
                client_phone: cleanPhone // Отправляем уже чистые цифры
            })
        });

        // 3. Читаем ответ
        if (response.ok) {
            const result = await response.json(); // Теперь это сработает, когда Make ответит правильно
            
            // Важно: в модуле Response мы написали pay_url
            if (result && result.pay_url) {
                // СОХРАНЯЕМ ДАННЫЕ ДЛЯ СТРАНИЦЫ УСПЕХА
                localStorage.setItem('lastBooking', JSON.stringify({
                    hall: bookingData.hallName,
                    date: bookingData.date,
                    time: bookingData.selectedTimes.join(', ')
                }));
                // ПЕРЕНАПРАВЛЯЕМ КЛИЕНТА НА КАССУ
                window.location.href = result.pay_url;
            } else {
                console.warn("Make ответил, но ссылки нет:", result);
                alert('Бронь создана, но не удалось получить ссылку на оплату. Мы свяжемся с вами!');
                window.location.href = 'index.html';
            }
        } else {
            const text = await response.text();
            console.error("Сервер Make ответил ошибкой:", text);
            alert('Ошибка при создании счета. Попробуйте еще раз или свяжитесь с нами.');
        }

    } catch (error) {
        console.error("Критическая ошибка:", error);
        alert('Произошла ошибка. Пожалуйста, проверьте интернет.');
        const finishBtn = document.getElementById('btn-finish');
        finishBtn.textContent = 'Подтвердить';
        finishBtn.disabled = false;
    }
}
// --- СВАЙП ДЛЯ КАЛЕНДАРЯ ---
const slider = document.getElementById('dateSlider');
let isDown = false;
let startX;
let scrollLeft;

slider.addEventListener('mousedown', (e) => {
    isDown = true;
    slider.style.cursor = 'grabbing';
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
});

slider.addEventListener('mouseleave', () => {
    isDown = false;
    slider.style.cursor = 'grab';
});

slider.addEventListener('mouseup', () => {
    isDown = false;
    slider.style.cursor = 'grab';
});

slider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault(); 
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 2; 
    slider.scrollLeft = scrollLeft - walk;
});

// --- УМНАЯ МАСКА ДЛЯ ТЕЛЕФОНА ---
document.getElementById('clientPhone').addEventListener('input', function (e) {
    let input = e.target.value.replace(/\D/g, ''); 
    let formatted = '';

    if (['7', '8'].indexOf(input[0]) > -1) {
        let firstDigit = (input[0] === '8') ? '8' : '+7';
        formatted = firstDigit + ' ';
        if (input.length > 1) formatted += '(' + input.substring(1, 4);
        if (input.length >= 5) formatted += ') ' + input.substring(4, 7);
        if (input.length >= 8) formatted += '-' + input.substring(7, 9);
        if (input.length >= 10) formatted += '-' + input.substring(9, 11);
    } else if (input.length > 0) {
        formatted = '+' + input;
    }
    e.target.value = formatted;
});