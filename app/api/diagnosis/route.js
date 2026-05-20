export const runtime = 'edge';

const SYSTEM = `You are a senior product consultant for female-focused acceleration platforms. Return ONLY valid JSON without markdown or extra text:
{"top_pains":[{"pain":"","frequency":0,"intensity":"high|medium","implication":""}],"top_themes":[{"theme":"","mentions":0}],"founder_profiles":[""],"platform_gaps":[""],"product_opportunities":[{"opportunity":"","urgency":"immediate|next_sprint|backlog","rationale":""}],"exec_summary":"2-3 executive sentences summarizing the current state and recommended focus"}`;

export async function POST(req) {
  try {
    const { libraryContext, entryCount } = await req.json();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: 'user', content: `${entryCount} feedback entries:\n\n${libraryContext}` }],
      }),
    });

    const data = await res.json();
    const raw  = data.content.map(b => b.text || '').join('');
    let diagnosis;
    try { diagnosis = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
    catch { diagnosis = null; }

    return Response.json({ diagnosis });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
