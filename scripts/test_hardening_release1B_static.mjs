import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const read = (path) => fs.readFileSync(path, 'utf8');

const envelope = read('src/data/dataEnvelope.js');
const timeout = read('src/utils/withTimeout.js');
const mounted = read('src/hooks/useMountedRef.js');
const topicService = read('src/services/topicService.js');
const topicContext = read('src/context/TopicContext.jsx');
const topicDetail = read('src/pages/TopicDetail.jsx');

pass(envelope.includes('export function makeEnvelope'), 'dataEnvelope missing makeEnvelope');
pass(envelope.includes('export function stableStringify'), 'dataEnvelope missing stableStringify');
pass(envelope.includes('export function fnv1aHex'), 'dataEnvelope missing fnv1aHex');
pass(envelope.includes('payloadHash'), 'dataEnvelope missing payloadHash');
pass(envelope.includes('Object.freeze'), 'dataEnvelope must freeze envelopes');

pass(timeout.includes('class TimeoutError'), 'withTimeout missing TimeoutError');
pass(timeout.includes('export function withTimeout'), 'withTimeout missing withTimeout');
pass(timeout.includes('finally'), 'withTimeout must clear timeout in finally');

pass(mounted.includes('export function useMountedRef'), 'useMountedRef hook missing');
pass(mounted.includes('mountedRef.current = false'), 'useMountedRef must clear mounted ref on unmount');

pass(topicService.includes('makeEnvelope'), 'topicService must import/use makeEnvelope');
pass(topicService.includes('Invalid topic: missing query/name'), 'topicService must handle malformed topics');
pass(topicService.includes('const settings = safeGetSettings()'), 'topicService must guard getSettings');
pass(topicService.includes('Promise.allSettled'), 'fetchAllTopicsNews must use Promise.allSettled');
pass(
  topicService.includes("source: 'live'") || topicService.includes('source: "live"'),
  'topicService missing live envelope source'
);
pass(
  topicService.includes("source: 'failed'") || topicService.includes('source: "failed"'),
  'topicService missing failed envelope source'
);
pass(
  !/catch\s*\([^)]*\)\s*{[^}]*return\s+\[\s*\]/s.test(topicService),
  'topicService still silently returns [] in catch'
);
pass(topicService.includes('topic_returned_no_articles'), 'topicService missing empty-success warning');
pass(topicService.includes('topic_fetch_failed'), 'topicService missing failed diagnostics');

pass(topicContext.includes('function unwrapTopicEnvelope'), 'TopicContext missing unwrapTopicEnvelope helper');
pass(topicContext.includes('setTopicNews(prevTopicNews =>'), 'TopicContext must use functional setTopicNews update');
pass(topicContext.includes('previousArticles'), 'TopicContext must preserve previous topic articles on failure');
pass(topicContext.includes('checkForUpdates(notificationPayload.next, notificationPayload.previous)'), 'TopicContext must compare against previous state for notifications');
pass(topicContext.includes('topicMessage'), 'TopicContext must surface topic failure message');

pass(topicDetail.includes('withTimeout'), 'TopicDetail must use withTimeout');
pass(topicDetail.includes('useMountedRef'), 'TopicDetail must use useMountedRef');
pass(topicDetail.includes('env.ok'), 'TopicDetail must inspect env.ok');
pass(topicDetail.includes('Retry'), 'TopicDetail must render Retry UI');
pass(topicDetail.includes('role="alert"'), 'TopicDetail error UI must be visible to users');
pass(topicDetail.includes('Showing the last available results below'), 'TopicDetail should preserve old articles on retry failure');

console.log('PASS: Release 1B static hardening gates');
