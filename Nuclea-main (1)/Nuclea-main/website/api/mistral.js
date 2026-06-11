module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  var apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY nao configurada na Vercel' });
  }

  try {
    var body = req.body || {};
    if (typeof body === 'string') {
      body = JSON.parse(body || '{}');
    }
    var model = body.model || process.env.MISTRAL_MODEL || 'open-mixtral-8x7b';
    var content = body.content || body.prompt || '';

    if (!content) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }

    var mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1000,
        messages: [{ role: 'user', content: content }]
      })
    });

    var data = await mistralRes.json().catch(function() { return {}; });

    if (!mistralRes.ok) {
      return res.status(mistralRes.status).json({
        error: data.message || data.error || 'Erro na Mistral'
      });
    }

    var answer = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    return res.status(200).json({ resposta: answer });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
};
