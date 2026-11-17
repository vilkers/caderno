export const SCOPES = {
  agenda: 'https://www.googleapis.com/auth/calendar.events.readonly',
  tarefas: 'https://www.googleapis.com/auth/tasks.readonly',
};

const DAY = 86400000;
const ZONE = 'America/Sao_Paulo';
const clock = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const timeKey = ms => new Date(ms).toISOString().slice(0, 10);

function civilMs(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return NaN;
  const ms = Date.parse(key + 'T00:00:00Z');
  return Number.isFinite(ms) && timeKey(ms) === key ? ms : NaN;
}

export function validRange(start, end) {
  return civilMs(end) - civilMs(start) === 7 * DAY;
}

function localParts(ms) {
  const fields = Object.fromEntries(clock.formatToParts(ms).map(({ type, value }) => [type, value]));
  return { day: fields.year + '-' + fields.month + '-' + fields.day, hour: fields.hour + ':' + fields.minute };
}

function localMidnight(key) {
  const civil = civilMs(key);
  let before = civil - DAY;
  let after = civil + DAY;
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (localParts(middle).day < key) before = middle;
    else after = middle;
  }
  return new Date(after).toISOString();
}

function link(value, hosts) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.port && !url.username && !url.password && hosts.includes(url.hostname)) return url.href;
  } catch { /* Sem link disponível. */ }
  return undefined;
}

const errorResult = message => ({ state: 'error', items: [], message });

export function sourceErrors(message) {
  return { agenda: errorResult(message), tarefas: errorResult(message) };
}

class ApiError extends Error {
  constructor(status, config) {
    super('O Google não respondeu à consulta.');
    this.status = status;
    this.config = config;
  }
}

async function readPages(endpoint, params, { fetcher, token, signal }) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams(params);
  const items = [], seen = new Set();
  while (true) {
    const response = await fetcher(url.href, {
      cache: 'no-store', credentials: 'omit', redirect: 'error', signal,
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const config = body?.error?.errors?.some(error => ['accessNotConfigured', 'serviceDisabled'].includes(error.reason))
        || body?.error?.details?.some(error => error.reason === 'SERVICE_DISABLED');
      throw new ApiError(response.status, config);
    }
    const page = await response.json();
    if (page.items) items.push(...page.items);
    if (!page.nextPageToken) return items;
    if (seen.has(page.nextPageToken)) throw new ApiError(502);
    seen.add(page.nextPageToken);
    url.searchParams.set('pageToken', page.nextPageToken);
  }
}

function calendarItemRows(item, range) {
  if (!item.id || item.status === 'cancelled') return [];
  const title = item.summary?.trim() || 'Compromisso sem título';
  const href = link(item.htmlLink, ['calendar.google.com', 'www.google.com']);
  const allDay = Number.isFinite(civilMs(item.start?.date));
  const startMs = Date.parse(item.start?.dateTime), endMs = Date.parse(item.end?.dateTime);
  if (!allDay && !Number.isFinite(startMs)) return [];
  // event.end.date é exclusivo. Para eventos com hora, conservamos o
  // último dia efetivamente ocupado, mesmo se o fim cair à meia-noite.
  const start = allDay ? { day: item.start.date } : localParts(startMs);
  const end = Number.isFinite(endMs) ? localParts(endMs) : null;
  const until = allDay
    ? Math.max(civilMs(item.end?.date) || 0, civilMs(start.day) + DAY)
    : civilMs(localParts(endMs > startMs ? endMs - 1 : startMs).day) + DAY;

  const rows = [];
  for (let ms = Math.max(civilMs(start.day), civilMs(range.start)); ms < Math.min(until, civilMs(range.end)); ms += DAY) {
    const day = timeKey(ms);
    rows.push({
      id: item.id + ':' + day, title, day, allDay, href,
      start: start.day === day ? start.hour : undefined,
      end: end?.day === day ? end.hour : undefined,
    });
  }
  return rows;
}

function unique(items) {
  return [...new Map(items.map(item => [item.id, item])).values()];
}

async function agenda(range, read) {
  const events = await readPages('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    timeMin: localMidnight(range.start),
    timeMax: localMidnight(range.end),
    singleEvents: 'true', showDeleted: 'false', timeZone: ZONE, maxResults: '250',
    fields: 'nextPageToken,items(id,status,summary,htmlLink,start(date,dateTime),end(date,dateTime))',
  }, read);
  return unique(events.flatMap(item => calendarItemRows(item, range))).sort((a, b) => a.day.localeCompare(b.day)
    || Number(b.allDay) - Number(a.allDay) || (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title, 'pt-BR'));
}

async function tarefas(range, read) {
  const lists = await readPages('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    maxResults: '100', fields: 'nextPageToken,items(id,title)',
  }, read);
  const fields = 'nextPageToken,items(id,title,due,status,deleted,hidden,webViewLink)';
  const params = {
    maxResults: '100', showCompleted: 'false', showDeleted: 'false', showHidden: 'false',
    dueMin: range.start + 'T00:00:00Z', dueMax: range.end + 'T00:00:00Z', fields,
  };
  const rows = [];
  for (let i = 0; i < lists.length; i += 4) {
    const batches = await Promise.all(lists.slice(i, i + 4).map(async list => {
      if (!list.id) return [];
      const endpoint = 'https://tasks.googleapis.com/tasks/v1/lists/' + encodeURIComponent(list.id) + '/tasks';
      const tasks = await readPages(endpoint, params, read);
      return tasks.flatMap(task => {
        // O Google Tasks grava apenas o dia e ignora o componente de hora.
        const day = task.due?.slice(0, 10);
        if (!task.id || task.status === 'completed' || task.deleted || task.hidden
          || !Number.isFinite(civilMs(day)) || day < range.start || day >= range.end) return [];
        return [{
          id: list.id + ':' + task.id, title: task.title?.trim() || 'Tarefa sem título',
          day, list: list.title,
          href: link(task.webViewLink, ['tasks.google.com', 'calendar.google.com']),
        }];
      });
    }));
    rows.push(...batches.flat());
  }
  return unique(rows).sort((a, b) => a.day.localeCompare(b.day) || a.title.localeCompare(b.title, 'pt-BR'));
}

function sourceMessage(error, label) {
  if (error.name === 'AbortError') return 'A consulta a ' + label + ' demorou demais. Atualize para tentar novamente.';
  if (error.config) return 'A API de ' + label + ' precisa ser ativada no projeto do Google.';
  if (error.status === 401) return 'A sessão do Google expirou. Conecte novamente.';
  if (error.status === 403) return 'O Google não permitiu consultar ' + label + ' nesta conta.';
  if (error.status === 429) return 'O Google limitou as consultas. Tente de novo em instantes.';
  return 'Não consegui consultar ' + label + '. Você pode tentar novamente.';
}

export async function readSources({ range, available, token, signal, fetcher = globalThis.fetch }) {
  const read = { fetcher, token, signal };
  async function load(key, label, call) {
    if (!available[key]) return errorResult('O acesso a ' + label + ' não foi autorizado.');
    try { return { state: 'ok', items: await call(range, read) }; }
    catch (error) { return errorResult(sourceMessage(error, label)); }
  }
  const [events, tasks] = await Promise.all([
    load('agenda', 'Google Agenda', agenda),
    load('tarefas', 'Google Tasks', tarefas),
  ]);
  return { agenda: events, tarefas: tasks };
}
