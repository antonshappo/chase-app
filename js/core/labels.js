export const STATUS = {
  want: '💡 Хочу выучить',
  learning: '📚 Учим',
  reinforcing: '🔁 Закрепляем',
  known: '✅ Знает',
};

export const TYPE = { trick: 'Трюк', game: 'Игра', project: 'Цель по уровням' };

export const TYPE_HINT = {
  trick: 'Конкретное действие, учим по шагам.',
  game: 'Занятие для головы и носа — ничего не нужно «выучивать», просто играете.',
  project: 'Большая цель, которая не учится за раз (например, «Ко мне» рядом с собаками). Идём по уровням от простого к сложному; уровень поднимается после трёх тренировок подряд с 👍.',
};

export const PLACE = { home: '🏠 Дом', outdoor: '🌳 Улица', any: '🏠🌳 Везде' };

export const LEVEL = { home: '🏠 дома', yard: '🏡 двор', park: '🌳 парк', dogs: '🐕 рядом с собаками' };

export const PROPS = {
  treats: 'Вкусняшки',
  toy: 'Игрушка',
  tug: 'Пуллер',
  rope: 'Верёвка',
  ball: 'Мяч',
  frisbee: 'Фрисби',
  snuffle: 'Нюхательный коврик',
  boxes: 'Коробки',
  cups: 'Стаканчики',
  pillow: 'Подушка',
  blanket: 'Плед',
  chair: 'Стул',
  towel: 'Полотенце',
  basket: 'Корзина',
  harness: 'Шлейка',
  'long-leash': 'Длинный поводок',
  stump: 'Пенёк',
  bench: 'Скамейка',
  log: 'Бревно',
};

export const BLOCK = {
  warmup: { title: 'Разминка' },
  new: { title: 'Новое' },
  pick: { title: 'Новое' },
  repeat: { title: 'Повторение' },
  chain: { title: 'Связка' },
  game: { title: 'Игра' },
  finale: { title: 'Финал' },
};

export const RESULT = { good: '👍', ok: '👌', bad: '👎' };
export const RESULT_LABEL = { good: 'Получилось', ok: 'Частично', bad: 'Не вышло' };

export const stepWord = (t) => (t.meta.type === 'project' ? 'Уровень' : 'Шаг');
