# claude-flow

**Мiст між будь-якою AI моделлю та Claude Code CLI** — маршрутизація через OpenRouter, DeepSeek, OpenAI, Gemini або будь-який Anthropic-сумісний endpoint.

![Node](https://img.shields.io/badge/node-%3E%3D18.0-green) ![Ліцензія](https://img.shields.io/badge/license-MIT-blue) ![Нулю залежностей](https://img.shields.io/badge/dependencies-0-success)

Доступно: [English](README.md) | **Українська** | [Русский](README_RU.md)

---

## Проблема

Claude Code CLI жорстко прив'язаний до API Anthropic. Він відправляє запити у форматі Anthropic Messages API, очікує відповіді у тому ж форматі та автентифікується методом Anthropic. Якщо ви хочете використовувати **будь-яку іншу модель** — DeepSeek, GPT-4, Gemini, GLM, Llama, Qwen — ви зіткнетесь з трьома стінами:

### 1. Несумісність форматів відповідей

Кожен AI-провайдер має свій формат API. DeepSeek, OpenAI та Gemini використовують OpenAI-сумісний формат. Китайські моделі (GLM, Qwen) мають власні API. Open-source моделі (Llama, Mistral) мають унікальну структуру відповідей.

Claude Code очікує **конкретні** streaming-події Anthropic (`content_block_delta`), типи блоків контенту, структури `tool_use`, значення `stop_reason` та поля підрахунку токенів. Надішліть йому сиру відповідь DeepSeek або OpenAI — він зламається.

**Рішення:** Провайдери як **OpenRouter** та **DeepSeek** пропонують **Anthropic-сумісні проксі-endpoint'и** — вони приймають запити у форматі Anthropic, маршрутизують їх до будь-якої моделі та **перекладають відповідь назад** у формат Anthropic. claude-flow знає, які саме endpoint'и використовувати для кожного провайдера.

### 2. Пастка автентифікації

Автентифікація Claude Code має **недокументовану особливість**: `ANTHROPIC_API_KEY` повинна бути встановлена на **порожній рядок** (`""`) для проксі-провайдерів — не відсутня, не видалена. Саме порожній рядок.

- Якщо `ANTHROPIC_API_KEY` **відсутня** → Claude Code падає при запуску
- Якщо `ANTHROPIC_API_KEY` **непорожна** → Claude Code використовує її і мовчки ігнорує ваш проксі-токен
- Якщо `ANTHROPIC_API_KEY` **`""`** → Claude Code переходить на `ANTHROPIC_AUTH_TOKEN` ✓

Різні провайдери також використовують різні методи автентифікації — Bearer токен (OpenRouter) vs. API ключ (DeepSeek, OpenAI). Помилка в будь-чому з цього призводить до тихих збоїв.

### 3. Складність конфігурації

6 змінних середовища, нуль офіційної документації, різні комбінації для кожного провайдера та неочевидна поведінка. Одне неправильне налаштування = Claude Code або падає, або мовчки спілкується з неправильним endpoint'ом.

**claude-flow вирішує всі три проблеми.** Одна команда коректно налаштовує все для будь-якого провайдера.

---

## Швидкий старт

```bash
# Встановлення
npm install -g claude-flow

# Налаштування провайдера (інтерактивно)
claude-flow setup openrouter

# Запуск Claude Code
eval $(claude-flow env)
claude -p "Привіт з OpenRouter!"
```

Готово. Тепер Claude Code використовує ваш провайдер у кожному запиті.

---

## Встановлення

### Варіант 1: Глобально через NPM (рекомендовано)

```bash
npm install -g claude-flow
```

### Варіант 2: Запуск без встановлення (npx)

```bash
npx claude-flow setup openrouter
npx claude-flow run -- claude -p "Привіт!"
```

### Варіант 3: Клонування та локальне використання

```bash
git clone https://github.com/Lexus2016/claude-flow.git
cd claude-flow
node bin/claude-flow.js setup openrouter
```

### Вимоги

- **Node.js** >= 18.0
- **Claude Code CLI** (від Anthropic) — [встановити звідси](https://claude.ai/claude-code)
- API ключ для вибраного провайдера (див. [Підтримувані провайдери](#підтримувані-провайдери))

---

## Покрокове налаштування

### 1. Встановлення claude-flow

```bash
npm install -g claude-flow
```

### 2. Запуск інтерактивного майстра налаштування

```bash
claude-flow setup openrouter
```

Вас попросять ввести:
- Ваш API ключ провайдера (наприклад, `sk-or-v1-...`)
- Переваги моделей для кожного рівня (haiku, sonnet, opus) — або натисніть Enter для значень за замовчуванням

**Приклад сеансу:**

```
  claude-flow — Setup OpenRouter

  Get your API key: https://openrouter.ai/keys

  API Key: sk-or-v1-abc123def456...

  Model configuration (press Enter for defaults)

  Claude Code uses 3 model tiers: haiku (fast), sonnet (balanced), opus (powerful)

  Popular models for OpenRouter:
    anthropic/claude-sonnet-4-6              sonnet
    anthropic/claude-opus-4-6               opus
    anthropic/claude-haiku-4-5-20251001      haiku
    google/gemini-3.1-pro-preview           opus
    deepseek/deepseek-v3.2                  sonnet

  Haiku model  [anthropic/claude-haiku-4-5-20251001]:
  Sonnet model [anthropic/claude-sonnet-4-6]:
  Opus model   [anthropic/claude-opus-4-6]:

  ✓ Configuration saved to /Users/you/.claude-flow/config.json
  ✓ Active provider: OpenRouter

  Environment variables (what Claude Code will use):

    ANTHROPIC_BASE_URL                 https://openrouter.ai/api
    ANTHROPIC_AUTH_TOKEN              sk-or-v1-abc...
    ANTHROPIC_API_KEY                 ""  ← intentionally empty
    ANTHROPIC_DEFAULT_HAIKU_MODEL     anthropic/claude-haiku-4-5-20251001
    ANTHROPIC_DEFAULT_SONNET_MODEL    anthropic/claude-sonnet-4-6
    ANTHROPIC_DEFAULT_OPUS_MODEL      anthropic/claude-opus-4-6

  Quick start:

    # Option 1: Run directly
    claude-flow run -- claude -p 'Hello from OpenRouter!'

    # Option 2: Add to your shell profile
    echo 'eval "$(claude-flow env)"' >> ~/.bashrc

    # Option 3: One-time eval
    eval $(claude-flow env)
```

### 3. Використання Claude Code з вашим провайдером

Виберіть один з трьох методів:

#### Метод 1: Прямий запуск (рекомендовано для окремих команд)

```bash
claude-flow run -- claude -p "Яка погода?"
```

#### Метод 2: Eval для поточної оболонки (рекомендовано для інтерактивної роботи)

```bash
eval $(claude-flow env)
claude -p "Побудуй мені React компонент"
```

#### Метод 3: Додавання до профілю оболонки (рекомендовано для постійного налаштування)

```bash
# Додайте до ~/.bashrc, ~/.zshrc або ~/.fish/config.fish
echo 'eval "$(claude-flow env)"' >> ~/.bashrc

# Потім перезавантажте оболонку
source ~/.bashrc

# Тепер Claude Code працює всюди
claude -p "Привіт!"
```

---

## Підтримувані провайдери

### Швидке порівняння

| Провайдер | Вибір моделей | Вартість | Налаштування | Найкраще для |
|-----------|-----------------|---------|-------------|------------|
| **OpenRouter** | 200+ моделей від усіх провайдерів | Варіюється | Легко | Один API для всього |
| **DeepSeek** | V3.2, R1 (reasoning) | Найдешевше | Легко | Дешеві міркування |
| **OpenAI** | GPT-5.2, o3 | Преміум | Легко | Найновіші моделі |
| **Gemini** | Gemini 3.1 Pro / 3 Flash | Конкурентна | Легко | Швидке виконання |
| **Custom** | Будь-який Anthropic-сумісний endpoint | Варіюється | Ручне | Самостійно розміщені, приватні хмари |

---

## Деталі провайдерів

### OpenRouter

**Доступ до 200+ моделей від одного API endpoint.**

Ідеально, якщо хочете гнучкість — використовуйте Claude, GPT-4, DeepSeek, Gemini, Llama, Qwen та інші з одним ключем. Плата за використання.

**Отримати API ключ:** https://openrouter.ai/keys

**Налаштування:**

```bash
claude-flow setup openrouter
```

**Моделі за замовчуванням:**
- Haiku: `anthropic/claude-haiku-4-5-20251001`
- Sonnet: `anthropic/claude-sonnet-4-6`
- Opus: `anthropic/claude-opus-4-6`

**Популярні моделі для спроби:**

```bash
claude-flow models openrouter
```

```
  Default tier mapping:
    haiku  → anthropic/claude-haiku-4-5-20251001
    sonnet → anthropic/claude-sonnet-4-6
    opus   → anthropic/claude-opus-4-6

  Popular models:

    Model ID                                 Name                     Tier
    ─────────────────────────────────────────────────────────────────────
    anthropic/claude-opus-4-6                Claude Opus 4.6          opus
    anthropic/claude-sonnet-4-6              Claude Sonnet 4.6        sonnet
    anthropic/claude-haiku-4-5-20251001      Claude Haiku 4.5         haiku
    google/gemini-3.1-pro-preview            Gemini 3.1 Pro           opus
    google/gemini-3-flash-preview            Gemini 3 Flash           sonnet
    openai/gpt-5.2                           GPT-5.2                  opus
    openai/gpt-5.2-mini                      GPT-5.2 Mini             sonnet
    deepseek/deepseek-v3.2                   DeepSeek V3.2            sonnet
    deepseek/deepseek-r1-0528                DeepSeek R1              opus
    minimax/minimax-m2.5                     MiniMax M2.5             opus
    moonshotai/kimi-k2.5                     Kimi K2.5                opus
    z-ai/glm-5                               GLM-5                    opus
    qwen/qwen3.5-plus                        Qwen 3.5                 sonnet
    meta-llama/llama-4-maverick              Llama 4 Maverick         sonnet
    z-ai/glm-4.5-air                         GLM-4.5 Air              haiku
```

**Користуйтесь різними моделями для кожного рівня:**

```bash
claude-flow setup openrouter

# При запиті:
# Haiku model: google/gemini-3-flash-preview
# Sonnet model: deepseek/deepseek-v3.2
# Opus model: openai/gpt-5.2
```

---

### DeepSeek

**Надшвидкий та дешевий. Чудово для задач на міркування.**

DeepSeek V3.2 (fast, hybrid thinking) and R1 через їх власний API. Односимвольні вартості.

**Отримати API ключ:** https://platform.deepseek.com/api_keys

**Налаштування:**

```bash
claude-flow setup deepseek
```

**Моделі за замовчуванням:**
- Haiku: `deepseek-v3.2`
- Sonnet: `deepseek-v3.2`
- Opus: `deepseek-r1-0528`

**Чому користуватися DeepSeek?**
- Найдешевша вартість LLM на ринку
- DeepSeek R1 перевершує GPT-4 на багатьох тестах
- Власний API (без розмітки прокси)

**Використовуйте R1 для міркувань:**

```bash
claude-flow setup deepseek
# При запиті для Sonnet та Opus використовуйте: deepseek-r1-0528
```

---

### OpenAI

**Останні моделі GPT, включаючи o3.**

GPT-5.2 (flagship), GPT-5.2 Thinking та o3 через офіційний API OpenAI.

**Отримати API ключ:** https://platform.openai.com/api-keys

**Налаштування:**

```bash
claude-flow setup openai
```

**Моделі за замовчуванням:**
- Haiku: `gpt-5.2-mini`
- Sonnet: `gpt-5.2`
- Opus: `gpt-5.2`

**Популярні моделі:**

```bash
claude-flow models openai
```

```
  Default tier mapping:
    haiku  → gpt-5.2-mini
    sonnet → gpt-5.2
    opus   → gpt-5.2

  Popular models:

    Model ID                                 Name                     Tier
    ─────────────────────────────────────────────────────────────────────
    gpt-5.2                                  GPT-5.2                  opus
    gpt-5.2-mini                             GPT-5.2 Mini             sonnet
    o3                                       o3                       opus
    o3-mini                                  o3 Mini                  sonnet
```

---

### Gemini

**Останні моделі Google. Швидкі та здатні.**

Gemini 3.1 Pro (latest), Gemini 3 Flash та 2.5 через API Google.

**Отримати API ключ:** https://aistudio.google.com/apikey

**Налаштування:**

```bash
claude-flow setup gemini
```

**Моделі за замовчуванням:**
- Haiku: `gemini-2.5-flash`
- Sonnet: `gemini-3-flash-preview`
- Opus: `gemini-3.1-pro-preview`

---

### Власний провайдер

**Будь-який Anthropic-сумісний endpoint (самостійно розміщені, приватні хмари тощо).**

Якщо у вас є свій Claude-сумісний endpoint або ви хочете користуватися провайдером, якого немає вище:

```bash
claude-flow setup custom
```

Вас попросять ввести:
- URL основи API (наприклад, `https://your-proxy.local/v1`)
- ID моделей
- API ключ

---

## Довідник CLI

### Довідка

```bash
claude-flow help
```

Показує всі команди та приклади.

---

### Setup

```bash
claude-flow setup <provider>
```

Інтерактивний майстер налаштування. Керує вас через отримання API ключа та вибір моделей.

**Провайдери:** `openrouter`, `deepseek`, `openai`, `gemini`, `custom`

**Приклади:**

```bash
claude-flow setup openrouter
claude-flow setup deepseek
claude-flow setup openai
```

---

### Env

Вивести оператори експорту оболонки. Використовується для eval або додавання до профілю оболонки.

```bash
# Вивести на stdout (зручно копіювати)
claude-flow env

# Або використати в команді
eval $(claude-flow env)

# Або для конкретного провайдера
claude-flow env deepseek
eval $(claude-flow env deepseek)
```

**Приклад виводу:**

```bash
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
export ANTHROPIC_API_KEY=''
export ANTHROPIC_DEFAULT_HAIKU_MODEL='anthropic/claude-haiku-4-5-20251001'
export ANTHROPIC_DEFAULT_SONNET_MODEL='anthropic/claude-sonnet-4-6'
export ANTHROPIC_DEFAULT_OPUS_MODEL='anthropic/claude-opus-4-6'
```

---

### Run

Запустити команду зі встановленими змінними середовища провайдера.

```bash
claude-flow run -- <command> [args...]
```

Розділювач `--` важливий — все після нього - це ваша команда.

**Приклади:**

```bash
# Запустити Claude Code один раз з OpenRouter
claude-flow run -- claude -p "Привіт з OpenRouter!"

# Запустити з іншим провайдером
claude-flow run deepseek -- claude -p "Використовуй DeepSeek для цього"

# Запустити будь-яку команду (не тільки Claude)
claude-flow run -- node my-script.js
claude-flow run -- python my-app.py

# Ланцюг з іншими командами
claude-flow run -- bash -c 'echo $ANTHROPIC_BASE_URL && claude -p "Тест"'
```

---

### Status

Показати поточну конфігурацію та активний провайдер.

```bash
claude-flow status
```

**Приклад виводу:**

```
  claude-flow status

  Config: /Users/you/.claude-flow/config.json
  Active: openrouter

  ● OpenRouter         Key: sk-or-v1-abc...def
    haiku=anthropic/claude-haiku-4-5-20251001  sonnet=anthropic/claude-sonnet-4-6  opus=anthropic/claude-opus-4-6
  ○ DeepSeek           Key: sk-...xyz
    haiku=deepseek-v3.2  sonnet=deepseek-v3.2  opus=deepseek-r1-0528
```

---

### Switch

Перейти на іншого провайдера (повинен бути налаштований раніше).

```bash
claude-flow switch <provider>
```

**Приклади:**

```bash
claude-flow switch deepseek
# Тепер eval $(claude-flow env) буде використовувати DeepSeek
```

---

### Providers

Список всіх доступних провайдерів із деталями.

```bash
claude-flow providers
```

**Вивід:**

```
  Available Providers

  ● openrouter       200+ models from every major provider through one API
     Auth: Bearer | Base: https://openrouter.ai/api | Key env: OPENROUTER_API_KEY
  ○ deepseek         DeepSeek models via native Anthropic-compatible API
     Auth: API key | Base: https://api.deepseek.com/anthropic | Key env: DEEPSEEK_API_KEY
  ○ openai           OpenAI models (GPT-4.1, o3, etc.)
     Auth: API key | Base: https://api.openai.com/v1 | Key env: OPENAI_API_KEY
  ○ gemini           Gemini models via OpenAI-compatible endpoint
     Auth: API key | Base: https://generativelanguage.googleapis.com/v1beta | Key env: GEMINI_API_KEY
  ○ custom           Any Anthropic-compatible API endpoint
     Auth: Bearer | Base: (custom) | Key env: CUSTOM_API_KEY

  ● = active provider
```

---

### Models

Перегляд доступних моделей для провайдера.

```bash
claude-flow models [provider]
```

Якщо провайдер опущено, показує моделі для активного провайдера.

**Приклад:**

```bash
claude-flow models openrouter
claude-flow models deepseek
```

---

### Version

Показати встановлену версію.

```bash
claude-flow --version
# або
claude-flow -v
```

---

## Як це працює

### Архітектура

```
Без claude-flow:
  Claude Code CLI → Anthropic API → Тільки моделі Claude
                                     (інші моделі недоступні)

З claude-flow:
  ┌─────────────┐    Anthropic    ┌──────────────────────┐    Рідний    ┌──────────────┐
  │ Claude Code │ ── Messages ──→ │ Anthropic-сумісний   │ ── API ───→ │ Будь-яка     │
  │ CLI         │    API формат   │ endpoint провайдера  │    виклик    │ модель       │
  │             │ ←─ Anthropic ── │                      │ ←─ Рідний ─ │ GPT, GLM,    │
  │             │    формат       │ ПЕРЕКЛАДАЄ відповіді │    формат    │ Llama, Qwen, │
  └─────────────┘                 │ між форматами        │              │ DeepSeek,    │
                                  └──────────────────────┘              │ Gemini, ...  │
                                            ▲                           └──────────────┘
                                   claude-flow налаштовує
                                   це з'єднання коректно
```

**Ключовий принцип:** Claude Code не спілкується з моделями безпосередньо. Він спілкується з **Anthropic-сумісним проксі-endpoint'ом**, який займається трансляцією форматів. OpenRouter перекладає 200+ моделей у формат Anthropic. Endpoint DeepSeek `/anthropic` робить те саме. claude-flow знає, який endpoint використовувати для кожного провайдера, і налаштовує з'єднання.

### Що провайдери роблять за лаштунками

Коли ви використовуєте `z-ai/glm-5` через OpenRouter:

1. Claude Code відправляє запит Anthropic Messages API на `https://openrouter.ai/api/v1/messages`
2. OpenRouter приймає запит, перекладає його у рідний формат GLM-5
3. GLM-5 обробляє і повертає відповідь у своєму форматі
4. OpenRouter **перекладає відповідь назад** у формат Anthropic Messages API
5. Claude Code отримує відповідь, яку розуміє — streaming-події, блоки контенту, tool_use, все працює

Без цього перекладу Claude Code отримує відповідь у неправильному форматі і падає.

### Змінні середовища

Claude Code читає ці змінні середовища для визначення того, який API використовувати:

| Змінна середовища | Призначення | Приклад |
|---------|---------|---------|
| `ANTHROPIC_BASE_URL` | API endpoint (куди йдуть запити) | `https://openrouter.ai/api` |
| `ANTHROPIC_AUTH_TOKEN` | Bearer токен (прокси-провайдери) | `sk-or-v1-...` |
| `ANTHROPIC_API_KEY` | API ключ (прямі провайдери) або `""` | `sk-...` або `""` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Модель швидкого рівня | `anthropic/claude-haiku-4-5-20251001` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Модель збалансованого рівня | `anthropic/claude-sonnet-4-6` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Модель потужного рівня | `anthropic/claude-opus-4-6` |

### Трюк з порожнім ключем

**`ANTHROPIC_API_KEY` повинна бути встановлена на порожній рядок (`""`) для прокси-провайдерів, а не відсутня.**

Це найчастіша точка відмови при налаштуванні Claude Code з альтернативними провайдерами.

#### Чому?

- Якщо `ANTHROPIC_API_KEY` **відсутня/невстановлена**: Claude Code видає помилку при його читанні
- Якщо `ANTHROPIC_API_KEY` **непорожна**: Claude Code використовує її й ігнорує `ANTHROPIC_AUTH_TOKEN`
- Якщо `ANTHROPIC_API_KEY` **порожний рядок (`""`)**: Claude Code повертається до `ANTHROPIC_AUTH_TOKEN`

#### Приклад: OpenRouter (використовує auth_token)

```bash
# ✓ ПРАВИЛЬНО — Claude Code використовує AUTH_TOKEN для OpenRouter
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
export ANTHROPIC_API_KEY=''  # Порожній рядок, не відсутній!
export ANTHROPIC_DEFAULT_SONNET_MODEL='anthropic/claude-sonnet-4-6'

# ✗ НЕПРАВИЛЬНО — Відсутній API_KEY, Claude Code видає помилку
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
# (ANTHROPIC_API_KEY взагалі не встановлена)

# ✗ НЕПРАВИЛЬНО — Непорожний API_KEY, Claude Code ігнорує AUTH_TOKEN
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
export ANTHROPIC_API_KEY='some-random-value'
```

#### Приклад: DeepSeek (використовує api_key напряму)

```bash
# ✓ ПРАВИЛЬНО — Claude Code використовує API_KEY для DeepSeek
export ANTHROPIC_BASE_URL='https://api.deepseek.com/anthropic'
export ANTHROPIC_API_KEY='sk-...'  # Справжній ключ
export ANTHROPIC_DEFAULT_SONNET_MODEL='deepseek-v3.2'
```

### Як claude-flow робить це правильно

Функція `buildEnv()` в `lib/env.js`:

1. **Обирає правильний endpoint** що забезпечує трансляцію форматів для кожного провайдера
2. **Для прокси-провайдерів** (OpenRouter): встановлює `ANTHROPIC_API_KEY = ""` та `ANTHROPIC_AUTH_TOKEN = apiKey`
3. **Для прямих провайдерів** (DeepSeek, OpenAI): встановлює `ANTHROPIC_API_KEY = apiKey` (їхні endpoint'и нативно приймають формат Anthropic)
4. **Маппить моделі на рівні** — встановлює `ANTHROPIC_DEFAULT_HAIKU/SONNET/OPUS_MODEL`
5. **Повертає повний об'єкт env** готовий для передачі до Claude Code — без гадання, без підводних каменів

---

## Конфігурація

Конфігурація зберігається в **`~/.claude-flow/config.json`** (дозволи 600 — тільки читання/запис власника).

### Формат файлу

```json
{
  "activeProvider": "openrouter",
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-v1-...",
      "models": {
        "haiku": "anthropic/claude-haiku-4-5-20251001",
        "sonnet": "anthropic/claude-sonnet-4-6",
        "opus": "anthropic/claude-opus-4-6"
      }
    },
    "deepseek": {
      "apiKey": "sk-...",
      "models": {
        "haiku": "deepseek-v3.2",
        "sonnet": "deepseek-v3.2",
        "opus": "deepseek-r1-0528"
      }
    }
  }
}
```

### Ручне редагування

Ви можете редагувати цей файл безпосередньо. Просто пам'ятайте:
- Тримайте його в безпеці (містить API ключі)
- Використовуйте валідний JSON
- Перезавантажте оболонку, щоб зміни вступили в силу

### Перевизначення змінною середовища

Ви також можете встановити API ключи через змінні середовища без використання файлу конфігурації:

```bash
export OPENROUTER_API_KEY='sk-or-v1-...'
export DEEPSEEK_API_KEY='sk-...'

# Потім користуйтесь claude-flow з цими ключами
claude-flow run -- claude -p "Привіт"
```

---

## JavaScript API

Використовуйте claude-flow як бібліотеку в ваших Node.js проектах (наприклад, Claude Code Studio, інструменти збірки, CI/CD).

### Встановлення

```bash
npm install claude-flow
```

### Огляд API

```javascript
const {
  buildEnv,
  toShellExports,
  mergeEnv,
  getProvider,
  listProviders,
  PROVIDERS,
  config,
} = require('claude-flow');
```

### `buildEnv(provider, opts)`

Побудувати змінні середовища для Claude Code.

**Аргументи:**
- `provider` (string): Назва провайдера (`openrouter`, `deepseek`, `openai`, `gemini`, `custom`)
- `opts` (object):
  - `apiKey` (string, обов'язково): API ключ провайдера
  - `haiku` (string): Модель для haiku рівня (перевизначає значення за замовчуванням)
  - `sonnet` (string): Модель для sonnet рівня (перевизначає значення за замовчуванням)
  - `opus` (string): Модель для opus рівня (перевизначає значення за замовчуванням)
  - `model` (string): Використовувати ту саму модель для всіх рівнів (скорочена форма)
  - `baseUrl` (string): Перевизначити API URL (тільки для власних провайдерів)

**Повертає:** Об'єкт зі змінними середовища

**Приклад:**

```javascript
const { buildEnv } = require('claude-flow');

// Використовуйте моделі за замовчуванням
const env = buildEnv('openrouter', {
  apiKey: 'sk-or-v1-abc123...'
});

console.log(env);
// {
//   ANTHROPIC_BASE_URL: 'https://openrouter.ai/api',
//   ANTHROPIC_AUTH_TOKEN: 'sk-or-v1-abc123...',
//   ANTHROPIC_API_KEY: '',
//   ANTHROPIC_DEFAULT_HAIKU_MODEL: 'anthropic/claude-haiku-4-5-20251001',
//   ANTHROPIC_DEFAULT_SONNET_MODEL: 'anthropic/claude-sonnet-4-6',
//   ANTHROPIC_DEFAULT_OPUS_MODEL: 'anthropic/claude-opus-4-6'
// }
```

**Власні моделі:**

```javascript
const env = buildEnv('openrouter', {
  apiKey: 'sk-or-v1-...',
  haiku: 'google/gemini-3-flash-preview',
  sonnet: 'deepseek/deepseek-v3.2',
  opus: 'openai/gpt-5.2'
});
```

**Одна модель для всіх рівнів:**

```javascript
const env = buildEnv('openrouter', {
  apiKey: 'sk-or-v1-...',
  model: 'deepseek/deepseek-v3.2'  // Всі рівні використовують це
});
```

**Власний endpoint:**

```javascript
const env = buildEnv('custom', {
  apiKey: 'sk-custom-key',
  baseUrl: 'https://your-proxy.local/v1',
  haiku: 'your-model-haiku',
  sonnet: 'your-model-sonnet',
  opus: 'your-model-opus'
});
```

---

### `mergeEnv(provider, opts)`

Побудувати змінні середовища провайдера та об'єднати їх із `process.env`. Повертає новий об'єкт (не змінює `process.env`).

Корисно для `spawn()` з власним env.

**Приклад:**

```javascript
const { spawn } = require('child_process');
const { mergeEnv } = require('claude-flow');

const env = mergeEnv('openrouter', {
  apiKey: 'sk-or-v1-...'
});

// Запустити Claude Code з OpenRouter
const child = spawn('claude', ['-p', 'Привіт!'], {
  env,  // Використовуйте об'єднане env
  stdio: 'inherit'
});
```

---

### `toShellExports(env)`

Форматувати змінні середовища як оператори експорту оболонки.

**Аргументи:**
- `env` (object): Об'єкт env від `buildEnv()`

**Повертає:** Рядок із операторами експорту (по одному на рядок)

**Приклад:**

```javascript
const { buildEnv, toShellExports } = require('claude-flow');

const env = buildEnv('openrouter', { apiKey: 'sk-or-v1-...' });
const shellScript = toShellExports(env);

console.log(shellScript);
// export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
// export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
// export ANTHROPIC_API_KEY=''
// export ANTHROPIC_DEFAULT_HAIKU_MODEL='anthropic/claude-haiku-4-5-20251001'
// export ANTHROPIC_DEFAULT_SONNET_MODEL='anthropic/claude-sonnet-4-6'
// export ANTHROPIC_DEFAULT_OPUS_MODEL='anthropic/claude-opus-4-6'
```

---

### `getProvider(name)`

Отримати конфігурацію провайдера за назвою.

**Аргументи:**
- `name` (string): Назва провайдера або псевдонім (`openrouter`, `or`, `deepseek`, `ds`, `openai`, `gpt`, `gemini`, `custom`)

**Повертає:** Об'єкт конфігурації провайдера, або `null` якщо невідомий

**Приклад:**

```javascript
const { getProvider } = require('claude-flow');

const provider = getProvider('openrouter');
console.log(provider);
// {
//   name: 'OpenRouter',
//   description: '200+ models from every major provider...',
//   envKey: 'OPENROUTER_API_KEY',
//   baseUrl: 'https://openrouter.ai/api',
//   auth: 'auth_token',
//   models: { haiku: '...', sonnet: '...', opus: '...' },
//   docsUrl: 'https://openrouter.ai/keys',
//   popularModels: [...]
// }
```

---

### `listProviders()`

Список всіх назв провайдерів (виключає псевдоніми).

**Повертає:** Масив назв провайдерів

**Приклад:**

```javascript
const { listProviders } = require('claude-flow');

console.log(listProviders());
// ['openrouter', 'deepseek', 'openai', 'gemini', 'custom']
```

---

### `PROVIDERS`

Прямий доступ до об'єкта конфігурацій провайдерів.

**Приклад:**

```javascript
const { PROVIDERS } = require('claude-flow');

console.log(PROVIDERS.openrouter.docsUrl);
// 'https://openrouter.ai/keys'

console.log(PROVIDERS.openrouter.popularModels);
// [{ id: 'anthropic/claude-sonnet-4-6', name: '...', tier: 'sonnet' }, ...]
```

---

### `config`

Управління файлом конфігурації (для інтеграції з іншими інструментами).

**Методи:**

- `config.load()` — Завантажити всю конфігурацію з диска
- `config.save(cfg)` — Зберегти конфігурацію на диск
- `config.getActiveProvider()` — Отримати назву активного провайдера
- `config.setActiveProvider(name)` — Встановити активного провайдера
- `config.getProviderConfig(name)` — Отримати налаштування провайдера
- `config.setProviderConfig(name, settings)` — Зберегти налаштування провайдера
- `config.getConfigPath()` — Отримати шлях до файлу конфігурації

**Приклад:**

```javascript
const { config } = require('claude-flow');

const activeProvider = config.getActiveProvider();
const settings = config.getProviderConfig(activeProvider);

console.log(settings.apiKey);    // Збережений API ключ
console.log(settings.models);    // { haiku: '...', sonnet: '...', opus: '...' }
```

---

## Приклади інтеграції

### Claude Code Studio

[Claude Code Studio](https://github.com/Lexus2016/claude-code-studio) використовує claude-flow, щоб дозволити вибір LLM провайдерів у UI.

```javascript
const { buildEnv, PROVIDERS } = require('claude-flow');

// У вашому додатку дозвольте користувачу вибрати провайдера
const selectedProvider = 'openrouter';
const apiKey = user.apiKeys[selectedProvider];

// Побудувати змінні середовища
const env = buildEnv(selectedProvider, { apiKey });

// Передати процесу Claude Code
spawn('claude', args, { env: mergeEnv(selectedProvider, { apiKey }) });
```

### Docker / CI-CD

Використовуйте claude-flow у контейнері Docker для маршрутизації до будь-якого LLM:

```dockerfile
FROM node:18-slim

RUN npm install -g claude-flow

WORKDIR /app
COPY . .

# Запустити Claude Code з провайдером з env
CMD ["sh", "-c", "eval $(claude-flow env) && claude -p 'Your prompt'"]
```

**Побудувати та запустити:**

```bash
docker build -t my-app .

docker run --env OPENROUTER_API_KEY='sk-or-v1-...' my-app
```

Або користуйтесь `docker-compose.yml`:

```yaml
version: '3'
services:
  app:
    build: .
    environment:
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      ANTHROPIC_DEFAULT_SONNET_MODEL: deepseek/deepseek-v3.2
```

### Профіль оболонки (постійний)

Додайте до вашого `~/.bashrc`, `~/.zshrc` або `~/.fish/config.fish`:

```bash
# Активуйте Claude Code провайдер
eval "$(claude-flow env)"
```

Тепер Claude Code буде використовувати ваш налаштований провайдер для кожного запиту у нових оболонках.

**Перезавантажте оболонку:**

```bash
source ~/.bashrc  # або ~/.zshrc, тощо
```

---

## Часті проблеми та рішення

### "Невідома команда"

Переконайтесь, що claude-flow встановлена та у вашому PATH:

```bash
which claude-flow
# Якщо пусто, встановіть:
npm install -g claude-flow
```

### "Немає активного провайдера"

Ви ще не запустили налаштування:

```bash
claude-flow setup openrouter
# або іншого провайдера
```

### "Немає API ключа для провайдера"

Провайдер налаштований, але API ключ не було збережено. Запустіть налаштування знову:

```bash
claude-flow setup openrouter
```

Або вручну додайте ключ до `~/.claude-flow/config.json`.

### Claude Code все ще використовує API Anthropic

Переконайтесь, що ви:
1. Запустили `claude-flow setup <provider>`
2. Або:
   - Запустили `eval $(claude-flow env)` у поточній оболонці
   - Або користуйтесь `claude-flow run -- claude ...` для одноразового запуску
   - Або додали `eval "$(claude-flow env)"` до профілю оболонки та перезавантажили

Перевірте активного провайдера:

```bash
claude-flow status
```

### "Ключ не починається з очікуваного префікса"

Це попередження, а не помилка. Це означає, що ваш API ключ не відповідає очікуваному формату для цього провайдера. Перевірте, що це правильний ключ:

- Ключі OpenRouter починаються з `sk-or-`
- Ключі DeepSeek починаються з `sk-`
- Ключі OpenAI починаються з `sk-`
- Ключі Gemini починаються з `AI`

Якщо ви впевнені, що це правильно, ви можете проігнорувати попередження.

### Власний провайдер не працює

Для власних endpoint'ів переконайтесь, що:
1. URL базису включає `/v1` або повний шлях до API (наприклад, `https://your-proxy.local/v1`)
2. ID моделей дійсні для вашого endpoint'а
3. Ваш API ключ правильний

Запустіть:

```bash
claude-flow status
```

І перевірте всі налаштування.

### Помилки, пов'язані з "ANTHROPIC_API_KEY"

Якщо Claude Code видає помилку "неправильний API ключ" або подібну, він може використовувати неправильний метод автентифікації. Перевірте, що ви налаштували:

```bash
claude-flow env
```

Подивіться на вивід:
- Якщо бачите `ANTHROPIC_AUTH_TOKEN` = (не пусто) та `ANTHROPIC_API_KEY` = `''` (порожні лапки) → Ви правильно використовуєте прокси-провайдер ✓
- Якщо бачите `ANTHROPIC_API_KEY` = (ваш ключ) та немає `ANTHROPIC_AUTH_TOKEN` → Ви використовуєте прямого провайдера ✓
- Якщо бачите обидва з значеннями → Є конфлікт, переналаштуйте

---

## Тестування

Запустіть набір тестів:

```bash
npm test
```

Тести охоплюють:
- Завантаження конфігурації провайдера
- Побудову змінних середовища для кожного провайдера
- Критичну поведінку "порожного рядка" для прокси-провайдерів
- Форматування експорту оболонки
- Перевизначення власних моделей
- Обробку помилок

Усі тести проходять без зовнішніх залежностей.

---

## Як допомогти

1. **Форк** репозиторію
2. **Створіть гілку** для вашої функції
3. **Напишіть тести** для нової функціональності
4. **Надішліть pull request**

### Додавання нового провайдера

1. Додайте до `PROVIDERS` в `lib/providers.js`
2. Включіть `name`, `description`, `envKey`, `baseUrl`, тип `auth`, значення за замовчуванням `models` та `docsUrl`
3. Додайте тестові випадки в `test/test.js`
4. Оновіть цей README розділом про провайдера

---

## Ліцензія

MIT — Див. файл LICENSE

---

## Пов'язані проекти

- **[Claude Code CLI](https://claude.ai/claude-code)** — CLI, який ми налаштовуємо
- **[Claude Code Studio](https://github.com/Lexus2016/claude-code-studio)** — IDE, який використовує claude-flow
- **[OpenRouter](https://openrouter.ai)** — Доступ до 200+ моделей
- **[DeepSeek Platform](https://platform.deepseek.com)** — Надешеві моделі міркування

---

## Підтримка

- **GitHub Issues:** Повідомляйте про помилки або запитуйте функції на https://github.com/Lexus2016/claude-flow/issues
- **Discussions:** https://github.com/Lexus2016/claude-flow/discussions
- **Автор:** CDZV — Code Zero Digital Visual Trading

---

Зроблено з любов'ю для розробників, які хочуть використовувати будь-який LLM з Claude Code.
