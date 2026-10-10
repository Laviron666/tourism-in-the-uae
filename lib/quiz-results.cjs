const QUESTIONS = require('../questions.js');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIX = process.env.VERCEL_ENV === 'production' ? 'quiz-results/v1/' : 'quiz-results/development/';

function validateSubmission(body) {
  if (!body || !UUID.test(body.participantId) || !UUID.test(body.attemptId) || !Array.isArray(body.answers) || body.answers.length !== QUESTIONS.length || !body.answers.every(answer => Number.isInteger(answer) && answer >= 0 && answer < 4)) {
    const error = new Error('Нужно ответить на все 20 вопросов.'); error.status = 400; throw error;
  }
  return {participantId:body.participantId.toLowerCase(),attemptId:body.attemptId.toLowerCase(),score:QUESTIONS.reduce((score, question, index) => score + Number(body.answers[index] === question.correct), 0)};
}

function aggregateResults(blobs) {
  const attempts = new Map();
  for (const blob of blobs) {
    const parts = blob.pathname.slice(PREFIX.length).split('/');
    const score = Number(parts[2]?.replace('.json',''));
    if (!blob.pathname.startsWith(PREFIX) || parts.length !== 3 || !UUID.test(parts[0]) || !UUID.test(parts[1]) || !/^\d+\.json$/.test(parts[2]) || !Number.isInteger(score) || score < 0 || score > QUESTIONS.length) continue;
    const result = {participantId:parts[0],score,completedAt:new Date(blob.uploadedAt).toISOString()};
    const previous = attempts.get(parts[1]);
    // Retry races never create extra attempts, even if two requests arrive together.
    if (!previous || result.completedAt < previous.completedAt) attempts.set(parts[1], result);
  }
  const results = [...attempts.values()];
  const distribution = Array(QUESTIONS.length + 1).fill(0);
  for (const result of results) distribution[result.score]++;
  return {
    participants:new Set(results.map(result => result.participantId)).size,
    attempts:results.length,
    average:results.length ? Number((results.reduce((sum, result) => sum + result.score, 0) / results.length).toFixed(1)) : null,
    distribution,
    recent:results.sort((a,b) => b.completedAt.localeCompare(a.completedAt)).slice(0,10).map(({score,completedAt}) => ({score,completedAt}))
  };
}

function createResultsService(storage) {
  return {
    async record(body) {
      const {participantId,attemptId,score} = validateSubmission(body);
      const prefix = `${PREFIX}${participantId}/${attemptId}/`;
      const existing = await storage.list({prefix,limit:1});
      if (existing.blobs.length) return {saved:true};
      try {
        await storage.put(`${prefix}${score}.json`, JSON.stringify({score,completedAt:new Date().toISOString()}), {access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});
      } catch (error) {
        // A simultaneous retry can have saved the same immutable result already.
        if (!(await storage.list({prefix,limit:1})).blobs.length) throw error;
      }
      return {saved:true};
    },
    async stats() {
      const blobs = []; let cursor;
      do {
        const page = await storage.list({prefix:PREFIX,limit:1000,...(cursor ? {cursor} : {})});
        blobs.push(...page.blobs); cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return aggregateResults(blobs);
    }
  };
}
module.exports = {createResultsService,validateSubmission,aggregateResults,PREFIX};
