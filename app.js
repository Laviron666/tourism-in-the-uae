'use strict';
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'uae-tourism-quiz-v1';
const letters = ['А', 'Б', 'В', 'Г'];
let answers = Array(QUESTIONS.length).fill(null);
let current = 0;
let completed = false;
let attemptId = crypto.randomUUID();
let statsSubmitted = false;
let participantId;
try {
  participantId = localStorage.getItem('uae-tourism-participant');
  if (!/^[0-9a-f-]{36}$/i.test(participantId || '')) { participantId = crypto.randomUUID(); localStorage.setItem('uae-tourism-participant',participantId); }
} catch { participantId = crypto.randomUUID(); }
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && Array.isArray(saved.answers) && saved.answers.length === QUESTIONS.length && saved.answers.every(a => a === null || (Number.isInteger(a) && a >= 0 && a < 4)) && Number.isInteger(saved.current) && saved.current >= 0 && saved.current < QUESTIONS.length) {
    answers = saved.answers;
    current = saved.current;
    completed = saved.completed === true && answers.every(a => a !== null);
    if (/^[0-9a-f-]{36}$/i.test(saved.attemptId || '')) attemptId = saved.attemptId;
    statsSubmitted = saved.statsSubmitted === true || (completed && !saved.attemptId);
  }
} catch { /* Работа теста не зависит от доступности хранилища. */ }
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({answers, current, completed, attemptId, statsSubmitted})); } catch { /* Приватный режим и ограничения браузера не блокируют тест. */ }
}
function animateContent(element) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate) return;
  element.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}], {duration:200,easing:'cubic-bezier(0.23, 1, 0.32, 1)'});
}
function renderQuestion(focus = false) {
  const question = QUESTIONS[current];
  $('question-view').hidden = false;
  $('result-view').hidden = true;
  $('question-counter').textContent = `Вопрос ${current + 1} из ${QUESTIONS.length}`;
  $('question-topic').textContent = question.topic;
  $('question-text').textContent = question.q;
  $('hint-text').textContent = question.hint;
  $('hint').open = false;
  const answered = answers.filter(a => a !== null).length;
  $('progress-fill').style.transform = `scaleX(${answered / QUESTIONS.length})`;
  $('quiz-progress').setAttribute('aria-valuenow', answered);
  $('quiz-progress').setAttribute('aria-valuetext', `Ответов: ${answered} из ${QUESTIONS.length}`);
  $('answer-options').replaceChildren();
  question.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'answer-option';
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'answer'; input.value = index;
    input.checked = answers[current] === index;
    const letter = document.createElement('span');
    letter.className = 'answer-letter'; letter.textContent = letters[index]; letter.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.className = 'answer-label'; text.textContent = option;
    const check = document.createElement('span'); check.className = 'answer-check'; check.textContent = '✓'; check.setAttribute('aria-hidden', 'true');
    label.append(input, letter, text, check);
    input.addEventListener('change', () => {
      answers[current] = index; saveProgress();
      $('next-button').disabled = false;
      $('selection-note').textContent = 'Ответ выбран';
      const count = answers.filter(a => a !== null).length;
      $('progress-fill').style.transform = `scaleX(${count / QUESTIONS.length})`;
      $('quiz-progress').setAttribute('aria-valuenow', count);
      $('quiz-progress').setAttribute('aria-valuetext', `Ответов: ${count} из ${QUESTIONS.length}`);
    });
    $('answer-options').append(label);
  });
  $('back-button').disabled = current === 0;
  $('next-button').disabled = answers[current] === null;
  $('next-button').innerHTML = current === QUESTIONS.length - 1 ? 'Результат <span aria-hidden="true">↗</span>' : 'Далее <span aria-hidden="true">→</span>';
  $('selection-note').textContent = answers[current] === null ? 'Выбери один ответ' : 'Ответ выбран';
  if (focus) {
    $('question-text').tabIndex = -1;
    $('question-text').focus({preventScroll:true});
    if (matchMedia('(max-width: 1000px)').matches) $('quiz-card').scrollIntoView({block:'start',behavior:'instant'});
    $('quiz-announcement').textContent = `Вопрос ${current + 1} из ${QUESTIONS.length}`;
    animateContent($('question-content'));
  }
}
function getResultMessage(score) {
  if (score >= 16) return {title:'Отличный результат!',message:'Отличный результат! Ты хорошо знаешь туристические особенности ОАЭ.'};
  if (score >= 10) return {title:'Хороший результат!',message:'Хороший результат! Ты уже многое знаешь, но впереди ещё интересные открытия.'};
  return {title:'Начало путешествия!',message:'Начало путешествия! Изучи интересные факты об ОАЭ и попробуй пройти тест ещё раз.'};
}
function renderResult(focus = false) {
  const score = QUESTIONS.reduce((total, q, index) => total + Number(answers[index] === q.correct), 0);
  const result = getResultMessage(score);
  $('question-view').hidden = true;
  $('result-view').hidden = false;
  $('result-view').innerHTML = `<div class="result-header"><span class="result-kicker">ПУТЕШЕСТВИЕ ЗАВЕРШЕНО</span><div class="result-score">${score}<span> / ${QUESTIONS.length}</span></div><h3 id="result-title" tabindex="-1">${result.title}</h3><p>${result.message}</p><div class="result-actions"><button class="button primary" id="restart-button" type="button">Пройти ещё раз <span aria-hidden="true">↻</span></button><button class="button secondary" id="review-button" type="button">Разобрать ответы <span aria-hidden="true">↓</span></button></div></div><h3 class="review-heading" id="review-title" tabindex="-1">Твои ответы и объяснения</h3><div id="answer-review"></div>`;
  QUESTIONS.forEach((question, index) => {
    const correct = answers[index] === question.correct;
    const detail = document.createElement('details');
    detail.className = `review-item ${correct ? 'right' : 'wrong'}`;
    const summary = document.createElement('summary');
    const status = document.createElement('span');
    status.className = 'review-status'; status.textContent = correct ? '✓' : '×'; status.setAttribute('aria-label', correct ? 'Правильно' : 'Неправильно');
    const title = document.createElement('span'); title.textContent = `${index + 1}. ${question.q}`;
    summary.append(status, title);
    const chosen = document.createElement('p'); chosen.textContent = `Твой ответ: ${question.options[answers[index]]}`;
    const correctAnswer = document.createElement('p'); correctAnswer.className = 'correct-answer'; correctAnswer.textContent = `Правильный ответ: ${question.options[question.correct]}`;
    const explanation = document.createElement('p'); explanation.textContent = question.explanation;
    detail.append(summary, chosen, correctAnswer, explanation);
    $('answer-review').append(detail);
  });
  $('restart-button').addEventListener('click', () => {
    answers = Array(QUESTIONS.length).fill(null); current = 0; completed = false;
    attemptId = crypto.randomUUID(); statsSubmitted = false;
    saveProgress(); renderQuestion(true);
    $('quiz').scrollIntoView({block:'start'});
  });
  $('review-button').addEventListener('click', () => {
    document.querySelectorAll('.review-item').forEach(detail => { detail.open = true; });
    $('review-title').focus({preventScroll:true}); $('review-title').scrollIntoView({block:'start'});
  });
  if (focus) { $('result-title').focus({preventScroll:true}); $('quiz').scrollIntoView({block:'start'}); animateContent($('result-view')); }
  $('quiz-announcement').textContent = `Результат: ${score} правильных ответов из ${QUESTIONS.length}. ${result.message}`;
  const sync = document.createElement('p'); sync.id = 'result-sync-status'; sync.className = 'stats-note'; sync.setAttribute('role','status');
  $('result-view').querySelector('.result-header').append(sync);
  const statisticsLink = document.createElement('a'); statisticsLink.className = 'button secondary'; statisticsLink.href = '#statistics'; statisticsLink.textContent = 'Общая статистика ↓';
  $('result-view').querySelector('.result-actions').append(statisticsLink);
  if (!statsSubmitted) submitResult();
}

let resultSaving = false;
async function submitResult() {
  if (resultSaving || statsSubmitted || !completed) return;
  resultSaving = true;
  const submittedId = attemptId;
  const status = $('result-sync-status');
  if (status) status.textContent = 'Сохраняем балл в общей статистике…';
  try {
    const response = await fetch('/api/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({participantId,attemptId,answers})});
    if (!response.ok) throw new Error('Save failed');
    if (attemptId === submittedId) { statsSubmitted = true; saveProgress(); if (status) status.textContent = 'Твой результат учтён в общей статистике.'; }
    await loadStatistics();
  } catch {
    if (status && attemptId === submittedId) {
      status.textContent = 'Результат теста готов, но статистику пока не удалось обновить. ';
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'stats-retry'; retry.textContent = 'Сохранить ещё раз'; retry.addEventListener('click',submitResult); status.append(retry);
    }
  } finally {
    resultSaving = false;
    if (completed && !statsSubmitted && attemptId !== submittedId) submitResult();
  }
}

async function loadStatistics() {
  const button = $('refresh-stats'); button.disabled = true;
  $('stats-status').textContent = 'Загружаем общую статистику…';
  try {
    const response = await fetch('/api/results',{cache:'no-store'});
    if (!response.ok) throw new Error('Statistics unavailable');
    const data = await response.json();
    $('stats-participants').textContent = data.participants.toLocaleString('ru-RU');
    $('stats-attempts').textContent = data.attempts.toLocaleString('ru-RU');
    $('stats-average').textContent = data.average === null ? '—' : data.average.toLocaleString('ru-RU');
    $('stats-groups').replaceChildren();
    [[16,20,'Отличный результат'],[10,15,'Хороший результат'],[0,9,'Начало путешествия']].forEach(([start,end,label]) => {
      const count = data.distribution.slice(start,end+1).reduce((sum,n) => sum+n,0);
      const row = document.createElement('div'); row.className = 'stats-group';
      const caption = document.createElement('p'); caption.textContent = `${start}–${end} из 20 · ${label}`;
      const countText = document.createElement('strong'); countText.textContent = `${count} (${data.attempts ? Math.round(count / data.attempts * 100) : 0}%)`;
      const track = document.createElement('div'); track.className = 'stats-group-track'; const bar = document.createElement('span'); bar.style.width = `${data.attempts ? count/data.attempts*100 : 0}%`; track.append(bar); row.append(caption,countText,track); $('stats-groups').append(row);
    });
    const addRow = (parent,left,right) => { const row = document.createElement('tr'); [left,right].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }); parent.append(row); };
    $('stats-distribution').replaceChildren();
    for (let score=20;score>=0;score--) addRow($('stats-distribution'),`${score} из 20`,data.distribution[score]);
    $('stats-recent').replaceChildren();
    data.recent.forEach(result => addRow($('stats-recent'),new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Kyiv'}).format(new Date(result.completedAt)),`${result.score} / 20`));
    if (!data.recent.length) addRow($('stats-recent'),'Пока нет завершённых тестов','—');
    $('stats-content').hidden = false;
    $('stats-status').textContent = data.attempts ? 'Общие результаты всех участников сайта.' : 'Пока никто не завершил тест. Твоё прохождение может стать первым!';
  } catch { $('stats-status').textContent = 'Статистика временно недоступна. Нажми «Обновить», чтобы попробовать ещё раз.'; }
  finally { button.disabled = false; }
}
$('refresh-stats').addEventListener('click',loadStatistics);
$('next-button').addEventListener('click', () => {
  if (answers[current] === null) return;
  if (current < QUESTIONS.length - 1) { current++; saveProgress(); renderQuestion(true); }
  else if (answers.every(a => a !== null)) { completed = true; saveProgress(); renderResult(true); }
});
$('back-button').addEventListener('click', () => { if (current > 0) { current--; saveProgress(); renderQuestion(true); } });
document.querySelectorAll('.start-link').forEach(link => link.addEventListener('click', () => {
  if (!completed) { $('question-text').tabIndex = -1; $('question-text').focus({preventScroll:true}); }
}));
const cities = {
  dubai:{label:'ГОРОД БУДУЩЕГО',name:'Дубай',description:'Город, который превращает амбициозные идеи в достопримечательности. Небоскрёбы, морское побережье и традиционные рынки складываются в один необычный маршрут.',highlights:['Бурдж-Халифа и современная архитектура','Пляжи, шопинг и семейные развлечения','Пустынные сафари и традиционные рынки']},
  abudhabi:{label:'КУЛЬТУРА И МАСШТАБ',name:'Абу-Даби',description:'Столица ОАЭ сочетает современные пространства с арабским культурным наследием. Здесь можно знакомиться с искусством, архитектурой и историей, а затем отдыхать у моря.',highlights:['Мечеть шейха Зайда','Музеи, искусство и культурные маршруты','Побережье и современная инфраструктура']},
  sharjah:{label:'ИСТОРИЯ И ТРАДИЦИИ',name:'Шарджа',description:'Направление для тех, кто хочет глубже узнать культурное наследие региона. Музеи, исторические кварталы и традиционные рынки раскрывают другую сторону Эмиратов.',highlights:['Исторические районы','Музеи и культурное наследие','Традиционные рынки и арабское искусство']},
  rak:{label:'ПРИРОДА И ПРИКЛЮЧЕНИЯ',name:'Рас-эль-Хайма',description:'Эмират для любителей природы и активного отдыха. Горные пейзажи, побережье и пустынные маршруты позволяют дополнить городское путешествие новыми впечатлениями.',highlights:['Горные маршруты в горах Хаджар','Морское побережье и пляжный отдых','Природные пейзажи и приключения']}
};
const cityTabs = [...document.querySelectorAll('[data-city]')];
function selectCity(tab, animate = true) {
  const city = cities[tab.dataset.city];
  cityTabs.forEach(t => { t.setAttribute('aria-selected', String(t === tab)); t.tabIndex = t === tab ? 0 : -1; });
  $('destination-panel').setAttribute('aria-labelledby', tab.id);
  $('city-label').textContent = city.label; $('city-title').textContent = city.name; $('city-description').textContent = city.description;
  $('city-number').textContent = String(cityTabs.indexOf(tab) + 1).padStart(2,'0');
  $('city-highlights').replaceChildren();
  city.highlights.forEach((highlight, index) => { const row = document.createElement('div'); const icon = document.createElement('span'); icon.textContent = ['⌖','✧','◎'][index]; icon.setAttribute('aria-hidden','true'); const text = document.createElement('span'); text.textContent = highlight; row.append(icon,text); $('city-highlights').append(row); });
  if (animate) animateContent($('destination-panel'));
}
cityTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectCity(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % cityTabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + cityTabs.length) % cityTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = cityTabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectCity(cityTabs[next], false); cityTabs[next].focus(); }
  });
});
selectCity(cityTabs[0], false);
const survey = [
  ['Хотели бы вы посетить ОАЭ?',['Да','Нет','Пока не знаю']],
  ['Что больше всего привлекает вас в ОАЭ?',['Современная архитектура','Море и пляжи','Пустынные экскурсии','Шопинг и развлечения','Культура и история']],
  ['Как вы думаете, почему ОАЭ стали популярным направлением?',['Развитая инфраструктура','Уникальные достопримечательности','Активная реклама','Сочетание нескольких факторов']],
  ['Какой вид отдыха вы бы выбрали?',['Пляжный','Познавательный','Приключенческий','Развлекательный','Люксовый']],
  ['Что сильнее всего повлияло бы на ваше решение поехать в ОАЭ?',['Стоимость поездки','Качество отеля','Интересные достопримечательности','Климат','Безопасность и удобство']],
  ['Как вы считаете, можно ли сделать пустыню туристическим преимуществом?',['Да, благодаря экскурсиям и необычным впечатлениям','Нет, пустыня неинтересна туристам','Только при наличии современных развлекательных объектов','Затрудняюсь ответить']],
  ['Что вы хотели бы посетить в первую очередь?',['Бурдж-Халифа','Мечеть шейха Зайда','Пустыню','Пляжи','Тематический парк']],
  ['Какой недостаток отдыха в ОАЭ кажется вам наиболее существенным?',['Жара','Стоимость некоторых услуг','Культурные особенности','Большое количество туристов','Не вижу существенных недостатков']]
];
survey.forEach(([question, options], index) => {
  const fieldset = document.createElement('fieldset'); fieldset.className = 'survey-question';
  const legend = document.createElement('legend'); legend.textContent = `${index + 1}. ${question}`;
  const list = document.createElement('div'); list.className = 'survey-options';
  options.forEach(option => { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'radio'; input.name = `survey-${index}`; input.value = option; input.required = true; label.append(input,document.createTextNode(option)); list.append(label); });
  fieldset.append(legend,list); $('survey-questions').append(fieldset);
});
$('survey-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const content = 'Анкета: туристическая привлекательность ОАЭ\n\n' + survey.map(([q], index) => `${index+1}. ${q}\nОтвет: ${data.get(`survey-${index}`)}`).join('\n\n');
  const url = URL.createObjectURL(new Blob(['\ufeff',content],{type:'text/plain;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url; link.download = 'uae-survey-answers.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
  $('survey-status').textContent = 'Файл с ответами подготовлен. Передай его организатору исследования.';
});
if (completed) renderResult(); else renderQuestion();
loadStatistics();
