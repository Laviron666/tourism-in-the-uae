const {test} = require('node:test');
const assert = require('node:assert/strict');
const QUESTIONS = require('../questions.js');
const {createResultsService,validateSubmission,aggregateResults,PREFIX} = require('../lib/quiz-results.cjs');
const participantId = '11111111-1111-4111-8111-111111111111';
const attemptId = '22222222-2222-4222-8222-222222222222';
const answers = QUESTIONS.map(question => question.correct);
const blob = (participant, attempt, score, date='2026-10-10T12:00:00Z') => ({pathname:`${PREFIX}${participant}/${attempt}/${score}.json`,uploadedAt:new Date(date)});

test('server calculates scores from answers and ignores client score', () => {
  assert.equal(validateSubmission({participantId,attemptId,answers,score:0}).score,20);
  assert.equal(validateSubmission({participantId,attemptId,answers:answers.map(answer=>(answer+1)%4)}).score,0);
});
test('incomplete, invalid and non-integer answers are rejected', () => {
  for (const value of [answers.slice(1), [...answers.slice(1),null], [...answers.slice(1),4], [...answers.slice(1),'1']]) assert.throws(()=>validateSubmission({participantId,attemptId,answers:value}),error=>error.status===400);
  assert.throws(()=>validateSubmission({participantId:'../unsafe',attemptId,answers}));
});
test('statistics distinguish participants and repeated attempts', () => {
  const stats = aggregateResults([blob(participantId,attemptId,20),blob(participantId,'33333333-3333-4333-8333-333333333333',10)]);
  assert.equal(stats.participants,1); assert.equal(stats.attempts,2); assert.equal(stats.average,15);
  assert.equal(stats.distribution[20],1); assert.equal(stats.distribution[10],1);
  assert.equal('participantId' in stats.recent[0],false);
});
test('retry races are counted once and empty statistics do not invent a score', () => {
  const stats = aggregateResults([blob(participantId,attemptId,20),blob(participantId,attemptId,10,'2026-10-10T12:01:00Z')]);
  assert.equal(stats.attempts,1); assert.equal(stats.average,20);
  assert.equal(aggregateResults([]).average,null);
});
test('persistent result writes are idempotent', async () => {
  const blobs=[];
  const service=createResultsService({list:async({prefix})=>({blobs:blobs.filter(b=>b.pathname.startsWith(prefix)),hasMore:false}),put:async(pathname)=>{blobs.push({pathname,uploadedAt:new Date()});}});
  await service.record({participantId,attemptId,answers});
  await service.record({participantId,attemptId,answers});
  assert.equal(blobs.length,1); assert.equal((await service.stats()).attempts,1);
});
test('statistics include every storage page', async () => {
  const service=createResultsService({list:async({cursor})=>cursor ? {blobs:[blob(participantId,'33333333-3333-4333-8333-333333333333',10)],hasMore:false} : {blobs:[blob(participantId,attemptId,20)],hasMore:true,cursor:'page2'}});
  assert.equal((await service.stats()).attempts,2);
});
