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
    <textarea id="editable">Bonjour depuis un champ modifiable.</textarea>
  </body>
</html>`;

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
