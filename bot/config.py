import os
from pathlib import Path
from dotenv import load_dotenv

# Carica .env se esiste (sviluppo locale)
load_dotenv(Path(__file__).parent / '.env')

TELEGRAM_TOKEN = os.environ['TELEGRAM_TOKEN']
CHAT_ID = int(os.environ['CHAT_ID'])
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']  # service role key
ANTHROPIC_API_KEY = os.environ['ANTHROPIC_API_KEY']

# Costanti piano
RACE_DATE_STR = '2026-04-26'
PLAN_JSON_PATH = Path(__file__).parent.parent / 'data' / 'plan_apr2026.json'
