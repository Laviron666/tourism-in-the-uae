import {list,put} from '@vercel/blob';
import resultsModule from '../lib/quiz-results.cjs';
const service = resultsModule.createResultsService({list,put});
const json = (body, status = 200) => Response.json(body, {status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export async function GET() {
  try { return json(await service.stats()); }
  catch { console.error('Quiz statistics storage unavailable'); return json({error:'Статистика временно недоступна. Попробуй обновить её позже.'},503); }
}

export async function POST(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({error:'Недопустимый источник запроса.'},403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'Ожидается JSON.'},415);
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({error:'Слишком большой запрос.'},413);
    let body; try { body = JSON.parse(raw); } catch { return json({error:'Некорректный JSON.'},400); }
    return json(await service.record(body));
  } catch (error) {
    if (error.status === 400) return json({error:error.message},400);
    console.error('Quiz result storage unavailable');
    return json({error:'Не удалось сохранить результат. Можно попробовать ещё раз.'},503);
  }
}
