export const runtime = 'edge';

const BASE_SYSTEM = `You are SheBlooms' product and growth analyst — a platform and accelerator for female founders (tiered model: START, GROW, RAISE). Be direct, strategic, and data-driven. Always ground your answers in the feedback library. Call out patterns and cite how many founders mentioned something when relevant. Use bullet points and bold for key takeaways. Respond in English.`;

export async function POST(req) {
  try {
    const { messages, libraryContext, entryCount } = await req.json();

    const system = `${BASE_SYSTEM}\n\n=== FEEDBACK LIBRARY (${entryCount} entries) ===\n${libraryContext}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1000, system, messages }),
    });

    const data  = await res.json();
    const reply = data.content.map(b => b.text || '').join('');
    return Response.json({ reply });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
