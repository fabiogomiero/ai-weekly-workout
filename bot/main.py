import json
import logging
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, ContextTypes
)

from config import (
    TELEGRAM_TOKEN, CHAT_ID, SUPABASE_URL, SUPABASE_KEY,
    ANTHROPIC_API_KEY, PLAN_JSON_PATH, RACE_DATE_STR
)
from schedule_logic import get_workouts_for_date, is_rest_day, get_week_context, load_plan
from claude_adapter import propose_adaptation

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

ROME = ZoneInfo("Europe/Rome")


def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def load_plan_data() -> dict:
    return load_plan(PLAN_JSON_PATH)


# ── EVENING CHECK (22:00) ──────────────────────────────────────────────────

async def evening_check(context: ContextTypes.DEFAULT_TYPE):
    """Invia il check serale per ogni workout di oggi."""
    plan = load_plan_data()
    today = datetime.now(tz=ROME).date()

    if is_rest_day(today, plan):
        logger.info("Oggi è giorno di riposo. Nessun check serale.")
        return

    workouts = get_workouts_for_date(today, plan)
    if not workouts:
        return

    try:
        sb = get_supabase()

        for workout in workouts:
            # Anti-doppio invio per questa (date, workout_key)
            existing = sb.table('workout_log').select('evening_check_sent').eq('date', today.isoformat()).eq('workout_key', workout['key']).execute()
            if existing.data and existing.data[0].get('evening_check_sent'):
                logger.info(f"Check serale già inviato per {today} / {workout['key']}")
                continue

            # Upsert: segna check inviato (status rimane NULL fino alla risposta)
            sb.table('workout_log').upsert(
                {'date': today.isoformat(), 'workout_key': workout['key'], 'evening_check_sent': True},
                on_conflict='date,workout_key'
            ).execute()

            keyboard = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("✅ Sì", callback_data=f"done:{today.isoformat()}:{workout['key']}"),
                    InlineKeyboardButton("❌ No", callback_data=f"no:{today.isoformat()}:{workout['key']}"),
                ]
            ])

            await context.bot.send_message(
                chat_id=CHAT_ID,
                text=f"🏃 Hai fatto l'allenamento di oggi?\n\n*{workout['title']}*",
                parse_mode='Markdown',
                reply_markup=keyboard,
            )
    except Exception as e:
        logger.error(f"Errore check serale: {e}")
        await context.bot.send_message(chat_id=CHAT_ID, text=f"⚠️ Errore check serale: {e}")


# ── MORNING CHECK (07:00) ──────────────────────────────────────────────────

async def morning_check(context: ContextTypes.DEFAULT_TYPE):
    """Controlla ieri e invia il workout di oggi."""
    plan = load_plan_data()
    today = datetime.now(tz=ROME).date()
    yesterday = today - timedelta(days=1)

    # Workout di oggi
    today_workouts = get_workouts_for_date(today, plan)
    if is_rest_day(today, plan):
        today_txt = "🛌 Oggi è giorno di riposo. Recupera bene!"
    else:
        today_txt = "💪 *Oggi:*\n" + '\n'.join(f"• {w['title']}" for w in today_workouts)

    # Controlla ieri
    if is_rest_day(yesterday, plan):
        # Nessun controllo per giorni di riposo
        await context.bot.send_message(chat_id=CHAT_ID, text=f"☀️ Buongiorno!\n\n{today_txt}", parse_mode='Markdown')
        return

    try:
        sb = get_supabase()
        yesterday_logs = sb.table('workout_log').select('workout_key,status,reason').eq('date', yesterday.isoformat()).execute()
        skipped = [r for r in (yesterday_logs.data or []) if r.get('status') == 'skipped']

        if not skipped:
            # Nessun workout saltato (o nessuna risposta = beneficio del dubbio)
            await context.bot.send_message(chat_id=CHAT_ID, text=f"☀️ Buongiorno!\n\n{today_txt}", parse_mode='Markdown')
            return

        # Workout saltati ieri → chiedi a Claude
        yesterday_workouts = get_workouts_for_date(yesterday, plan)
        week_ctx = get_week_context(today, plan) or {}

        skipped_with_detail = []
        for s in skipped:
            detail = next((w for w in yesterday_workouts if w['key'] == s['workout_key']), None)
            if detail:
                skipped_with_detail.append({
                    'tipo': detail['cls'].replace('b-', '').capitalize(),
                    'descrizione': detail['title'],
                    'reason': s.get('reason', 'no_time'),
                })

        if not skipped_with_detail:
            # Skipped keys no longer in plan (plan was updated) — treat as done
            await context.bot.send_message(chat_id=CHAT_ID, text=f"☀️ Buongiorno!\n\n{today_txt}", parse_mode='Markdown')
            return

        week_num = 0
        for i, w in enumerate(plan['weeks']):
            for d in w['days']:
                if d.get('isoDate') == today.isoformat():
                    week_num = i + 1
                    break

        claude_context = {
            'skipped_workouts': skipped_with_detail,
            'today_workouts': [{'tipo': w['cls'].replace('b-','').capitalize(), 'descrizione': w['title']} for w in today_workouts],
            'week_number': week_num,
            'week_focus': week_ctx.get('note', ''),
            'days_to_race': (date.fromisoformat(RACE_DATE_STR) - today).days,
            'primary_goal': 'Gara 10km 26 Aprile 2026',
            'secondary_goal': 'Forza gambe (Resistenza Verticale) + arrampicata',
        }

        adaptation, today_modified, today_override = propose_adaptation(claude_context, ANTHROPIC_API_KEY)

        # Salva l'adattamento proposto
        for s in skipped:
            sb.table('workout_log').update({'adapted_notes': adaptation}).eq('date', yesterday.isoformat()).eq('workout_key', s['workout_key']).execute()

        skipped_names = ', '.join(s['descrizione'] for s in skipped_with_detail)
        reasons = ', '.join('stanchezza' if s['reason'] == 'tired' else 'mancanza di tempo' for s in skipped_with_detail)

        if today_modified and today_override:
            today_txt = f"💪 *Oggi (adattato):* {today_override}"

        msg = (
            f"☀️ Buongiorno!\n\n"
            f"⚠️ Ieri hai saltato: _{skipped_names}_ ({reasons})\n"
            f"📋 Claude propone: {adaptation}\n\n"
            f"{today_txt}"
        )
        await context.bot.send_message(chat_id=CHAT_ID, text=msg, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Errore check mattutino: {e}")
        await context.bot.send_message(chat_id=CHAT_ID, text=f"⚠️ Errore check mattutino: {e}")


# ── CALLBACK HANDLERS ──────────────────────────────────────────────────────

async def handle_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    _, date_str, workout_key = query.data.split(':', 2)

    sb = get_supabase()
    sb.table('workout_log').upsert(
        {'date': date_str, 'workout_key': workout_key, 'status': 'done', 'evening_check_sent': True},
        on_conflict='date,workout_key'
    ).execute()

    await query.edit_message_text(f"✅ Ottimo! Workout segnato come completato. 💪")


async def handle_no(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    _, date_str, workout_key = query.data.split(':', 2)

    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("😴 Ero stanco", callback_data=f"reason:tired:{date_str}:{workout_key}"),
            InlineKeyboardButton("⏰ Non ho avuto tempo", callback_data=f"reason:no_time:{date_str}:{workout_key}"),
        ]
    ])
    # Sostituisce il messaggio originale (Sì/No) con la nuova domanda (motivo)
    # Un solo messaggio attivo → nessun keyboard duplicato
    await query.edit_message_text("Perché hai saltato?", reply_markup=keyboard)


async def handle_reason(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    _, reason, date_str, workout_key = query.data.split(':', 3)

    sb = get_supabase()
    sb.table('workout_log').upsert(
        {'date': date_str, 'workout_key': workout_key, 'status': 'skipped', 'reason': reason, 'evening_check_sent': True},
        on_conflict='date,workout_key'
    ).execute()

    msg = "Ok, il recupero è parte dell'allenamento. 🛌" if reason == 'tired' else "Capito, vediamo domani come recuperare. 📅"
    await query.edit_message_text(msg)


# ── COMANDI DI TEST ────────────────────────────────────────────────────────

async def cmd_test_evening(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Comando /test_evening — simula il check serale manualmente."""
    await evening_check(context)


async def cmd_test_morning(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Comando /test_morning — simula il check mattutino manualmente."""
    await morning_check(context)


# ── MAIN ──────────────────────────────────────────────────────

def main():
    app = Application.builder().token(TELEGRAM_TOKEN).build()

    # Callback handlers
    app.add_handler(CallbackQueryHandler(handle_done, pattern=r'^done:'))
    app.add_handler(CallbackQueryHandler(handle_no, pattern=r'^no:'))
    app.add_handler(CallbackQueryHandler(handle_reason, pattern=r'^reason:'))

    # Comandi di test
    app.add_handler(CommandHandler('test_evening', cmd_test_evening))
    app.add_handler(CommandHandler('test_morning', cmd_test_morning))

    # Scheduler
    job_queue = app.job_queue
    job_queue.run_daily(evening_check, time=time(22, 0, tzinfo=ROME))
    job_queue.run_daily(morning_check, time=time(7, 0, tzinfo=ROME))

    logger.info("Bot avviato. Check serale: 22:00 CET/CEST, Check mattutino: 07:00 CET/CEST")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
