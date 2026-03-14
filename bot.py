import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
import os
from dotenv import load_dotenv
import time
import threading
from supabase import create_client, Client

# Загружаем ключи из нашего сейфа .env
load_dotenv()

TOKEN = os.getenv("TELEGRAM_TOKEN")
ADMIN_ID = os.getenv("ADMIN_ID")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Подключаем бота и базу данных
bot = telebot.TeleBot(TOKEN)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Команда /start (Кнопка для клиентов)
@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = InlineKeyboardMarkup()
    # Кнопка Web App (открывает сайт прямо внутри Telegram)
    webapp_btn = InlineKeyboardButton(
        text="🗓 Открыть календарь", 
        web_app=telebot.types.WebAppInfo(url="https://iskandermahmut9-ui.github.io/PINKeway-Project/frontend/")
    )
    markup.add(webapp_btn)
    bot.send_message(
        message.chat.id, 
        "🎀 Добро пожаловать в фотостудию PINKeway!\n\nНажмите кнопку ниже, чтобы выбрать зал и время:", 
        reply_markup=markup
    )

# Фоновая проверка новых броней
def check_new_bookings():
    while True:
        try:
            # Ищем брони, о которых мы еще не уведомляли (is_notified = False)
            response = supabase.table("booking").select("*").eq("is_notified", False).execute()
            bookings = response.data
            
            for b in bookings:
                # Собираем красивое сообщение (как на вашем скриншоте)
                times_str = ", ".join(b['booking_times']) if isinstance(b['booking_times'], list) else b['booking_times']
                
                text = (
                    f"🔔 *НОВАЯ БРОНЬ!*\n\n"
                    f"📍 Зал: {b['hall_name']}\n"
                    f"👤 Клиент: {b['client_name']}\n"
                    f"📞 Телефон: `{b['client_phone']}`\n"
                    f"✈️ Telegram: {b['client_tg']}\n"
                    f"📅 Дата: {b['booking_date']}\n"
                    f"🕒 Время: {times_str}\n"
                    f"💰 Сумма: {b['total_price']} ₽\n"
                )
                
                # Отправляем сообщение администратору
                bot.send_message(ADMIN_ID, text, parse_mode="Markdown")
                
                # Ставим галочку в базе, что уведомление отправлено
                supabase.table("booking").update({"is_notified": True}).eq("id", b["id"]).execute()
        except Exception as e:
            print("Ошибка при проверке базы:", e)
        
        # Ждем 10 секунд перед следующей проверкой
        time.sleep(10)

if __name__ == '__main__':
    print("🤖 Бот запущен! Жду новые брони...")
    # Запускаем проверку базы в параллельном режиме
    threading.Thread(target=check_new_bookings, daemon=True).start()
    # Включаем бота
    bot.infinity_polling()