import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
import os
import time
import threading
import requests
from flask import Flask

# Загружаем ключи
from dotenv import load_dotenv
load_dotenv()

TOKEN = os.getenv("TELEGRAM_TOKEN")
ADMIN_ID = os.getenv("ADMIN_ID")
# Убираем случайный слэш на конце ссылки, если он есть
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip('/')
SUPABASE_KEY = os.getenv("SUPABASE_KEY") 

bot = telebot.TeleBot(TOKEN)
app = Flask(__name__)

@app.route('/')
def home():
    return "Бот PINKeway работает и не спит! 🚀"

@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = InlineKeyboardMarkup()
    webapp_btn = InlineKeyboardButton(
        text="🗓 Открыть календарь", 
        web_app=telebot.types.WebAppInfo(url="https://pinkeway.ru/booking.html")
    )
    markup.add(webapp_btn)
    bot.send_message(message.chat.id, "🎀 Добро пожаловать!\n\nНажмите кнопку ниже, чтобы забронировать зал:", reply_markup=markup)

def check_new_bookings():
    # Наш VIP-пропуск для базы данных
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    while True:
        try:
            # 1. Спрашиваем у базы напрямую: есть ли брони без галочки?
            get_url = f"{SUPABASE_URL}/rest/v1/booking?is_notified=eq.false&select=*"
            response = requests.get(get_url, headers=headers)
            
            if response.status_code == 200:
                bookings = response.json()
                
                for b in bookings:
                    # ПРЕОБРАЗУЕМ ДАТУ: из 2026-05-02 в 02.05.2026
                    raw_date = b['booking_date']
                    date_obj = datetime.datetime.strptime(raw_date, '%Y-%m-%d')
                    formatted_date = date_obj.strftime('%d.%m.%Y')

                    times_str = ", ".join(b['booking_times']) if isinstance(b['booking_times'], list) else b['booking_times']
                    
                    text = (
                        f"🔔 <b>НОВАЯ БРОНЬ!</b>\n\n"
                        f"📍 Зал: {b['hall_name']}\n"
                        f"👤 Клиент: {b['client_name']}\n"
                        f"📞 Телефон: <code>{b['client_phone']}</code>\n"
                        f"✈️ Telegram: {b['client_tg']}\n"
                        f"📅 Дата: {formatted_date}\n"  # Теперь здесь будет 02.05.2026
                        f"🕒 Время: {times_str}\n"
                        f"💰 Сумма: {b['total_price']} ₽\n"
                    )
                    
                    # Отправляем сообщение (МЕНЯЕМ Markdown на HTML)
                    bot.send_message(ADMIN_ID, text, parse_mode="HTML")
                    
                    # 2. Ставим галочку в базе
                    patch_url = f"{SUPABASE_URL}/rest/v1/booking?id=eq.{b['id']}"
                    requests.patch(patch_url, headers=headers, json={"is_notified": True})
                    
        except Exception as e:
            print("Ошибка при запросе к БД:", e)
            
        time.sleep(10)

def run_bot():
    try:
        bot.infinity_polling()
    except Exception as e:
        print("Ошибка запуска бота:", e)

# --- ЗАПУСК ПОТОКОВ ---
print("🤖 Запускаем фоновые потоки...")
threading.Thread(target=check_new_bookings, daemon=True).start()
threading.Thread(target=run_bot, daemon=True).start()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)