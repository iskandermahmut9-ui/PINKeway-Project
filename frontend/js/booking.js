// frontend/js/booking.js

let bookingData = {
    hallId: null,
    hallName: null,
    basePrice: 0,
    totalPrice: 0,
    date: null,
    selectedTimes: [], // Теперь это массив для нескольких часов
    clientName: null,
    clientPhone: null,
    clientTg: null
};

// --- ИНИЦИАЛИЗАЦИЯ (ПЕРЕХВАТ ССЫЛКИ) ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedHall = urlParams.get('hall');

    if (preselectedHall) {
        // Ищем карточку с этим залом
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
    
    // НОВАЯ СТРОЧКА: Подставляем имя зала в плашку на втором шаге
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

// Переменная для отслеживания текущего открытого месяца в календаре
let currentNavMonth = new Date();
currentNavMonth.setDate(1); // Ставим 1 число, чтобы не перепрыгнуть через короткие месяцы

// Функция для кнопок "Вперед/Назад" по месяцам
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
    
    // Обновляем заголовок (например: "Ноябрь 2023")
    monthLabel.textContent = `${months[month]} ${year}`;

    // Настоящие Сегодня и Завтра для проверок
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Блокируем кнопку "Назад", если мы смотрим текущий месяц (чтобы не бронировали в прошлом)
    if (year === today.getFullYear() && month === today.getMonth()) {
        prevBtn.disabled = true;
    } else {
        prevBtn.disabled = false;
    }

    // Узнаем, сколько дней в выбранном месяце
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Генерируем карточки дней
    for (let i = 1; i <= daysInMonth; i++) {
        let d = new Date(year, month, i);
        
        // Пропускаем дни, которые уже прошли
        if (d < today) continue;
        
        // Формируем правильную строку даты (YYYY-MM-DD)
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const fullDateString = `${yyyy}-${mm}-${dd}`;
        
        let dayName = daysOfWeek[d.getDay()];
        if (d.getTime() === today.getTime()) dayName = 'Сегодня';
        else if (d.getTime() === tomorrow.getTime()) dayName = 'Завтра';

        const dateCard = document.createElement('div');
        dateCard.className = 'date-card';
        
        // Выделяем день, если он был выбран, или выделяем "Сегодня" по умолчанию
        if (bookingData.date === fullDateString) {
            dateCard.classList.add('active');
        } else if (!bookingData.date && d.getTime() === today.getTime()) {
            dateCard.classList.add('active');
            bookingData.date = fullDateString;
        }

        dateCard.innerHTML = `<div class="day-name">${dayName}</div><div class="day-number">${i}</div>`;

        // Обработка клика по дате
        dateCard.addEventListener('click', () => {
            document.querySelectorAll('.date-card').forEach(el => el.classList.remove('active'));
            dateCard.classList.add('active');
            bookingData.date = fullDateString;
            
            // При смене даты сбрасываем выбранное время
            bookingData.selectedTimes = [];
            document.getElementById('btn-to-step-3').disabled = true;
            generateTimeSlots();
        });

        slider.appendChild(dateCard);
    }
    
    // Генерируем время для выбранной даты
    generateTimeSlots();
}

async function generateTimeSlots() {
    const grid = document.getElementById('timeGrid');
    
    // Показываем загрузку, пока ждем ответ от базы
    grid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #666; padding: 20px;">Проверяем свободное время...</div>';
    
    const startHour = 9;
    const endHour = 20;
    let occupiedSlots = [];

    // 1. Берем текущие зал и дату
    // ВАЖНО: Убедитесь, что в вашем коде переменные называются именно так
    const currentHall = bookingData.hallName; 
    const currentDate = bookingData.bookingDate; 

    // --- ЗАПРОС К БАЗЕ ДАННЫХ ---
    if (currentHall && currentDate) {
        try {
            const { data, error } = await supabaseClient
                .from('booking')
                .select('booking_times')
                .eq('hall_name', currentHall)
                .eq('booking_date', currentDate)
                .eq('is_confirmed', true); // Ищем только подтвержденные!

            if (error) {
                console.error('Ошибка при загрузке слотов:', error);
            }

            if (data) {
                data.forEach(booking => {
                    let times = booking.booking_times;
                    // Распаковываем часы, если они в виде строки
                    if (typeof times === 'string') {
                        try { times = JSON.parse(times); } catch (e) { times = [times]; }
                    }
                    if (Array.isArray(times)) {
                        occupiedSlots.push(...times);
                    }
                });
            }
        } catch (err) {
            console.error('Критическая ошибка:', err);
        }
    }

    // --- БЛОКИРОВКА ПРОШЕДШЕГО ВРЕМЕНИ ДЛЯ СЕГОДНЯ ---
    const now = new Date();
    // Форматируем сегодняшнюю дату строго как в базе (YYYY-MM-DD)
    const todayFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHour = now.getHours();

    if (currentDate === todayFormatted) {
        for (let h = startHour; h <= endHour; h++) {
            if (h <= currentHour) {
                const pastTime = `${h}:00`;
                if (!occupiedSlots.includes(pastTime)) {
                    occupiedSlots.push(pastTime);
                }
            }
        }
    }

    // --- ОТРИСОВКА КНОПОК ---
    grid.innerHTML = '';
    
    for (let h = startHour; h <= endHour; h++) {
        const timeStr = `${h}:00`;
        const btn = document.createElement('button');
        
        btn.type = 'button'; 
        btn.className = 'time-btn';
        btn.textContent = timeStr;

        // ПРОВЕРКА: Если время есть в списке занятых - блокируем
        if (occupiedSlots.includes(timeStr)) {
            btn.disabled = true;
            btn.title = 'Это время уже забронировано';
        } else {
            // Если свободно - разрешаем кликать (убедитесь, что у вас есть функция toggleTimeSlot)
            btn.onclick = () => toggleTimeSlot(timeStr, btn); 
        }

        // Если клиент уже выбрал это время до перелистывания дат - оставляем его активным
        if (bookingData.bookingTimes && bookingData.bookingTimes.includes(timeStr)) {
            btn.classList.add('active');
        }

        grid.appendChild(btn);
    }
    // --- КОНЕЦ НОВОГО БЛОКА ---

    // 👇 ДАЛЬШЕ ОСТАВЛЯЕТЕ ВАШ КОД БЕЗ ИЗМЕНЕНИЙ 👇
    // (тут у вас должен идти цикл for, который рисует кнопки и проверяет occupiedSlots.includes(...))

    for (let i = startHour; i <= endHour; i++) {
        const timeString = `${i}:00`;
        const btn = document.createElement('button');
        btn.className = 'time-btn';
        btn.textContent = timeString;

        if (occupiedSlots.includes(timeString)) {
            btn.disabled = true;
        } else {
            btn.addEventListener('click', () => {
                // Логика мультивыбора
                if (bookingData.selectedTimes.includes(timeString)) {
                    // Если уже выбрано - убираем
                    bookingData.selectedTimes = bookingData.selectedTimes.filter(t => t !== timeString);
                    btn.classList.remove('active');
                } else {
                    // Если не выбрано - добавляем
                    bookingData.selectedTimes.push(timeString);
                    btn.classList.add('active');
                }
                
                // Сортируем время по порядку (чтобы в чеке было 10:00, 11:00)
                bookingData.selectedTimes.sort();

                // Если выбрано хотя бы 1 время - включаем кнопку
                document.getElementById('btn-to-step-3').disabled = bookingData.selectedTimes.length === 0;
            });
        }
        grid.appendChild(btn);
    }
}

// --- ШАГ 3: ФИНАЛИЗАЦИЯ ---
function updateSummaryBox() {
    const summary = document.getElementById('bookingSummary');
    const dateObj = new Date(bookingData.date);
    const niceDate = `${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
    
    // Считаем итоговую цену: базовая цена зала * количество выбранных часов
    bookingData.totalPrice = bookingData.basePrice * bookingData.selectedTimes.length;
    
    // Красиво выводим выбранные часы через запятую
    const timeStr = bookingData.selectedTimes.join(', ');

    summary.innerHTML = `
        <strong>Зал:</strong> ${bookingData.hallName}<br>
        <strong>Дата:</strong> ${niceDate}<br>
        <strong>Время:</strong> ${timeStr}<br>
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 10px 0;">
        <strong>К оплате:</strong> ${bookingData.totalPrice} ₽ (${bookingData.selectedTimes.length} ч.)
    `;
}

// --- ШАГ 3: ФИНАЛИЗАЦИЯ И ОТПРАВКА В БАЗУ ---
async function submitBooking() {
    const name = document.getElementById('clientName').value;
    const phone = document.getElementById('clientPhone').value;
    const tg = document.getElementById('clientTg').value || 'Не указан';
    
    if (!name || !phone) {
        alert('Пожалуйста, введите имя и телефон');
        return;
    }

    // НОВАЯ ПРОВЕРКА: Считаем количество цифр в телефоне
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
        alert('Пожалуйста, введите корректный номер телефона (не менее 10 цифр).');
        return;
    }

    // --- ВОТ ЗДЕСЬ ИСПРАВЛЕНИЕ ---
    bookingData.clientName = name;
    bookingData.clientPhone = phone; // <-- Вернули телефон на место!
    bookingData.clientTg = tg;
    // -----------------------------

    const finishBtn = document.getElementById('btn-finish');
    finishBtn.textContent = 'Оформляем...';
    finishBtn.disabled = true;

   try {
        // ПРАВКА: Теперь тут написано supabaseClient вместо supabase
        const { data, error } = await supabaseClient
            .from('booking')
            .insert([
                {
                    hall_id: bookingData.hallId,
                    hall_name: bookingData.hallName,
                    booking_date: bookingData.date,
                    booking_times: bookingData.selectedTimes,
                    total_price: bookingData.totalPrice,
                    client_name: bookingData.clientName,
                    client_phone: bookingData.clientPhone,
                    client_tg: bookingData.clientTg
                }
            ]);

        // Если база вернула ошибку, переходим в блок catch
        if (error) throw error;

        // Если всё успешно:
        alert(`Успешно! ${bookingData.hallName} забронирован на ${bookingData.selectedTimes.length} ч.\nСумма: ${bookingData.totalPrice} ₽.\nМы свяжемся с вами в ближайшее время!`);
        window.location.href = 'index.html'; // Возвращаем на главную

    } catch (error) {
        console.error("Ошибка при отправке в базу:", error);
        alert('Произошла ошибка при бронировании. Пожалуйста, проверьте подключение к интернету или свяжитесь с нами по телефону.');
        
        // Возвращаем кнопку в исходное состояние, чтобы клиент мог попробовать еще раз
        finishBtn.textContent = 'Подтвердить';
        finishBtn.disabled = false;
    }
    // --- НАЧАЛО БЛОКА БЛОКИРОВКИ ПРОШЕДШЕГО ВРЕМЕНИ ---
    const now = new Date();
    // Формируем сегодняшнюю дату в формате YYYY-MM-DD (как в базе)
    const todayFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHour = now.getHours();

    // Если клиент выбрал СЕГОДНЯ, проверяем часы
    if (currentDate === todayFormatted) {
        for (let h = startHour; h <= endHour; h++) {
            // Если час уже прошел (или идет прямо сейчас) - блокируем его
            if (h <= currentHour) {
                const pastTime = `${h}:00`;
                if (!occupiedSlots.includes(pastTime)) {
                    occupiedSlots.push(pastTime);
                }
            }
        }
    }
    // --- КОНЕЦ БЛОКА ---
}
// --- СВАЙП ДЛЯ КАЛЕНДАРЯ МЫШКОЙ (DRAG-TO-SCROLL) ---
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
    e.preventDefault(); // Останавливаем выделение текста
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 2; // Умножаем на 2 для скорости прокрутки
    slider.scrollLeft = scrollLeft - walk;
});
// --- УМНАЯ МАСКА ДЛЯ ТЕЛЕФОНА ---
document.getElementById('clientPhone').addEventListener('input', function (e) {
    let input = e.target.value.replace(/\D/g, ''); // Очищаем от всего, кроме цифр
    let formatted = '';

    // Если начинается с 7 или 8 (Россия)
    if (['7', '8'].indexOf(input[0]) > -1) {
        let firstDigit = (input[0] === '8') ? '8' : '+7';
        formatted = firstDigit + ' ';
        if (input.length > 1) formatted += '(' + input.substring(1, 4);
        if (input.length >= 5) formatted += ') ' + input.substring(4, 7);
        if (input.length >= 8) formatted += '-' + input.substring(7, 9);
        if (input.length >= 10) formatted += '-' + input.substring(9, 11);
    } else if (input.length > 0) {
        // Если другая страна, просто ставим плюс
        formatted = '+' + input;
    }
    e.target.value = formatted;
});