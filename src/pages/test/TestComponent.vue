<template>
    <div class="recorder">
        <!-- Ввод текста -->
        <input type="text" placeholder="Начните вводить текст..." @keydown="handleKeydown" ref="inputRef" />
        <p>AFK время: {{ idleTime }} мс</p>

        <!-- Кнопки управления записями -->
        <button @click="startNewRecording">Начать новую запись</button>
        <button @click="startReplay" :disabled="isReplaying">Воспроизвести запись</button>
        <button @click="pauseReplay" v-if="isReplaying && !isPaused">Пауза</button>
        <button @click="resumeReplay" v-if="isPaused">Продолжить</button>
        <button @click="exportKeystrokes">Экспортировать запись</button>
        <button @click="exportAllData">Экспортировать все записи в JSON</button>
        <button @click="importData">Импортировать JSON</button>
        <input type="file" @change="handleFileImport" ref="fileInput" style="display: none" />

        <!-- Список записей и воспроизведение -->
        <div class="replay">
            <select v-model.number="selectedRecordingId" @change="loadKeystrokes">
                <option v-for="recording in recordings" :key="recording.id" :value="recording.id">
                    {{ recording.name }}
                </option>
            </select>
            <p>Воспроизведение: 
                <span v-for="(char, index) in replayedTextArray" :key="index" :style="{ color: getColorBySpeed(char.interval) }">
                    {{ char.key }}
                </span>
            </p>
        </div>
        
        <!-- Экспортированные данные -->
        <div class="export">
            <h3>Экспортированные данные:</h3>
            <pre>{{ exportedData }}</pre>
        </div>
    </div>
</template>
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import Dexie from 'dexie';

interface Recording {
    id?: number;
    name: string;
    createdAt: Date;
}

interface AddKeyStroke {
    key: string;
    interval: number;
    action: 'add';
}

interface RemoveKeyStroke {
    key: string;
    interval: number;
    action: 'remove';
}

interface RemoveWordKeyStroke {
    key: string;
    interval: number;
    action: 'removeWord';
    word: string;
}

type KeyStroke = AddKeyStroke | RemoveKeyStroke | RemoveWordKeyStroke;

const db = new Dexie('KeystrokesDB');
db.version(1).stores({
    recordings: '++id, name, createdAt',
    keystrokes: '++id, recordingId, interval, action, key, word',
});

// Состояния
const keystrokes = ref<KeyStroke[]>([]);
const idleTime = ref(0);
const replayedText = ref('');
const replayedTextArray = ref<{ key: string, interval: number }[]>([]);
const exportedData = ref<string>('');
const recordings = ref<Recording[]>([]);
const selectedRecordingId = ref<number | null>(null);
let lastTimestamp = Date.now();
let currentRecordingId: number | null = null;
const inputRef = ref<HTMLInputElement | null>(null);
let isHandlingKeydown = false;
let isRecordingStarted = ref(false);
let isReplaying = ref(false);
let isPaused = ref(false);
let replayIndex = 0;
let pauseTimeoutId: number | null = null;

// Функция запуска новой записи
const startNewRecording = async () => {
    const name = `Запись ${new Date().toLocaleString()}`;
    const id = await db.table('recordings').add({ name, createdAt: new Date() });

    currentRecordingId = Number(id);
    keystrokes.value = [];
    loadRecordings();
    isRecordingStarted.value = true;
    lastTimestamp = Date.now();
};

// Функция обработки нажатий клавиш
const handleKeydown = async (event: KeyboardEvent) => {
    if (isHandlingKeydown || currentRecordingId === null || !isRecordingStarted.value) return;

    isHandlingKeydown = true;

    const now = Date.now();
    const interval = now - lastTimestamp;
    let stroke: KeyStroke | null = null;

    if (event.ctrlKey && event.key === 'Backspace') {
        const words = inputRef.value?.value.trim().split(' ');
        if (words && words.length > 0) {
            const lastWord = words.pop()!;
            stroke = { key: '', interval, action: 'removeWord', word: lastWord };
        }
    } else if (event.key.length === 1 || event.key === ' ') {
        stroke = { key: event.key, interval, action: 'add' };
        idleTime.value = 0;
    } else if (event.key === 'Backspace') {
        if (inputRef.value!.value.length > 0) {
            stroke = { key: '', interval, action: 'remove' };
        }
    }

    if (stroke) {
        await db.table('keystrokes').add({ ...stroke, recordingId: currentRecordingId });
        lastTimestamp = now;
    }

    setTimeout(() => {
        isHandlingKeydown = false;
    }, 0);
};

// Таймер AFK
const checkAfkTime = () => {
    if (isRecordingStarted.value) {
        idleTime.value += 1000;
    }
};
const replayFromCurrentIndex = async (allKeystrokes: KeyStroke[]) => {
    const replayNext = () => {
        if (replayIndex < allKeystrokes.length && !isPaused.value) {
            const stroke = allKeystrokes[replayIndex];
            const interval = stroke.interval;

            pauseTimeoutId = window.setTimeout(() => {
                if (stroke.action === 'add') {
                    replayedText.value += stroke.key;
                    replayedTextArray.value.push({ key: stroke.key, interval });
                } else if (stroke.action === 'remove') {
                    replayedText.value = replayedText.value.slice(0, -1);
                    replayedTextArray.value.pop();
                } else if (stroke.action === 'removeWord') {
                    const words = replayedText.value.trim().split(' ');
                    if (words.length > 0) {
                        words.pop(); // Удаляем последнее слово
                        replayedText.value = words.join(' ') + (words.length > 0 ? ' ' : ''); // Добавляем пробел, если нужно
                    }
                    // Удаляем буквы, соответствующие удалённому слову
                    replayedTextArray.value = replayedTextArray.value.slice(0, replayedText.value.length);
                }

                replayIndex++;
                replayNext();
            }, interval);
        } else {
            isReplaying.value = false;
            replayIndex = 0; // Сбрасываем индекс после завершения
        }
    };

    replayNext(); // Запускаем воспроизведение с текущего индекса
};
// Функция воспроизведения записей
const startReplay = async () => {
    if (selectedRecordingId.value === null || isReplaying.value) return;

    // Сбрасываем начальные значения при начале воспроизведения с нуля
    replayedText.value = '';
    replayedTextArray.value = [];
    isPaused.value = false;
    isReplaying.value = true;
    replayIndex = 0;

    const allKeystrokes = await db.table('keystrokes')
        .where('recordingId')
        .equals(selectedRecordingId.value)
        .toArray();

    await replayFromCurrentIndex(allKeystrokes); // Начинаем воспроизведение
};
// Пауза и продолжение воспроизведения
const pauseReplay = () => {
    isPaused.value = true;
    if (pauseTimeoutId) {
        clearTimeout(pauseTimeoutId); // Останавливаем текущий таймер
    }
};

// Продолжение воспроизведения с текущего индекса
const resumeReplay = async () => {
    if (isPaused.value && isReplaying.value) {
        isPaused.value = false;
        const allKeystrokes = await db.table('keystrokes')
            .where('recordingId')
            .equals(Number(selectedRecordingId.value))
            .toArray();

        await replayFromCurrentIndex(allKeystrokes); // Продолжаем воспроизведение с текущего индекса
    }
};
// Остановка таймера при размонтировании компонента
useIntervalFn(checkAfkTime, 1000);
onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
    loadRecordings();
});
onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
});
const loadRecordings = async () => {
    recordings.value = await db.table('recordings').toArray();
    if (recordings.value.length > 0) {
        selectedRecordingId.value = Number(recordings.value[0].id);
    }
};
const fileInput = ref<HTMLInputElement | null>(null);

const importData = () => {
    fileInput.value?.click(); // Открывает диалог для выбора файла
};

const handleFileImport = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
            try {
                const parsedData = JSON.parse(content);
                await importFromJSON(parsedData);
                await loadRecordings(); // Обновляем список записей после импорта
            } catch (error) {
                console.error('Ошибка при импорте данных:', error);
            }
        }
    };

    reader.readAsText(file);
};

const importFromJSON = async (data: any) => {
    if (!Array.isArray(data)) {
        throw new Error('Неверный формат данных. Ожидается массив.');
    }

    for (const item of data) {
        const { recording, keystrokes } = item;

        // Добавляем запись в базу данных
        const recordingId = await db.table('recordings').add({
            name: recording.name,
            createdAt: new Date(recording.createdAt)
        });

        // Добавляем кейстроки для этой записи
        for (const keystroke of keystrokes) {
            await db.table('keystrokes').add({
                recordingId,
                interval: keystroke.interval,
                action: keystroke.action,
                key: keystroke.key,
                word: keystroke.word || null, // Если нет слова, сохраняем null
            });
        }
    }
};
// Функция загрузки кейстроков для выбранной записи
const loadKeystrokes = async () => {
    if (selectedRecordingId.value !== null) {
        keystrokes.value = await db.table('keystrokes')
            .where('recordingId')
            .equals(selectedRecordingId.value)
            .toArray();
    }
};

// Функция экспорта кейстроков для выбранной записи
const exportKeystrokes = async () => {
    if (selectedRecordingId.value === null) return;
    const allKeystrokes = await db.table('keystrokes')
        .where('recordingId')
        .equals(selectedRecordingId.value)
        .toArray();
    let timestamp = 0;
    exportedData.value = allKeystrokes
        .map(stroke => {
            timestamp += stroke.interval;
            return `Timestamp: ${timestamp}, Key: ${stroke.key}, Action: ${stroke.action}`;
        })
        .join('\n');
};

// Функция экспорта всех данных в JSON
const exportAllData = async () => {
    const allRecordings = await db.table('recordings').toArray();
    const allData = await Promise.all(
        allRecordings.map(async (recording) => {
            const keystrokes = await db.table('keystrokes')
                .where('recordingId')
                .equals(recording.id!)
                .toArray();
            return {
                recording,
                keystrokes,
            };
        })
    );
    const jsonString = JSON.stringify(allData, null, 2);
    downloadJSON(jsonString, 'recordings.json');
};

// Функция для загрузки JSON файла
const downloadJSON = (json: string, filename: string) => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

// Функция для определения цвета текста в зависимости от интервала
const getColorBySpeed = (interval: number) => {
    const maxInterval = 1000; // Максимальный интервал для самого "медленного" цвета
    const minInterval = 100;  // Минимальный интервал для самого "быстрого" цвета

    // Нормализуем интервал в диапазоне от 0 до 1
    const normalizedInterval = Math.min(Math.max((interval - minInterval) / (maxInterval - minInterval), 0), 1);

    // Чем быстрее набирается текст (меньший интервал), тем более красный цвет
    const redComponent = Math.floor(255 * (1 - normalizedInterval));
    const greenComponent = Math.floor(255 * normalizedInterval);

    return `rgb(${redComponent}, ${greenComponent}, 0)`;
};
</script>

<style scoped>
.recorder {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

input {
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
}

button {
    padding: 8px 12px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

button:hover {
    background-color: #0056b3;
}

.replay {
    margin-top: 10px;
}

.export {
    margin-top: 10px;
}
</style>
