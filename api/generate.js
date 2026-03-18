export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set' });
    }

    // Model priority list — tries each in order until one succeeds
    const models = [
        'gemma-3-27b-it',         // Gemma 3 (replaces deprecated gemma-2-27b-it)
        'gemini-2.0-flash',       // Fast, free tier, very reliable
        'gemini-1.5-flash',       // Proven fallback
    ];

    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
    });

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Model ${model} failed (${response.status}):`, errText);
                continue; // try next model
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                console.log(`Success with model: ${model}`);
                return res.status(200).json({ text });
            }

            console.error(`Model ${model} returned no text:`, JSON.stringify(data));

        } catch (err) {
            console.error(`Model ${model} threw an error:`, err.message);
        }
    }

    return res.status(500).json({ error: 'All models failed to generate content' });
}