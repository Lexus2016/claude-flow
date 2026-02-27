# claude-flow

**Мост между любой AI моделью и Claude Code CLI** — маршрутизация через OpenRouter, DeepSeek, OpenAI, Gemini или любой Anthropic-совместимый endpoint.

![Node](https://img.shields.io/badge/node-%3E%3D18.0-green) ![Лицензия](https://img.shields.io/badge/license-MIT-blue) ![Нулевых зависимостей](https://img.shields.io/badge/dependencies-0-success)

Доступно на: [English](README.md) | [Українська](README_UA.md) | **Русский**

---

## Проблема

Claude Code CLI жёстко привязан к API Anthropic. Он отправляет запросы в формате Anthropic Messages API, ожидает ответы в том же формате и аутентифицируется методом Anthropic. Если вы хотите использовать **любую другую модель** — DeepSeek, GPT-4, Gemini, GLM, Llama, Qwen — вы упираетесь в три стены:

### 1. Несовместимость форматов ответов

Каждый AI-провайдер имеет свой формат API. DeepSeek, OpenAI и Gemini используют OpenAI-совместимый формат. Китайские модели (GLM, Qwen) имеют собственные API. Open-source модели (Llama, Mistral) имеют уникальную структуру ответов.

Claude Code ожидает **конкретные** streaming-события Anthropic (`content_block_delta`), типы контентных блоков, структуры `tool_use`, значения `stop_reason` и поля подсчёта токенов. Отправьте ему сырой ответ DeepSeek или OpenAI — он упадёт.

**Решение:** Провайдеры вроде **OpenRouter** и **DeepSeek** предлагают **Anthropic-совместимые прокси-endpoint'ы** — они принимают запросы в формате Anthropic, маршрутизируют их к любой модели и **переводят ответ обратно** в формат Anthropic. claude-flow знает, какие именно endpoint'ы использовать для каждого провайдера.

### 2. Ловушка аутентификации

Аутентификация Claude Code имеет **недокументированную особенность**: `ANTHROPIC_API_KEY` должна быть установлена на **пустую строку** (`""`) для прокси-провайдеров — не отсутствовать, не быть удалённой. Именно пустая строка.

- Если `ANTHROPIC_API_KEY` **отсутствует** → Claude Code падает при запуске
- Если `ANTHROPIC_API_KEY` **непустая** → Claude Code использует её и молча игнорирует ваш прокси-токен
- Если `ANTHROPIC_API_KEY` **`""`** → Claude Code переходит на `ANTHROPIC_AUTH_TOKEN` ✓

Разные провайдеры также используют разные методы аутентификации — Bearer токен (OpenRouter) vs. API ключ (DeepSeek, OpenAI). Ошибка в любом из этого приводит к тихим сбоям.

### 3. Сложность конфигурации

6 переменных окружения, ноль официальной документации, разные комбинации для каждого провайдера и неочевидное поведение. Одна неправильная настройка = Claude Code либо падает, либо молча общается с неправильным endpoint'ом.

**claude-flow решает все три проблемы.** Одна команда корректно настраивает всё для любого провайдера.

---

## Быстрый старт

```bash
# Установка
npm install -g claude-flow

# Интерактивная настройка провайдера
claude-flow setup openrouter

# Запуск Claude Code
eval $(claude-flow env)
claude -p "Hello from OpenRouter!"
```

Готово. Теперь Claude Code использует ваш провайдер для каждого вызова.

---

## Установка

### Вариант 1: Глобальная установка через NPM (рекомендуется)

```bash
npm install -g claude-flow
```

### Вариант 2: Запуск без установки (npx)

```bash
npx claude-flow setup openrouter
npx claude-flow run -- claude -p "Привет!"
```

### Вариант 3: Клонирование и локальное использование

```bash
git clone https://github.com/Lexus2016/claude-flow.git
cd claude-flow
node bin/claude-flow.js setup openrouter
```

### Требования

- **Node.js** >= 18.0
- **Claude Code CLI** (от Anthropic) — [установить отсюда](https://claude.ai/claude-code)
- API ключ для выбранного провайдера (см. [Поддерживаемые провайдеры](#поддерживаемые-провайдеры))

---

## Пошаговая настройка

### 1. Установите claude-flow

```bash
npm install -g claude-flow
```

### 2. Запустите интерактивный мастер настройки

```bash
claude-flow setup openrouter
```

Вас попросят:
- Ввести ваш API ключ провайдера (например, `sk-or-v1-...`)
- Выбрать модели для каждого уровня (haiku, sonnet, opus) — или нажать Enter для значений по умолчанию

**Пример сеанса:**

```
  claude-flow — Setup OpenRouter

  Get your API key: https://openrouter.ai/keys

  API Key: sk-or-v1-abc123def456...

  Model configuration (press Enter for defaults)

  Claude Code uses 3 model tiers: haiku (fast), sonnet (balanced), opus (powerful)

  Popular models for OpenRouter:
    anthropic/claude-opus-4-6                Claude Opus 4.6          opus
    anthropic/claude-sonnet-4-6              Claude Sonnet 4.6        sonnet
    anthropic/claude-haiku-4-5-20251001      Claude Haiku 4.5         haiku
    google/gemini-3.1-pro-preview            Gemini 3.1 Pro           opus
    google/gemini-3-flash-preview            Gemini 3 Flash           sonnet

  Haiku model  [anthropic/claude-haiku-4-5-20251001]:
  Sonnet model [anthropic/claude-sonnet-4-6]:
  Opus model   [anthropic/claude-opus-4-6]:

  ✓ Configuration saved to /Users/you/.claude-flow/config.json
  ✓ Active provider: OpenRouter

  Environment variables (what Claude Code will use):

    ANTHROPIC_BASE_URL                 https://openrouter.ai/api
    ANTHROPIC_AUTH_TOKEN              sk-or-v1-abc...
    ANTHROPIC_API_KEY                 ""  ← умышленно пусто
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

### 3. Используйте Claude Code с вашим провайдером

Выберите один из трех методов:

#### Метод 1: Прямой запуск (рекомендуется для одноразовых команд)

```bash
claude-flow run -- claude -p "Какая сейчас погода?"
```

#### Метод 2: Eval в текущей оболочке (рекомендуется для интерактивной работы)

```bash
eval $(claude-flow env)
claude -p "Создай мне React компонент"
```

#### Метод 3: Добавьте в профиль оболочки (рекомендуется для постоянной настройки)

```bash
# Добавьте в ~/.bashrc, ~/.zshrc или ~/.fish/config.fish
echo 'eval "$(claude-flow env)"' >> ~/.bashrc

# Затем перезагрузите оболочку
source ~/.bashrc

# Теперь Claude Code работает везде
claude -p "Привет!"
```

---

## Поддерживаемые провайдеры

### Быстрое сравнение

| Провайдер | Выбор моделей | Стоимость | Настройка | Популярен для |
|-----------|---------------|-----------|-----------|--------------|
| **OpenRouter** | 200+ моделей от всех провайдеров | Варьируется | Легко | Один API для всего |
| **DeepSeek** | V3.2, R1 (рассуждение) | Самый дешевый | Легко | Экономное рассуждение |
| **OpenAI** | GPT-5.2, o3 | Премиум | Легко | Передовые модели |
| **Gemini** | Gemini 3.1 Pro / 3 Flash | Конкурентный | Легко | Быстрый вывод |
| **Custom** | Любой Anthropic-совместимый endpoint | Варьируется | Ручная | Самохостинг, приватные облака |

---

## Детали провайдеров

### OpenRouter

**Получите доступ к 200+ моделям через один API endpoint.**

Идеально, если вы хотите гибкость — используйте Claude, GPT-4, DeepSeek, Gemini, Llama, Qwen и многое другое с одним ключом. Платите за использование.

**Получить API ключ:** https://openrouter.ai/keys

**Настройка:**

```bash
claude-flow setup openrouter
```

**Модели по умолчанию:**
- Haiku: `anthropic/claude-haiku-4-5-20251001`
- Sonnet: `anthropic/claude-sonnet-4-6`
- Opus: `anthropic/claude-opus-4-6`

**Популярные модели для попробования:**

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

**Используйте разные модели для каждого уровня:**

```bash
claude-flow setup openrouter

# При появлении приглашения:
# Haiku model: google/gemini-3-flash-preview
# Sonnet model: deepseek/deepseek-v3.2
# Opus model: openai/gpt-5.2
```

---

### DeepSeek

**Ультрабыстро и дешево. Отлично для задач рассуждения.**

DeepSeek V3.2 (быстрый, гибридное мышление) и R1 через их родной API. Стоимость в несколько центов.

**Получить API ключ:** https://platform.deepseek.com/api_keys

**Настройка:**

```bash
claude-flow setup deepseek
```

**Модели по умолчанию:**
- Haiku: `deepseek-v3.2`
- Sonnet: `deepseek-v3.2`
- Opus: `deepseek-r1-0528`

**Почему использовать DeepSeek?**
- Самая дешевая цена на LLM среди доступных
- DeepSeek R1 лучше GPT-4 по многим тестам
- Родной API (без переплаты на прокси)

**Используйте R1 для рассуждения:**

```bash
claude-flow setup deepseek
# При появлении приглашения для Sonnet и Opus используйте: deepseek-r1-0528
```

---

### OpenAI

**Последние модели GPT, включая o3.**

GPT-5.2 (флагман), GPT-5.2 Thinking и o3 через официальный API OpenAI.

**Получить API ключ:** https://platform.openai.com/api-keys

**Настройка:**

```bash
claude-flow setup openai
```

**Модели по умолчанию:**
- Haiku: `gpt-5.2-mini`
- Sonnet: `gpt-5.2`
- Opus: `gpt-5.2`

**Популярные модели:**

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

**Последние модели Google. Быстрые и способные.**

Gemini 3.1 Pro (новейший), Gemini 3 Flash и 2.5 через API Google.

**Получить API ключ:** https://aistudio.google.com/apikey

**Настройка:**

```bash
claude-flow setup gemini
```

**Модели по умолчанию:**
- Haiku: `gemini-3-flash-preview`
- Sonnet: `gemini-3-flash-preview`
- Opus: `gemini-3.1-pro-preview`

---

### Пользовательский провайдер

**Любой Anthropic-совместимый endpoint (самохостинг, приватные облака и т.д.).**

Если у вас есть собственный Claude-совместимый endpoint или вы хотите использовать провайдера, не указанного выше:

```bash
claude-flow setup custom
```

Вас попросят:
- API базовый URL (например, `https://your-proxy.local/v1`)
- ID моделей
- API ключ

---

## Справочник CLI

### Справка

```bash
claude-flow help
```

Показывает все команды и примеры.

---

### Setup

```bash
claude-flow setup <provider>
```

Интерактивный мастер настройки. Помогает получить API ключ и выбрать модели.

**Провайдеры:** `openrouter`, `deepseek`, `openai`, `gemini`, `custom`

**Примеры:**

```bash
claude-flow setup openrouter
claude-flow setup deepseek
claude-flow setup openai
```

---

### Env

Выведите выражения экспорта оболочки. Используется для eval или добавления в профиль оболочки.

```bash
# Выведите на stdout (удобно копировать)
claude-flow env

# Или используйте в команде
eval $(claude-flow env)

# Или для конкретного провайдера
claude-flow env deepseek
eval $(claude-flow env deepseek)
```

**Пример вывода:**

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

Запустите команду с установленными переменными окружения провайдера.

```bash
claude-flow run -- <command> [args...]
```

Разделитель `--` важен — все после него является вашей командой.

**Примеры:**

```bash
# Запустите Claude Code один раз с OpenRouter
claude-flow run -- claude -p "Hello from OpenRouter!"

# Запустите с другим провайдером
claude-flow run deepseek -- claude -p "Use DeepSeek for this"

# Запустите любую команду (не только Claude)
claude-flow run -- node my-script.js
claude-flow run -- python my-app.py

# Цепочка с другими командами
claude-flow run -- bash -c 'echo $ANTHROPIC_BASE_URL && claude -p "Test"'
```

---

### Status

Показывает текущую конфигурацию и активный провайдер.

```bash
claude-flow status
```

**Пример вывода:**

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

Переключитесь на другого провайдера (должен быть настроен первым).

```bash
claude-flow switch <provider>
```

**Примеры:**

```bash
claude-flow switch deepseek
# Теперь eval $(claude-flow env) будет использовать DeepSeek
```

---

### Providers

Список всех доступных провайдеров с деталями.

```bash
claude-flow providers
```

**Вывод:**

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

Просмотрите доступные модели для провайдера.

```bash
claude-flow models [provider]
```

Если провайдер опущен, показывает модели активного провайдера.

**Пример:**

```bash
claude-flow models openrouter
claude-flow models deepseek
```

---

### Version

Показывает установленную версию.

```bash
claude-flow --version
# или
claude-flow -v
```

---

## Как это работает

### Архитектура

```
Без claude-flow:
  Claude Code CLI → Anthropic API → Только модели Claude
                                     (другие модели недоступны)

С claude-flow:
  ┌─────────────┐    Anthropic    ┌──────────────────────┐    Родной    ┌──────────────┐
  │ Claude Code │ ── Messages ──→ │ Anthropic-совместимый │ ── API ───→ │ Любая модель │
  │ CLI         │    API формат   │ endpoint провайдера  │    вызов     │              │
  │             │ ←─ Anthropic ── │                      │ ←─ Родной ─ │ GPT, GLM,    │
  │             │    формат       │ ПЕРЕВОДИТ ответы     │    формат    │ Llama, Qwen, │
  └─────────────┘                 │ между форматами      │              │ DeepSeek,    │
                                  └──────────────────────┘              │ Gemini, ...  │
                                            ▲                           └──────────────┘
                                   claude-flow настраивает
                                   это соединение корректно
```

**Ключевой принцип:** Claude Code не общается с моделями напрямую. Он общается с **Anthropic-совместимым прокси-endpoint'ом**, который занимается трансляцией форматов. OpenRouter переводит 200+ моделей в формат Anthropic. Endpoint DeepSeek `/anthropic` делает то же самое. claude-flow знает, какой endpoint использовать для каждого провайдера, и настраивает соединение.

### Что провайдеры делают за кулисами

Когда вы используете `z-ai/glm-5` через OpenRouter:

1. Claude Code отправляет запрос Anthropic Messages API на `https://openrouter.ai/api/v1/messages`
2. OpenRouter принимает запрос, переводит его в родной формат GLM-5
3. GLM-5 обрабатывает и возвращает ответ в своём формате
4. OpenRouter **переводит ответ обратно** в формат Anthropic Messages API
5. Claude Code получает ответ, который понимает — streaming-события, блоки контента, tool_use, всё работает

Без этого перевода Claude Code получает ответ в неправильном формате и падает.

### Переменные окружения

Claude Code читает эти переменные окружения, чтобы определить, какой API использовать:

| Переменная | Назначение | Пример |
|-----------|-----------|---------|
| `ANTHROPIC_BASE_URL` | API endpoint (куда идут запросы) | `https://openrouter.ai/api` |
| `ANTHROPIC_AUTH_TOKEN` | Bearer токен (провайдеры-прокси) | `sk-or-v1-...` |
| `ANTHROPIC_API_KEY` | API ключ (прямые провайдеры) или `""` | `sk-...` или `""` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Модель быстрого уровня | `anthropic/claude-haiku-4-5-20251001` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Сбалансированная модель | `anthropic/claude-sonnet-4-6` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Мощная модель | `anthropic/claude-opus-4-6` |

### Трюк с пустым ключом

**`ANTHROPIC_API_KEY` должна быть установлена на пустую строку (`""`) для провайдеров-прокси, а не отсутствовать.**

Это самая частая точка отказа при настройке Claude Code с альтернативными провайдерами.

#### Почему?

- Если `ANTHROPIC_API_KEY` **отсутствует/не установлена**: Claude Code выдает ошибку при попытке прочитать её
- Если `ANTHROPIC_API_KEY` **непустая**: Claude Code использует её и игнорирует `ANTHROPIC_AUTH_TOKEN`
- Если `ANTHROPIC_API_KEY` **пустая строка (`""`)**: Claude Code переходит на `ANTHROPIC_AUTH_TOKEN`

#### Пример: OpenRouter (использует auth_token)

```bash
# ✓ ПРАВИЛЬНО — Claude Code использует AUTH_TOKEN для OpenRouter
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
export ANTHROPIC_API_KEY=''  # Пустая строка, не отсутствует!
export ANTHROPIC_DEFAULT_SONNET_MODEL='anthropic/claude-sonnet-4-6'

# ✗ НЕПРАВИЛЬНО — Отсутствует API_KEY, Claude Code выдает ошибку
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
# (ANTHROPIC_API_KEY вообще не установлена)

# ✗ НЕПРАВИЛЬНО — Непустая API_KEY, Claude Code игнорирует AUTH_TOKEN
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
export ANTHROPIC_API_KEY='some-random-value'
```

#### Пример: DeepSeek (использует api_key напрямую)

```bash
# ✓ ПРАВИЛЬНО — Claude Code использует API_KEY для DeepSeek
export ANTHROPIC_BASE_URL='https://api.deepseek.com/anthropic'
export ANTHROPIC_API_KEY='sk-...'  # Актуальный ключ
export ANTHROPIC_DEFAULT_SONNET_MODEL='deepseek-v3.2'
```

### Как claude-flow делает это правильно

Функция `buildEnv()` в `lib/env.js`:

1. **Выбирает правильный endpoint** обеспечивающий трансляцию форматов для каждого провайдера
2. **Для провайдеров-прокси** (OpenRouter): Устанавливает `ANTHROPIC_API_KEY = ""` и `ANTHROPIC_AUTH_TOKEN = apiKey`
3. **Для прямых провайдеров** (DeepSeek, OpenAI): Устанавливает `ANTHROPIC_API_KEY = apiKey` (их endpoint'ы нативно принимают формат Anthropic)
4. **Маппит модели на уровни** — устанавливает `ANTHROPIC_DEFAULT_HAIKU/SONNET/OPUS_MODEL`
5. **Возвращает полный объект env** готовый передать Claude Code — без догадок, без подводных камней

---

## Конфигурация

Конфигурация хранится в **`~/.claude-flow/config.json`** (права доступа 600 — только чтение/запись владельца).

### Формат файла

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

### Ручное редактирование

Вы можете редактировать этот файл напрямую. Просто помните:
- Держите его в безопасности (содержит API ключи)
- Используйте валидный JSON
- Перезагрузите вашу оболочку для вступления изменений в силу

### Переопределение переменной окружения

Вы также можете установить API ключи через переменные окружения без использования файла конфигурации:

```bash
export OPENROUTER_API_KEY='sk-or-v1-...'
export DEEPSEEK_API_KEY='sk-...'

# Затем используйте claude-flow с этими ключами
claude-flow run -- claude -p "Hello"
```

---

## JavaScript API

Используйте claude-flow как библиотеку в ваших Node.js проектах (например, Claude Code Studio, инструменты сборки, CI/CD).

### Установка

```bash
npm install claude-flow
```

### Обзор API

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

Постройте переменные окружения для Claude Code.

**Аргументы:**
- `provider` (string): Имя провайдера (`openrouter`, `deepseek`, `openai`, `gemini`, `custom`)
- `opts` (object):
  - `apiKey` (string, требуется): API ключ провайдера
  - `haiku` (string): Модель для уровня haiku (переопределяет по умолчанию)
  - `sonnet` (string): Модель для уровня sonnet (переопределяет по умолчанию)
  - `opus` (string): Модель для уровня opus (переопределяет по умолчанию)
  - `model` (string): Используйте одну модель для всех уровней (сокращение)
  - `baseUrl` (string): Переопределить API базовый URL (только пользовательские провайдеры)

**Возвращает:** Объект с переменными env

**Пример:**

```javascript
const { buildEnv } = require('claude-flow');

// Используйте модели по умолчанию
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

**Пользовательские модели:**

```javascript
const env = buildEnv('openrouter', {
  apiKey: 'sk-or-v1-...',
  haiku: 'google/gemini-3-flash-preview',
  sonnet: 'deepseek/deepseek-v3.2',
  opus: 'openai/gpt-5.2'
});
```

**Одна модель для всех уровней:**

```javascript
const env = buildEnv('openrouter', {
  apiKey: 'sk-or-v1-...',
  model: 'deepseek/deepseek-v3.2'  // Все уровни используют это
});
```

**Пользовательский endpoint:**

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

Постройте переменные env провайдера и объедините их в `process.env`. Возвращает новый объект (не мутирует `process.env`).

Полезно для `spawn()` с пользовательским env.

**Пример:**

```javascript
const { spawn } = require('child_process');
const { mergeEnv } = require('claude-flow');

const env = mergeEnv('openrouter', {
  apiKey: 'sk-or-v1-...'
});

// Запустите Claude Code с OpenRouter
const child = spawn('claude', ['-p', 'Hello!'], {
  env,  // Используйте объединённый env
  stdio: 'inherit'
});
```

---

### `toShellExports(env)`

Отформатируйте переменные env как выражения экспорта оболочки.

**Аргументы:**
- `env` (object): Объект env из `buildEnv()`

**Возвращает:** Строка с экспортами оболочки (один на строку)

**Пример:**

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

Получите конфигурацию провайдера по имени.

**Аргументы:**
- `name` (string): Имя провайдера или псевдоним (`openrouter`, `or`, `deepseek`, `ds`, `openai`, `gpt`, `gemini`, `custom`)

**Возвращает:** Объект конфигурации провайдера или `null` если неизвестен

**Пример:**

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

Список всех имён провайдеров (исключает псевдонимы).

**Возвращает:** Массив имён провайдеров

**Пример:**

```javascript
const { listProviders } = require('claude-flow');

console.log(listProviders());
// ['openrouter', 'deepseek', 'openai', 'gemini', 'custom']
```

---

### `PROVIDERS`

Прямой доступ к объекту конфигураций провайдеров.

**Пример:**

```javascript
const { PROVIDERS } = require('claude-flow');

console.log(PROVIDERS.openrouter.docsUrl);
// 'https://openrouter.ai/keys'

console.log(PROVIDERS.openrouter.popularModels);
// [{ id: 'anthropic/claude-sonnet-4-6', name: '...', tier: 'sonnet' }, ...]
```

---

### `config`

Управление файлом конфигурации (для интеграции с другими инструментами).

**Методы:**

- `config.load()` — Загрузить всю конфигурацию с диска
- `config.save(cfg)` — Сохранить конфигурацию на диск
- `config.getActiveProvider()` — Получить имя активного провайдера
- `config.setActiveProvider(name)` — Установить активного провайдера
- `config.getProviderConfig(name)` — Получить настройки для провайдера
- `config.setProviderConfig(name, settings)` — Сохранить настройки для провайдера
- `config.getConfigPath()` — Получить путь файла конфигурации

**Пример:**

```javascript
const { config } = require('claude-flow');

const activeProvider = config.getActiveProvider();
const settings = config.getProviderConfig(activeProvider);

console.log(settings.apiKey);    // Сохранённый API ключ
console.log(settings.models);    // { haiku: '...', sonnet: '...', opus: '...' }
```

---

## Примеры интеграции

### Claude Code Studio

[Claude Code Studio](https://github.com/Lexus2016/claude-code-studio) использует claude-flow чтобы позволить выбрать провайдеров LLM в UI.

```javascript
const { buildEnv, PROVIDERS } = require('claude-flow');

// В вашем приложении позволить пользователю выбрать провайдера
const selectedProvider = 'openrouter';
const apiKey = user.apiKeys[selectedProvider];

// Постройте переменные env
const env = buildEnv(selectedProvider, { apiKey });

// Передайте на subprocess Claude Code
spawn('claude', args, { env: mergeEnv(selectedProvider, { apiKey }) });
```

### Docker / CI-CD

Используйте claude-flow в вашем Docker контейнере для маршрутизации к любому LLM:

```dockerfile
FROM node:18-slim

RUN npm install -g claude-flow

WORKDIR /app
COPY . .

# Запустите Claude Code с провайдером из env
CMD ["sh", "-c", "eval $(claude-flow env) && claude -p 'Your prompt'"]
```

**Сборка и запуск:**

```bash
docker build -t my-app .

docker run --env OPENROUTER_API_KEY='sk-or-v1-...' my-app
```

Или используйте `docker-compose.yml`:

```yaml
version: '3'
services:
  app:
    build: .
    environment:
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      ANTHROPIC_DEFAULT_SONNET_MODEL: deepseek/deepseek-v3.2
```

### Профиль оболочки (постоянный)

Добавьте в ваш `~/.bashrc`, `~/.zshrc` или `~/.fish/config.fish`:

```bash
# Активируйте провайдера Claude Code
eval "$(claude-flow env)"
```

Теперь Claude Code будет использовать ваш настроенный провайдер для каждого вызова в новых оболочках.

**Перезагрузите вашу оболочку:**

```bash
source ~/.bashrc  # или ~/.zshrc, и т.д.
```

---

## Устранение неполадок

### "Unknown command"

Убедитесь, что claude-flow установлен и находится в вашем PATH:

```bash
which claude-flow
# Если пусто, установите:
npm install -g claude-flow
```

### "No active provider"

Вы ещё не запустили setup:

```bash
claude-flow setup openrouter
# или другого провайдера
```

### "No API key for provider"

Провайдер настроен, но API ключ не был сохранён. Запустите setup снова:

```bash
claude-flow setup openrouter
```

Или вручную добавьте ключ в `~/.claude-flow/config.json`.

### Claude Code всё ещё использует API Anthropic

Убедитесь, что вы:
1. Запустили `claude-flow setup <provider>`
2. Либо:
   - Запустили `eval $(claude-flow env)` в текущей оболочке
   - Или используйте `claude-flow run -- claude ...` чтобы запустить Claude Code один раз
   - Или добавьте `eval "$(claude-flow env)"` в профиль оболочки и перезагрузитесь

Проверьте активного провайдера:

```bash
claude-flow status
```

### "Key doesn't start with expected prefix"

Это предупреждение, не ошибка. Это значит, что ваш API ключ не соответствует ожидаемому формату для этого провайдера. Дважды проверьте, что это правильный ключ:

- Ключи OpenRouter начинаются с `sk-or-`
- Ключи DeepSeek начинаются с `sk-`
- Ключи OpenAI начинаются с `sk-`
- Ключи Gemini начинаются с `AI`

Если вы уверены, что он правильный, вы можете проигнорировать предупреждение.

### Custom провайдер не работает

Для пользовательских endpoint убедитесь:
1. Базовый URL включает `/v1` или полный путь к API (например, `https://your-proxy.local/v1`)
2. ID модели валидны для вашего endpoint
3. Ваш API ключ правильный

Запустите:

```bash
claude-flow status
```

И проверьте все настройки.

### Ошибки, связанные с "ANTHROPIC_API_KEY"

Если Claude Code выдает ошибку с "invalid API key" или похожее, он может использовать неправильный метод аутентификации. Проверьте что вы настроили:

```bash
claude-flow env
```

Посмотрите на вывод:
- Если вы видите `ANTHROPIC_AUTH_TOKEN` = (не пусто) и `ANTHROPIC_API_KEY` = `''` (пустые кавычки) → Вы правильно используете провайдер-прокси ✓
- Если вы видите `ANTHROPIC_API_KEY` = (ваш ключ) и нет `ANTHROPIC_AUTH_TOKEN` → Вы используете прямого провайдера ✓
- Если вы видите оба с значениями → Есть конфликт, переконфигурируйте

---

## Тестирование

Запустите набор тестов:

```bash
npm test
```

Тесты охватывают:
- Загрузку конфигурации провайдера
- Построение переменных окружения для каждого провайдера
- Критическое поведение "пустой строки" для провайдеров-прокси
- Форматирование экспортов оболочки
- Переопределения пользовательских моделей
- Обработку ошибок

Все тесты проходят без внешних зависимостей.

---

## Как внести вклад

1. **Fork** репозиторий
2. **Создайте ветку** для вашей функции
3. **Напишите тесты** для новой функциональности
4. **Отправьте pull request**

### Добавление нового провайдера

1. Добавьте в `PROVIDERS` в `lib/providers.js`
2. Включите `name`, `description`, `envKey`, `baseUrl`, тип `auth`, модели по умолчанию и `docsUrl`
3. Добавьте тестовые случаи в `test/test.js`
4. Обновите этот README с разделом провайдера

---

## Лицензия

MIT — См. файл LICENSE

---

## Связанные проекты

- **[Claude Code CLI](https://claude.ai/claude-code)** — CLI который мы конфигурируем
- **[Claude Code Studio](https://github.com/Lexus2016/claude-code-studio)** — IDE которая использует claude-flow
- **[OpenRouter](https://openrouter.ai)** — Доступ к 200+ моделям
- **[DeepSeek Platform](https://platform.deepseek.com)** — Ультра-дешёвые модели рассуждения

---

## Поддержка

- **GitHub Issues:** Сообщайте об ошибках или запрашивайте функции на https://github.com/Lexus2016/claude-flow/issues
- **Discussions:** https://github.com/Lexus2016/claude-flow/discussions
- **Автор:** CDZV — Code Zero Digital Visual Trading

---

Создано с любовью для разработчиков, которые хотят использовать любой LLM с Claude Code.
