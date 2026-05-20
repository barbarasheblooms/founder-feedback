export const runtime = 'edge';

const SYSTEM = `You are an analyst specializing in female startup ecosystems and acceleration platforms. Analyze the feedback and return ONLY valid JSON with no markdown, backticks, or extra text:
{"summary":"one short sentence","profile":"inferred founder profile","themes":[{"theme":"short name","relevance":"high|medium|low"}],"pain_points":[{"pain":"objective description","intensity":"high|medium|low","quote":"literal or close excerpt"}],"requests":["explicit request"],"opportunities":["inferred product opportunity"]}
Max: 4 themes, 4 pain points, 3 requests, 3 opportunities. Focus on actionable insights for a B2B platform for female founders.`;

export async function POST(req) {
  try {
    const { textContent, source, name, inputMode, fileData, fileType } = await req.json();

    let userContent;
    if (inputMode === 'text') {
      userContent = [{ type: 'text', text: `Source: ${source}\nIdentifier: ${name}\n\n${textContent.slice(0, 4000)}` }];
    } else if (inputMode === 'pdf') {
      userContent = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } },
        { type: 'text', text: `Source: ${source}\nIdentifier: ${name}\n\nAnalyze this document as founder feedback about SheBlooms platform.` },
      ];
    } else {
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: fileType || 'image/jpeg', data: fileData } },
        { type: 'text', text: `Source: ${source}\nIdentifier: ${name}\n\nAnalyze this image as founder feedback about SheBlooms platform.` },
      ];
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1000, system: SYSTEM, messages: [{ role: 'user', content: userContent }] }),
    });

    const data = await res.json();
    const raw  = data.content.map(b => b.text || '').join('');
    let analysis;
    try { analysis = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
    catch { analysis = { summary: '', profile: '', themes: [], pain_points: [], requests: [], opportunities: [] }; }

    return Response.json({ analysis });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
