#!/usr/bin/env python3
"""
Generate the Chunks Mirror starter audio library via 9router TTS.

Word-count definitions (canonical, must match src/domain/types.ts):
  short:  2-4 words  — greetings, labels, exclamations (level 1)
  medium: 5-14 words — natural conversational sentences (level 2)
  long:   15-25 words — expressive multi-clause sentences (level 3)

Supported models:
  edge-tts (default, per-lang voice map), el/eleven_multilingual_v2 (premium),
  google-tts, deepgram/*, or any raw model string.

Run (after .env.local):
  python scripts/generate_library.py --model edge-tts --forms short,medium,long
  python scripts/generate_library.py --model "el/eleven_multilingual_v2" --forms medium,long
  python scripts/generate_library.py --model google-tts --langs en,vi,zh

Outputs:
  public/resources/audio/speech/<lang>/<lang>-<n>.mp3           (short)
  public/resources/audio/speech/<lang>/<lang>-medium-<n>.mp3   (medium)
  public/resources/audio/speech/<lang>/<lang>-long-<n>.mp3     (long)
  src/data/resources.json  (full ChunksAwareResource manifest with "form" + "level")
  prototype/bank.js        (for throwaway prototype)

Level assignment:  short → 1 · medium → 2 · long → 3
Never commit keys. Re-run to expand the library as requested.
"""
import argparse
import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[1]

def load_env():
    env = {}
    f = ROOT / ".env.local"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

ENV = load_env()
URL = ENV.get("NINEROUTER_URL", "").rstrip("/")
KEY = ENV.get("NINEROUTER_KEY", "")
if not URL:
    print("NINEROUTER_URL missing in .env.local"); sys.exit(1)

# === Library source of truth (edit + re-run as requested) ===
# Sentence forms: "short" (original short prosodic) + "long" (natural longer sentences for variety).
# Models: pass --model "edge-tts" (default per-lang voice), "el/eleven_multilingual_v2" (premium, auto lang),
#         "google-tts", "deepgram/aura-asteria-en" (or lang-specific), or raw string.
# 24 languages target from PRD. Re-run with flags to expand phrases / languages / voices.

FORMS = ["short", "medium", "long"]  # short<5w · medium 5-14w · long 15-25w

LANG_DATA: dict[str, dict] = {
    # short  = 2-4 words  (level 1)
    # medium = 5-14 words (level 2)  ← renamed from "long" + trimmed to fit 5-14w
    # long   = 15-25 words (level 3) ← new
    "en": {
        "edge_voice": "en-US-AriaNeural",
        "phrases": {
            "short":  ["Good morning", "Thank you", "See you"],
            "medium": [
                "Good morning, I hope you slept well.",
                "Thank you so much for helping me today.",
                "See you again tomorrow morning, take care.",
            ],
            "long": [
                "Good morning everyone, I really hope you all had a wonderful rest last night and are feeling ready for a great day.",
                "Thank you so much for all your support and patience throughout this entire project — it really meant a lot to me.",
            ],
        },
    },
    "vi": {
        "edge_voice": "vi-VN-HoaiMyNeural",
        "phrases": {
            "short":  ["Xin chào", "Cảm ơn", "Hẹn gặp lại"],
            "medium": [
                "Xin chào, hôm nay bạn có khỏe không?",
                "Cảm ơn bạn nhiều vì đã giúp tôi hôm nay.",
                "Hẹn gặp lại bạn vào sáng mai nhé.",
            ],
            "long": [
                "Xin chào tất cả mọi người, hôm nay trời thật đẹp và tôi rất vui vì được gặp gỡ các bạn ở đây.",
                "Cảm ơn bạn rất nhiều vì đã luôn ở bên tôi và giúp tôi vượt qua những lúc khó khăn trong công việc.",
            ],
        },
    },
    "zh": {
        "edge_voice": "zh-CN-XiaoxiaoNeural",
        "phrases": {
            "short":  ["你好", "谢谢", "明天见"],
            "medium": [
                "你好，今天天气很好，出去走走吧。",
                "非常感谢你帮我解决这个问题。",
                "明天见，记得早点休息，好好睡觉。",
            ],
            "long": [
                "你好，今天的天气真的非常好，阳光明媚，我想邀请你一起出去散步，享受这美好的时光。",
                "非常感谢你昨天帮我解决了那个很重要的技术问题，如果没有你的帮助我真的不知道该怎么办。",
            ],
        },
    },
    "fr": {
        "edge_voice": "fr-FR-DeniseNeural",
        "phrases": {
            "short":  ["Bonjour", "Merci", "À demain"],
            "medium": [
                "Bonjour, j'espère que vous avez bien dormi cette nuit.",
                "Merci beaucoup pour votre aide précieuse sur ce projet.",
                "À demain, reposez-vous bien ce soir.",
            ],
            "long": [
                "Bonjour à tous, j'espère que vous avez passé une excellente nuit et que vous êtes prêts pour cette nouvelle journée pleine de belles surprises.",
                "Merci infiniment pour tout le soutien que vous m'avez apporté tout au long de ce projet, cela m'a vraiment touché le cœur.",
            ],
        },
    },
    "ko": {
        "edge_voice": "ko-KR-SunHiNeural",
        "phrases": {
            "short":  ["안녕하세요", "감사합니다", "내일 봐요"],
            "medium": [
                "안녕하세요, 오늘 하루도 잘 보내세요.",
                "정말 감사합니다, 덕분에 문제를 해결했어요.",
                "내일 봐요, 오늘도 수고 많으셨습니다.",
            ],
            "long": [
                "안녕하세요 여러분, 오늘 날씨가 정말 좋아서 기분이 너무 좋고 여러분과 함께 좋은 하루를 보내고 싶어요.",
                "정말 감사합니다, 어려운 상황에서도 항상 도움을 주시고 응원해 주셔서 진심으로 감사하고 감동받았어요.",
            ],
        },
    },
    "ja": {
        "edge_voice": "ja-JP-NanamiNeural",
        "phrases": {
            "short":  ["おはよう", "ありがとう", "また明日"],
            "medium": [
                "おはようございます、今日もよろしくお願いします。",
                "ありがとうございます、本当に助かりました。",
                "また明日、ゆっくり休んでくださいね。",
            ],
            "long": [
                "おはようございます、今日は天気がとても良くて気持ちがいいですね、一緒に素晴らしい一日を過ごしましょう。",
                "ありがとうございます、このプロジェクトを通じていつもサポートしていただき、本当に心から感謝しております。",
            ],
        },
    },
    "es": {
        "edge_voice": "es-ES-ElviraNeural",
        "phrases": {
            "short":  ["Buenos días", "Gracias", "Hasta mañana"],
            "medium": [
                "Buenos días, ¿cómo amaneciste hoy y qué planes tienes?",
                "Muchas gracias por tu apoyo durante la reunión.",
                "Hasta mañana, que descanses muy bien esta noche.",
            ],
            "long": [
                "Buenos días a todos, espero que hayan descansado muy bien anoche y que estén listos para vivir un día maravilloso lleno de energía.",
                "Muchas gracias por todo el apoyo y la paciencia que me brindaron a lo largo de este proyecto tan importante para mí.",
            ],
        },
    },
    "de": {
        "edge_voice": "de-DE-KatjaNeural",
        "phrases": {
            "short":  ["Guten Morgen", "Danke", "Bis morgen"],
            "medium": [
                "Guten Morgen, ich hoffe du hast gut geschlafen.",
                "Vielen Dank für deine Hilfe bei dem Projekt.",
                "Bis morgen, erhol dich gut heute Abend.",
            ],
            "long": [
                "Guten Morgen an alle, ich hoffe dass ihr alle gut geschlafen habt und bereit seid für einen wunderschönen und produktiven Tag.",
                "Vielen herzlichen Dank für eure Unterstützung und Geduld während dieses gesamten Projekts, das hat mich wirklich sehr berührt.",
            ],
        },
    },
    "it": {
        "edge_voice": "it-IT-ElsaNeural",
        "phrases": {
            "short":  ["Buongiorno", "Grazie", "A domani"],
            "medium": [
                "Buongiorno, spero che tu abbia passato una buona notte.",
                "Grazie mille per il tuo aiuto con il lavoro.",
                "A domani, riposati bene questa sera.",
            ],
            "long": [
                "Buongiorno a tutti, spero che abbiate trascorso una notte meravigliosa e che siate pronti per affrontare questa nuova giornata con energia.",
                "Grazie mille per tutto il supporto e la pazienza che mi avete dimostrato durante questo lungo e impegnativo progetto.",
            ],
        },
    },
    "pt": {
        "edge_voice": "pt-BR-FranciscaNeural",
        "phrases": {
            "short":  ["Bom dia", "Obrigado", "Até amanhã"],
            "medium": [
                "Bom dia, espero que você tenha dormido muito bem.",
                "Muito obrigado pela sua ajuda com o projeto.",
                "Até amanhã, descanse bem essa noite.",
            ],
            "long": [
                "Bom dia a todos, espero que vocês tenham tido uma boa noite de descanso e estejam prontos para mais um dia cheio de conquistas.",
                "Muito obrigado por todo o apoio e dedicação que vocês demonstraram ao longo desse projeto tão importante e desafiador.",
            ],
        },
    },
    "ru": {
        "edge_voice": "ru-RU-SvetlanaNeural",
        "phrases": {
            "short":  ["Доброе утро", "Спасибо", "До завтра"],
            "medium": [
                "Доброе утро, надеюсь ты хорошо выспался сегодня.",
                "Большое спасибо за помощь с важной задачей.",
                "До завтра, хорошего тебе вечера и отдыха.",
            ],
            "long": [
                "Доброе утро всем, я очень надеюсь что вы хорошо отдохнули ночью и готовы к новому замечательному и продуктивному дню.",
                "Большое спасибо за всю поддержку и терпение которые вы проявили на протяжении всего этого важного и сложного проекта.",
            ],
        },
    },
    "ar": {
        "edge_voice": "ar-SA-ZariyahNeural",
        "phrases": {
            "short":  ["صباح الخير", "شكراً", "إلى اللقاء"],
            "medium": [
                "صباح الخير، أتمنى أن تكون قد نمت جيداً الليلة.",
                "شكراً جزيلاً على مساعدتك في إنجاز هذا العمل.",
                "إلى اللقاء، أتمنى لك مساءً رائعاً ومريحاً.",
            ],
            "long": [
                "صباح الخير للجميع، أتمنى أن تكونوا قد أخذتم قسطاً وافراً من الراحة وأنتم الآن مستعدون لبدء يوم جميل ومثمر.",
                "شكراً جزيلاً على كل الدعم والتشجيع الذي قدمتموه لي طوال فترة هذا المشروع المهم والمثير للاهتمام.",
            ],
        },
    },
    "hi": {
        "edge_voice": "hi-IN-SwaraNeural",
        "phrases": {
            "short":  ["नमस्ते", "धन्यवाद", "फिर मिलेंगे"],
            "medium": [
                "नमस्ते, आज आप कैसे हैं, सब ठीक है ना?",
                "बहुत धन्यवाद आपकी मदद के लिए इस काम में।",
                "फिर मिलेंगे, आज शाम अच्छे से आराम करना।",
            ],
            "long": [
                "नमस्ते सभी को, मुझे उम्मीद है कि आप सभी ने रात को अच्छी नींद ली और आज के दिन के लिए पूरी तरह तैयार हैं।",
                "बहुत-बहुत धन्यवाद आपकी उस मदद के लिए जो आपने इस पूरे प्रोजेक्ट के दौरान हमेशा बिना रुके दी।",
            ],
        },
    },
    "th": {
        "edge_voice": "th-TH-PremwadeeNeural",
        "phrases": {
            "short":  ["สวัสดี", "ขอบคุณ", "แล้วเจอกัน"],
            "medium": [
                "สวัสดีค่ะ วันนี้สบายดีไหมคะ มีอะไรให้ช่วยไหม",
                "ขอบคุณมากค่ะ ที่ช่วยเหลือฉันในงานที่ยากมาก",
                "แล้วเจอกันใหม่นะคะ พักผ่อนให้เพียงพอด้วยนะ",
            ],
            "long": [
                "สวัสดีทุกคนค่ะ หวังว่าทุกคนจะได้พักผ่อนอย่างเพียงพอเมื่อคืนและพร้อมสำหรับวันใหม่ที่สดใสและเต็มไปด้วยพลังงาน",
                "ขอบคุณมากค่ะสำหรับการสนับสนุนและความอดทนที่ทุกคนมอบให้ตลอดช่วงเวลาของโครงการที่สำคัญนี้",
            ],
        },
    },
    "id": {
        "edge_voice": "id-ID-GadisNeural",
        "phrases": {
            "short":  ["Selamat pagi", "Terima kasih", "Sampai jumpa"],
            "medium": [
                "Selamat pagi, semoga hari ini menyenangkan untuk kita.",
                "Terima kasih banyak atas bantuanmu menyelesaikan tugas ini.",
                "Sampai jumpa, semoga kamu istirahat dengan baik malam ini.",
            ],
            "long": [
                "Selamat pagi semuanya, saya berharap kalian semua sudah beristirahat dengan cukup dan siap untuk menjalani hari yang luar biasa ini.",
                "Terima kasih banyak atas semua dukungan dan kesabaran yang telah kalian berikan selama menyelesaikan proyek yang sangat penting ini.",
            ],
        },
    },
    "nl": {
        "edge_voice": "nl-NL-ColetteNeural",
        "phrases": {
            "short":  ["Goedemorgen", "Bedankt", "Tot morgen"],
            "medium": [
                "Goedemorgen, ik hoop dat je goed hebt geslapen vannacht.",
                "Hartelijk bedankt voor je hulp bij het moeilijke project.",
                "Tot morgen, geniet van je avond en rust goed uit.",
            ],
            "long": [
                "Goedemorgen iedereen, ik hoop dat jullie allemaal goed hebben geslapen en klaar zijn voor een prachtige en productieve nieuwe dag.",
                "Hartelijk dank voor alle steun en geduld die jullie hebben getoond gedurende dit hele lange en veeleisende project.",
            ],
        },
    },
    "tr": {
        "edge_voice": "tr-TR-EmelNeural",
        "phrases": {
            "short":  ["Günaydın", "Teşekkürler", "Görüşürüz"],
            "medium": [
                "Günaydın, umarım bu gece iyi uyudun ve dinlendin.",
                "Çok teşekkürler, zor görevi tamamlamama yardım ettiğin için.",
                "Görüşürüz, bu akşam iyi dinlenmeni umuyorum.",
            ],
            "long": [
                "Günaydın herkese, umarım hepiniz çok iyi bir gece geçirdiniz ve şimdi harika ve verimli bir güne hazır hissediyorsunuzdur.",
                "Çok teşekkür ederim bu önemli proje boyunca gösterdiğiniz tüm destek ve sabır için, bu benim için gerçekten çok anlamlıydı.",
            ],
        },
    },
    "pl": {
        "edge_voice": "pl-PL-ZofiaNeural",
        "phrases": {
            "short":  ["Dzień dobry", "Dziękuję", "Do jutra"],
            "medium": [
                "Dzień dobry, mam nadzieję że dobrze spałeś w nocy.",
                "Dziękuję bardzo za pomoc przy trudnym zadaniu wczoraj.",
                "Do jutra, życzę ci miłego wieczoru i dobrego odpoczynku.",
            ],
            "long": [
                "Dzień dobry wszystkim, mam nadzieję że wszyscy dobrze się wyspali i są gotowi na kolejny wspaniały i produktywny dzień pracy.",
                "Bardzo dziękuję za całe wsparcie i cierpliwość jaką okazaliście przez cały czas trwania tego ważnego i wymagającego projektu.",
            ],
        },
    },
    "sv": {
        "edge_voice": "sv-SE-SofieNeural",
        "phrases": {
            "short":  ["God morgon", "Tack", "Vi ses"],
            "medium": [
                "God morgon, jag hoppas att du sovit gott i natt.",
                "Tack så mycket för hjälpen med det svåra projektet.",
                "Vi ses imorgon, ha en skön kväll och vila dig.",
            ],
            "long": [
                "God morgon allihopa, jag hoppas att ni alla har sovit gott och att ni är redo för att ta er an en fantastisk och produktiv dag.",
                "Tack så hjärtligt för allt stöd och all tålamod som ni visade under hela det här långa och krävande projektet.",
            ],
        },
    },
    "el": {
        "edge_voice": "el-GR-AthinaNeural",
        "phrases": {
            "short":  ["Καλημέρα", "Ευχαριστώ", "Αντίο"],
            "medium": [
                "Καλημέρα, ελπίζω να κοιμήθηκες καλά απόψε.",
                "Ευχαριστώ πολύ για τη βοήθειά σου με τη δύσκολη δουλειά.",
                "Αντίο, να περάσεις ένα υπέροχο βράδυ.",
            ],
            "long": [
                "Καλημέρα σε όλους, ελπίζω να κοιμηθήκατε πολύ καλά και να είστε έτοιμοι για μια υπέροχη και παραγωγική μέρα γεμάτη ενέργεια.",
                "Σας ευχαριστώ πολύ για όλη την υποστήριξη και υπομονή που δείξατε καθ' όλη τη διάρκεια αυτού του σημαντικού έργου.",
            ],
        },
    },
    "uk": {
        "edge_voice": "uk-UA-PolinaNeural",
        "phrases": {
            "short":  ["Доброго ранку", "Дякую", "До побачення"],
            "medium": [
                "Доброго ранку, сподіваюся ти добре виспався сьогодні.",
                "Дякую дуже за допомогу з важким завданням учора.",
                "До побачення, гарного тобі вечора і відпочинку.",
            ],
            "long": [
                "Доброго ранку всім, я сподіваюся що ви всі добре відпочили вночі і готові до нового прекрасного та продуктивного робочого дня.",
                "Велика дяка за всю підтримку та терпіння які ви виявляли протягом усього цього важливого та вимогливого проекту.",
            ],
        },
    },
    "ro": {
        "edge_voice": "ro-RO-AlinaNeural",
        "phrases": {
            "short":  ["Bună dimineața", "Mulțumesc", "La revedere"],
            "medium": [
                "Bună dimineața, sper că ai dormit bine în noaptea asta.",
                "Mulțumesc mult pentru ajutorul tău la proiectul dificil.",
                "La revedere, îți doresc o seară minunată și odihnă bună.",
            ],
            "long": [
                "Bună dimineața tuturor, sper că ați dormit foarte bine și că sunteți pregătiți pentru o zi minunată și productivă plină de energie.",
                "Mulțumesc mult pentru tot sprijinul și răbdarea pe care le-ați arătat de-a lungul întregului proiect atât de important și solicitant.",
            ],
        },
    },
    "cs": {
        "edge_voice": "cs-CZ-VlastaNeural",
        "phrases": {
            "short":  ["Dobré ráno", "Děkuji", "Na shledanou"],
            "medium": [
                "Dobré ráno, doufám že jsi dnes v noci dobře spal.",
                "Děkuji moc za tvou pomoc s obtížným úkolem včera.",
                "Na shledanou, přeji ti příjemný večer a dobré odpočinutí.",
            ],
            "long": [
                "Dobré ráno všem, doufám že jste si všichni dobře odpočinuli a jste připraveni na nový skvělý a produktivní den plný energie.",
                "Mnohokrát děkuji za veškerou podporu a trpělivost kterou jste projevili po celou dobu tohoto důležitého a náročného projektu.",
            ],
        },
    },
    "fil": {
        "edge_voice": "fil-PH-BlessicaNeural",
        "phrases": {
            "short":  ["Magandang umaga", "Salamat", "Paalam"],
            "medium": [
                "Magandang umaga, sana ay nakatulog kang mabuti kagabi.",
                "Maraming salamat sa tulong mo sa mahirap na proyekto kahapon.",
                "Paalam, nawa ay magkaroon ka ng magandang gabi at pahinga.",
            ],
            "long": [
                "Magandang umaga sa inyong lahat, umaasa ako na nakatulog kayong lahat nang maayos at handa na kayo para sa isang magandang at mabunga na araw.",
                "Maraming maraming salamat sa lahat ng suporta at pasensya na ipinakita ninyo sa buong tagal ng napakahalagang proyektong ito.",
            ],
        },
    },
}

def resolve_model(choice: str, lang: str, edge_voice: str | None) -> str:
    c = (choice or "edge-tts").strip().lower()
    if c in ("edge-tts", "edge", "default"):
        return f"edge-tts/{edge_voice}"
    if c in ("el/eleven_multilingual_v2", "eleven", "eleven_multilingual_v2", "premium"):
        return "el/eleven_multilingual_v2"
    if c in ("google-tts", "google", "g"):
        return f"google-tts/{lang}"
    if c.startswith("deepgram"):
        # Allow full "deepgram/aura-..." or simple; user supplies appropriate per run
        return choice if "/" in choice else f"deepgram/{choice}"
    # raw passthrough e.g. openai/tts-1/alloy or custom
    return choice

def synth(model: str, text: str, out_path: Path, retries: int = 2) -> int:
    """POST to 9router. model can be edge-tts/voice, el/eleven_multilingual_v2, google-tts/xx, deepgram/..., etc."""
    body = json.dumps({"model": model, "input": text}).encode("utf-8")
    req = urllib.request.Request(URL + "/audio/speech", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "curl/8.4.0")  # tunnel 403s default python UA
    req.add_header("Accept", "*/*")
    if KEY:
        req.add_header("Authorization", "Bearer " + KEY)
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if data[:3] == b"ID3" or len(data) > 1500:
                out_path.write_bytes(data)
                return len(data)
            raise ValueError(f"suspect payload {len(data)}B")
        except Exception as e:
            if attempt < retries:
                time.sleep(1.5)
            else:
                print(f"   ! FAIL model={model} '{text}': {e}")
                return 0
    return 0

def main():
    parser = argparse.ArgumentParser(description="Generate Chunks Mirror library (forms + multi-model via 9router).")
    parser.add_argument("--model", default="edge-tts", help="edge-tts | el/eleven_multilingual_v2 | google-tts | deepgram/... | raw")
    parser.add_argument("--forms", default="short,long", help="comma-separated: short,long")
    parser.add_argument("--langs", default="", help="comma-separated subset (default: all in LANG_DATA)")
    args = parser.parse_args()

    chosen_forms = [f.strip() for f in args.forms.split(",") if f.strip() in FORMS]
    if not chosen_forms:
        chosen_forms = ["short"]

    target_langs = [l.strip() for l in args.langs.split(",") if l.strip()] or list(LANG_DATA.keys())
    target_langs = [l for l in target_langs if l in LANG_DATA]

    model_choice = args.model

    audio_root = ROOT / "public" / "resources" / "audio" / "speech"
    manifest: list[dict] = []
    total = sum(
        len(LANG_DATA[lang]["phrases"].get(f, []))
        for lang in target_langs
        for f in chosen_forms
    )
    done = 0

    print(f"Generating {total} speech clips across {len(target_langs)} languages | forms={chosen_forms} | model={model_choice}\n")

    for lang in target_langs:
        data = LANG_DATA[lang]
        edge_voice = data["edge_voice"]
        phrases_by_form = data["phrases"]

        (audio_root / lang).mkdir(parents=True, exist_ok=True)

        idx_short = 1
        idx_medium = 1
        idx_long = 1

        for form in chosen_forms:
            texts = phrases_by_form.get(form, [])
            for text in texts:
                full_model = resolve_model(model_choice, lang, edge_voice)

                if form == "short":
                    fname = f"{lang}-{idx_short}.mp3"
                    idx_short += 1
                elif form == "medium":
                    fname = f"{lang}-medium-{idx_medium}.mp3"
                    idx_medium += 1
                else:
                    fname = f"{lang}-long-{idx_long}.mp3"
                    idx_long += 1

                out = audio_root / lang / fname
                size = synth(full_model, text, out)
                done += 1
                status = f"{size}B" if size else "skipped"

                # provider / voiceId friendly display
                if full_model.startswith("el/"):
                    prov = full_model
                    vid = "eleven_multilingual_v2"
                elif full_model.startswith("edge-tts/"):
                    prov = full_model
                    vid = full_model.split("/", 1)[1]
                else:
                    prov = full_model
                    vid = full_model

                license_note = f"self-generated ({full_model} via 9router)"
                rid = f"sp-{lang}-{form}-{ (idx_short if form=='short' else idx_long) - 1 }"

                print(f"[{done:>2}/{total}] {lang} {full_model:<32} [{form}] {text[:22]:<22} -> {status}")

                if not size:
                    continue

                manifest.append({
                    "id": rid,
                    "category": "speech",
                    "sourceKind": "tts",
                    "audioUrl": f"/resources/audio/speech/{lang}/{fname}",
                    "file": f"speech/{lang}/{fname}",
                    "textPrompt": text,
                    "label": ["starter", lang, f"form:{form}"],
                    "language": lang,
                    "level": 1 if form == "short" else (2 if form == "medium" else 3),
                    "form": form,
                    "durationMs": None,
                    "approvalStatus": "approved_resource",
                    "license": license_note,
                    "provenanceUrl": "",
                    "attribution": "",
                    "provider": prov,
                    "voiceId": vid,
                    "createdAt": "2026-06-16",
                    "mseFocus": "sound",
                    "resistanceTag": "greeting" if form == "short" else "sentence",
                    "lessonId": "starter-greetings",
                    "mirrorGoal": "prosody",
                })

    # canonical manifest
    (ROOT / "src" / "data").mkdir(parents=True, exist_ok=True)
    (ROOT / "src" / "data" / "resources.json").write_text(
        json.dumps({"resources": manifest}, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # prototype bank.js (file:// safe)
    proto = [{
        "id": m["id"],
        "cat": m["category"],
        "lang": m["language"],
        "level": m["level"],
        "form": m.get("form", "short"),
        "text": m["textPrompt"],
        "audioUrl": "../public" + m["audioUrl"],
    } for m in manifest]
    (ROOT / "prototype").mkdir(parents=True, exist_ok=True)
    (ROOT / "prototype" / "bank.js").write_text(
        "window.LIBRARY = " + json.dumps(proto, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8"
    )

    print(f"\nDONE: {len(manifest)}/{total} clips generated.")
    print("  audio   -> public/resources/audio/speech/<lang>/ (short: lang-N.mp3, long: lang-long-N.mp3)")
    print("  manifest-> src/data/resources.json   (includes 'form' field)")
    print("  proto   -> prototype/bank.js")
    print("\nTo expand more: edit LANG_DATA phrases, re-run with --model el/eleven_multilingual_v2 --forms short,long etc.")

if __name__ == "__main__":
    main()
