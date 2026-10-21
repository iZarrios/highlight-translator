import { createServer } from 'node:http';

const port = 4173;

const fixture = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Highlight Translator fixture</title>
    <style>
      html { font-size: 23px; }
      body { margin: 40px; font-family: sans-serif; }
      p { max-width: 560px; }
    </style>
  </head>
  <body>
    <h1>Selection fixture</h1>
    <p id="french">Le renard brun rapide saute par-dessus le chien paresseux.</p>
    <p id="idiom">This only happens once in a blue moon.</p>
    <p id="rain">Il pleut des cordes depuis ce matin, alors nous avons annulé le pique-nique au bord du lac.</p>
    <textarea id="editable">Bonjour depuis un champ modifiable.</textarea>
  </body>
</html>`;

const rainTranslation =
  'It has been raining cats and dogs since this morning, so we cancelled the picnic by the lake.';
const rainExplanation =
  '"Il pleut des cordes" is a French idiom for very heavy rain, like "raining cats and dogs". The rain is why the lakeside picnic was cancelled.';
// What LFM2.5-24B-A2B answered for the rain sentence, including two made-up
// values ("il a", "et") that the client must drop.
const rainWordMapping = {
  It: 'Il pleut',
  has: 'il a',
  been: 'été',
  raining: 'pleut',
  cats: 'des cordes',
  and: 'et',
  dogs: 'des cordes',
  since: 'depuis',
  this: 'ce',
  morning: 'matin',
  so: 'alors',
  we: 'nous',
  cancelled: 'avons annulé',
  the: 'le',
  picnic: 'pique-nique',
  by: 'au bord du',
  lake: 'lac',
};

function wordMappingAnswer(input) {
  const keys = input.response_format.json_schema.schema.required;
  return Object.fromEntries(
    keys.map((key) => [key, rainWordMapping[key.replace(/^\d+ /, '')] ?? '']),
  );
}

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    });
    return response.end();
  }
  if (request.url === '/health') return json(response, 200, { status: 'ok' });
  if (request.url === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return response.end(fixture);
  }
  if (request.url === '/v1/models') {
    return json(response, 200, {
      object: 'list',
      data: [{ id: 'fixture-model', object: 'model' }],
    });
  }
  if (request.url === '/v1/chat/completions' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    const isRain = input.messages.some((message) =>
      message.content.includes('Il pleut des cordes'),
    );
    if (input.response_format?.json_schema?.name === 'word-mapping') {
      return json(response, 200, {
        choices: [
          { message: { content: JSON.stringify(wordMappingAnswer(input)) } },
        ],
      });
    }
    if (isRain) {
      const content = JSON.stringify({
        translation: rainTranslation,
        explanation: rainExplanation,
      });
      return json(response, 200, { choices: [{ message: { content } }] });
    }
    if (input.stream) {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'access-control-allow-origin': '*',
      });
      const event = (content) =>
        `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
      response.write(
        event(
          '{"translation":"A deterministic translation.","explanation":"A deterministic ',
        ),
      );
      setTimeout(() => {
        response.write(event('test explanation."}'));
        response.end('data: [DONE]\n\n');
      }, 20);
      return;
    }
    return json(response, 200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              translation: 'A deterministic translation.',
              explanation: 'A deterministic test explanation.',
            }),
          },
        },
      ],
    });
  }
  return json(response, 404, { error: { message: 'fixture route not found' } });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Test server listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
