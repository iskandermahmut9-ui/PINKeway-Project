import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
import os
import time
import threading
from supabase import create_client, Client
from flask import Flask

# Загружаем ключи (на компьютере из .env, на сервере из настроек)
from dotenv import load_dotenv
load_dotenv()

TOKEN = os.getenv("TELEGRAM_TOKEN")
ADMIN_ID = os.getenv("ADMIN_ID")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

bot = telebot.TeleBot(TOKEN)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- WEB СЕРВЕР ДЛЯ RENDER И UPTIMEROBOT ---
app = Flask(__name__)

@app.route('/')
def home():
    return "Бот PINKeway работает и не спит! 🚀"

# --- ЛОГИКА БОТА ---
@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = InlineKeyboardMarkup()
    webapp_btn = InlineKeyboardButton(
        text="🗓 Открыть календарь", 
        web_app=telebot.types.WebAppInfo(url="https://iskandermahmut9-ui.github.io/PINKeway-Project/frontend/")
    )
    markup.add(webapp_btn)
    bot.send_message(message.chat.id, "🎀 Добро пожаловать!\n\nНажмите кнопку ниже, чтобы забронировать зал:", reply_markup=markup)

def check_new_bookings():
    while True:
        try:
            response = supabase.table("booking").select("*").eq("is_notified", False).execute()
            for b in response.data:
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
                bot.send_message(ADMIN_ID, text, parse_mode="Markdown")
                supabase.table("booking").update({"is_notified": True}).eq("id", b["id"]).execute()
        except Exception as e:
            print("Ошибка БД:", e)
        time.sleep(10)

def run_bot():
    bot.infinity_polling()

if __name__ == '__main__':
    # Запускаем проверку базы и самого бота в фоновых потоках
    threading.Thread(target=check_new_bookings, daemon=True).start()
    threading.Thread(target=run_bot, daemon=True).start()
    
    # Запускаем веб-сервер (обязательно для Render)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)